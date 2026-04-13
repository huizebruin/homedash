/**
 * home//dash — API Server
 * Made by Wobbe Bruin (huizebruin) with AI assistance (Claude / Anthropic)
 * https://github.com/huizebruin/homedash
 * License: MIT
 */

const http = require('http');
const fs   = require('fs');
const path = require('path');
const os   = require('os');
const { execSync, exec } = require('child_process');

const VERSION  = '8.1.0';
const DATA_DIR = process.env.DATA_DIR || '/data';
const CFG_FILE = path.join(DATA_DIR, 'config.json');
const PORT     = parseInt(process.env.PORT || '3002');

// ── DEFAULT CONFIG — aangemaakt bij eerste start ──────────────
const DEFAULT_CONFIG = {
  displayName: '',
  lat: 52.96, lon: 5.92, city: 'Heerenveen',
  api: '', theme: 'auto',
  engine: 'google', eico: '🔍', eurl: 'https://google.com/search?q=',
  sort: 'state', ctrI: 30, sysI: 10, pingI: 60,
  events: [],
  services: [],
  calFeeds: [],
  uptimeKuma: { url: '', enabled: false },
  backupPaths: [],
};

// ── CONFIG ────────────────────────────────────────────────────
function ensureDataDir() {
  try { fs.mkdirSync(DATA_DIR, { recursive: true }); } catch(e) {}
}

function initConfig() {
  ensureDataDir();
  if (!fs.existsSync(CFG_FILE)) {
    // Eerste start: schrijf defaults
    fs.writeFileSync(CFG_FILE, JSON.stringify(DEFAULT_CONFIG, null, 2), 'utf8');
    console.log(`[config] Created default config → ${CFG_FILE}`);
  }
}

function readConfig() {
  ensureDataDir();
  try {
    const raw = fs.readFileSync(CFG_FILE, 'utf8');
    const data = JSON.parse(raw);
    // Merge met defaults zodat nieuwe velden altijd aanwezig zijn
    return { ...DEFAULT_CONFIG, ...data };
  } catch(e) {
    console.warn('[config] Read error, returning defaults:', e.message);
    return { ...DEFAULT_CONFIG };
  }
}

function writeConfig(data) {
  ensureDataDir();
  // Merge met huidige + defaults zodat er nooit velden ontbreken
  const current = readConfig();
  const merged  = { ...DEFAULT_CONFIG, ...current, ...data };
  const tmp = CFG_FILE + '.tmp';
  fs.writeFileSync(tmp, JSON.stringify(merged, null, 2), 'utf8');
  fs.renameSync(tmp, CFG_FILE);
  return fs.statSync(CFG_FILE).size;
}

// ── HELPERS ───────────────────────────────────────────────────
function run(cmd, fallback = '') {
  try { return execSync(cmd, { timeout: 5000, stdio: ['pipe','pipe','pipe'] }).toString().trim(); }
  catch(e) { return fallback; }
}
function runLines(cmd) { const o = run(cmd); return o ? o.split('\n').filter(Boolean) : []; }

// ── DOCKER ────────────────────────────────────────────────────
function getContainers() {
  try {
    const raw = run('docker ps -a --format "{{.ID}}|{{.Names}}|{{.Image}}|{{.Status}}|{{.Ports}}|{{.State}}"');
    if (!raw) return [];
    return raw.split('\n').filter(Boolean).map(line => {
      const [id, name, image, status, ports, state] = line.split('|');
      return {
        id: (id||'').slice(0,12), name, image, status,
        ports: ports ? ports.split(',').map(p => p.trim()).filter(Boolean) : [],
        state
      };
    });
  } catch(e) { return []; }
}

// Docker stats: geheugengebruik per container
function getDockerStats() {
  try {
    const raw = run('docker stats --no-stream --format "{{.Name}}|{{.MemUsage}}|{{.CPUPerc}}"');
    if (!raw) return [];
    return raw.split('\n').filter(Boolean).map(line => {
      const [name, mem, cpu] = line.split('|');
      return { name, mem: (mem||'').trim(), cpu: (cpu||'').trim() };
    });
  } catch(e) { return []; }
}

// ── CPU ───────────────────────────────────────────────────────
function getCpuUsage() {
  try {
    const s = run("grep '^cpu ' /proc/stat").split(/\s+/);
    const [user,nice,system,idle,iowait=0,irq=0,softirq=0] = s.slice(1).map(Number);
    const total = user+nice+system+idle+iowait+irq+softirq;
    return Math.round(((total - idle) / total) * 100);
  } catch(e) { return 0; }
}

