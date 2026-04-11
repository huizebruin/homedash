/**
 * home//dash — API Server
 * Made by Wobbe Bruin (huizebruin) with AI assistance
 * https://github.com/huizebruin/homedash
 * License: MIT
 */

const http = require('http');
const fs   = require('fs');
const path = require('path');
const os   = require('os');
const { execSync, exec } = require('child_process');

const VERSION  = '7.1.0';
const DATA_DIR = process.env.DATA_DIR || '/data';
const CFG_FILE = path.join(DATA_DIR, 'config.json');
const PORT     = parseInt(process.env.PORT || '3001');

// ── CONFIG ────────────────────────────────────────────────────
function ensureDataDir() {
  try { fs.mkdirSync(DATA_DIR, { recursive: true }); } catch(e) {}
}
function readConfig() {
  ensureDataDir();
  try { return JSON.parse(fs.readFileSync(CFG_FILE, 'utf8')); }
  catch(e) { return null; }
}
function writeConfig(data) {
  ensureDataDir();
  const tmp = CFG_FILE + '.tmp';
  fs.writeFileSync(tmp, JSON.stringify(data, null, 2), 'utf8');
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
        ports: ports ? ports.split(',').map(p=>p.trim()).filter(Boolean) : [],
        state
      };
    });
  } catch(e) { return []; }
}

// ── SYSTEM ────────────────────────────────────────────────────
function getCpuUsage() {
  try {
    const s = run("grep '^cpu ' /proc/stat").split(/\s+/);
    const [user,nice,system,idle,iowait=0,irq=0,softirq=0] = s.slice(1).map(Number);
    const total = user+nice+system+idle+iowait+irq+softirq;
    return Math.round(((total - idle) / total) * 100);
  } catch(e) { return 0; }
}

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
      const v4 = (addrs||[]).find(a => a.family==='IPv4');
      const st = netDev[name] || {};
      return { name, ip: v4?.address||'', mac: v4?.mac||'',
        rx_bytes: st.rx_bytes||0, tx_bytes: st.tx_bytes||0 };
    }).filter(n => n.ip);
}

function getSystem() {
  const cpus = os.cpus();
  const tot = os.totalmem(), free = os.freemem();
  const cfg = readConfig();
  return {
    hostname:    (cfg?.displayName) || os.hostname(),
    rawHostname: os.hostname(),
    platform:    os.platform(),
    arch:        os.arch(),
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

const server = http.createServer(async (req, res) => {
  const url = req.url.split('?')[0];

  // CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Cache-Control', 'no-cache');

  if (req.method === 'OPTIONS') { res.writeHead(204); res.end(); return; }

  const json = (data, code=200) => {
    res.writeHead(code, {'Content-Type':'application/json'});
    res.end(JSON.stringify(data));
  };

  try {
    if (url === '/api/config' && req.method === 'GET') {
      json(readConfig() || {});
    }
    else if (url === '/api/config' && req.method === 'POST') {
      const data = await readBody(req);
      const size = writeConfig(data);
      console.log(`[config] saved ${size} bytes → ${CFG_FILE}`);
      json({ ok: true, saved: new Date().toISOString(), size });
    }
    else if (url === '/api/containers') {
      json(getContainers());
    }
    else if (url === '/api/system') {
      json(getSystem());
    }
    else if (url.startsWith('/api/ping')) {
      const hosts = new URL('http://x'+req.url).searchParams.get('hosts');
      const list  = (hosts||'').split(',').map(h=>h.trim()).filter(Boolean);
      if (!list.length) { json({ error: 'no hosts' }, 400); return; }
      json(await Promise.all([...new Set(list)].map(pingHost)));
    }
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
          try { fs.accessSync(DATA_DIR, fs.constants.W_OK); return true; } catch(e) { return false; }
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

server.listen(PORT, '0.0.0.0', () => {
  ensureDataDir();
  const exists = fs.existsSync(CFG_FILE);
  console.log(`[homedash-api] v${VERSION} listening on :${PORT}`);
  console.log(`[homedash-api] config: ${CFG_FILE} (${exists ? 'exists' : 'new'})`);
});

process.on('SIGTERM', () => server.close(() => process.exit(0)));
process.on('SIGINT',  () => server.close(() => process.exit(0)));