// ── TEMPERATUUR ───────────────────────────────────────────────
function getTemperatures() {
  const temps = [];
  try {
    // /sys/class/thermal/thermal_zone*
    const zones = fs.readdirSync('/sys/class/thermal')
      .filter(f => f.startsWith('thermal_zone'));
    for (const zone of zones) {
      try {
        const tempRaw  = fs.readFileSync(`/sys/class/thermal/${zone}/temp`, 'utf8').trim();
        const typeRaw  = fs.readFileSync(`/sys/class/thermal/${zone}/type`, 'utf8').trim();
        const tempC    = Math.round(parseInt(tempRaw) / 1000);
        if (tempC > 0 && tempC < 150) {
          temps.push({ zone, type: typeRaw, temp: tempC });
        }
      } catch(e) {}
    }
  } catch(e) {}

  // Fallback: lm-sensors / hwmon
  if (!temps.length) {
    try {
      const hwmon = fs.readdirSync('/sys/class/hwmon');
      for (const h of hwmon) {
        const base = `/sys/class/hwmon/${h}`;
        const files = fs.readdirSync(base).filter(f => /^temp\d+_input$/.test(f));
        for (const f of files) {
          try {
            const val  = parseInt(fs.readFileSync(`${base}/${f}`, 'utf8').trim());
            const lbl  = fs.existsSync(`${base}/${f.replace('input','label')}`)
              ? fs.readFileSync(`${base}/${f.replace('input','label')}`, 'utf8').trim()
              : h;
            const tempC = Math.round(val / 1000);
            if (tempC > 0 && tempC < 150) temps.push({ zone: h, type: lbl, temp: tempC });
          } catch(e) {}
        }
      }
    } catch(e) {}
  }
  return temps;
}

// ── LAST BACKUP ───────────────────────────────────────────────
function getLastBackup(paths) {
  if (!paths || !paths.length) return null;
  let newest = null;
  for (const p of paths) {
    try {
      const stat = fs.statSync(p);
      if (!newest || stat.mtimeMs > newest.mtimeMs) {
        newest = { path: p, mtimeMs: stat.mtimeMs, mtime: stat.mtime };
      }
    } catch(e) {}
  }
  return newest ? { path: newest.path, timestamp: newest.mtime } : null;
}

// ── DISKS ─────────────────────────────────────────────────────
function getDisks() {
  try {
    const skip = ['tmpfs','devtmpfs','overlay','shm','udev','none','cgmfs','squashfs'];
    return runLines('df -h --output=source,fstype,size,used,avail,pcent,target 2>/dev/null | tail -n +2')
      .map(l => {
        const p = l.trim().split(/\s+/);
        if (p.length < 7) return null;
        const [fs,fstype,size,used,avail,pct,mount] = p;
        if (skip.includes(fstype) || fs.startsWith('/dev/loop')) return null;
        if (/^(\/sys|\/proc|\/run\/user|\/dev\/pts)/.test(mount)) return null;
        return { fs, fstype, size, used, avail, pct, mount };
      }).filter(Boolean);
  } catch(e) { return []; }
}

// ── NETWORK ───────────────────────────────────────────────────
function getNetwork() {
  const ifaces = os.networkInterfaces();
  const skipPfx = ['lo','docker','br-','veth'];
  let netDev = {};
  try {
    runLines('cat /proc/net/dev | tail -n +3').forEach(line => {
      const p = line.trim().split(/\s+/);
      const name = p[0].replace(':','');
      netDev[name] = { rx_bytes: parseInt(p[1])||0, tx_bytes: parseInt(p[9])||0 };
    });
  } catch(e) {}
  return Object.entries(ifaces)
    .filter(([n]) => !skipPfx.some(s => n.startsWith(s)))
    .map(([name, addrs]) => {
      const v4 = (addrs||[]).find(a => a.family === 'IPv4');
      const st = netDev[name] || {};
      return { name, ip: v4?.address||'', mac: v4?.mac||'',
        rx_bytes: st.rx_bytes||0, tx_bytes: st.tx_bytes||0 };
    }).filter(n => n.ip);
}

// ── SYSTEM ────────────────────────────────────────────────────
function getSystem() {
  const cpus = os.cpus();
  const tot  = os.totalmem(), free = os.freemem();
  const cfg  = readConfig();
  const temps = getTemperatures();
  const backupPaths = cfg.backupPaths || [];

  return {
    hostname:    cfg.displayName || os.hostname(),
    rawHostname: os.hostname(),
    platform:    os.platform(), arch: os.arch(),
    uptime:      os.uptime(),
    cpuModel:    cpus[0]?.model || 'Unknown',
    cpuCores:    cpus.length,
    cpuUsage:    getCpuUsage(),
    totalMem:    Math.round(tot/1024/1024),
    usedMem:     Math.round((tot-free)/1024/1024),
    freeMem:     Math.round(free/1024/1024),
    memPct:      Math.round(((tot-free)/tot)*100),
    disks:       getDisks(),
    network:     getNetwork(),
    loadAvg:     os.loadavg().map(l => l.toFixed(2)),
    temperatures: temps,
    lastBackup:  getLastBackup(backupPaths),
    version:     VERSION,
  };
}

// ── PING ──────────────────────────────────────────────────────
function pingHost(host) {
  return new Promise(resolve => {
    exec(`ping -c 1 -W 1 ${host} 2>/dev/null`, { timeout: 3000 }, (err, stdout) => {
      if (err) { resolve({ host, online: false, ms: null }); return; }
      const m = stdout.match(/time=(\d+\.?\d*)/);
      resolve({ host, online: true, ms: m ? parseFloat(m[1]) : null });
    });
  });
}

// ── HTTP UTILITIES ────────────────────────────────────────────
function readBody(req) {
  return new Promise((res, rej) => {
    let b = '';
    req.on('data', d => b += d);
    req.on('end', () => { try { res(JSON.parse(b)); } catch(e) { rej(e); } });
    req.on('error', rej);
  });
}

// ── SERVER ────────────────────────────────────────────────────
const server = http.createServer(async (req, res) => {
  const url = req.url.split('?')[0];
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Cache-Control', 'no-cache');
  if (req.method === 'OPTIONS') { res.writeHead(204); res.end(); return; }

  const json = (data, code=200) => {
    res.writeHead(code, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(data));
  };

  try {
    // GET config
    if (url === '/api/config' && req.method === 'GET') {
      json(readConfig());
    }
    // POST config (save)
    else if (url === '/api/config' && req.method === 'POST') {
      const data = await readBody(req);
      const size = writeConfig(data);
      console.log(`[config] Saved ${size} bytes → ${CFG_FILE}`);
      json({ ok: true, saved: new Date().toISOString(), size });
    }
    // Containers lijst
    else if (url === '/api/containers') {
      json(getContainers());
    }
    // Docker stats (geheugen per container)
    else if (url === '/api/docker-stats') {
      json(getDockerStats());
    }
    // Systeem stats
    else if (url === '/api/system') {
      json(getSystem());
    }
    // Temperaturen
    else if (url === '/api/temperatures') {
      json(getTemperatures());
    }
    // Ping
    else if (url.startsWith('/api/ping')) {
      const hosts = new URL('http://x' + req.url).searchParams.get('hosts');
      const list  = (hosts||'').split(',').map(h => h.trim()).filter(Boolean);
      if (!list.length) { json({ error: 'no hosts' }, 400); return; }
      json(await Promise.all([...new Set(list)].map(pingHost)));
    }
    // Container actie: restart / stop / start
    else if (url.startsWith('/api/container/') && req.method === 'POST') {
      const parts  = url.split('/');
      const name   = decodeURIComponent(parts[3] || '');
      const action = parts[4];
      if (!name || !['restart','stop','start'].includes(action)) {
        json({ error: 'invalid' }, 400); return;
      }
      try {
        execSync(`docker ${action} ${name}`, { timeout: 15000 });
        console.log(`[docker] ${action} ${name}`);
        json({ ok: true, action, name });
      } catch(e) {
        json({ error: e.message }, 500);
      }
    }
    // Health
    else if (url === '/health') {
      const exists = fs.existsSync(CFG_FILE);
      json({
        ok: true, version: VERSION,
        uptime: Math.round(process.uptime()),
        configFile: CFG_FILE,
        configExists: exists,
        configSize: exists ? fs.statSync(CFG_FILE).size : 0,
        dataDir: DATA_DIR,
        dataDirWritable: (() => {
          try { fs.accessSync(DATA_DIR, fs.constants.W_OK); return true; }
          catch(e) { return false; }
        })(),
      });
    }
    else {
      json({ error: 'not found', path: url }, 404);
    }
  } catch(e) {
    console.error('[error]', url, e.message);
    json({ error: e.message }, 500);
  }
});

// ── START ─────────────────────────────────────────────────────
server.listen(PORT, '0.0.0.0', () => {
  initConfig(); // Maak config.json aan als die nog niet bestaat
  console.log(`[homedash-api] v${VERSION} listening on :${PORT}`);
  console.log(`[homedash-api] config: ${CFG_FILE} (${fs.existsSync(CFG_FILE) ? fs.statSync(CFG_FILE).size + ' bytes' : 'NEW — defaults written'})`);
  console.log(`[homedash-api] temps:  ${getTemperatures().length} sensor(s) gevonden`);
});

process.on('SIGTERM', () => server.close(() => process.exit(0)));
process.on('SIGINT',  () => server.close(() => process.exit(0)));
