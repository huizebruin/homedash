# homedash

# home//dash v7.1

Browser startpagina voor je homelab — draait in Docker.

## Installatie

```bash
# Uitpakken
unzip homedash-v71.zip && cd homedash

# Eerste keer bouwen en starten
docker compose up -d --build

# Open in browser
http://server-ip:1000
```

## Update uitrollen (config blijft bewaard)

```bash
docker compose up -d --build
```

De config staat in `./data/config.json` — zichtbaar naast dit bestand.
Die map wordt **niet** overschreven bij een update.

## Bestandsstructuur

```
homedash/
├── data/
│   └── config.json        ← al je instellingen, agenda, diensten
├── frontend/
│   ├── index.html
│   ├── logo.png
│   └── ...
├── api/
│   └── server.js
└── docker-compose.yml
```

## Configuratie op andere PC's

Open je browser en ga naar:
`http://server-ip:1000`

Alle instellingen worden automatisch van de server geladen.

## Debuggen

### Config controleren
```bash
cat ./data/config.json
```

### API testen
```bash
# Health check (toont of config bestaat)
curl http://server-ip:3001/health

# Config ophalen
curl http://server-ip:3001/api/config

# Config opslaan (test)
curl -X POST http://server-ip:3001/api/config \
  -H "Content-Type: application/json" \
  -d '{"test": true}'
```

### Container logs
```bash
docker logs homedash-api --tail 50
docker logs homedash-frontend --tail 20
```

### Config backup/restore
```bash
# Backup
cp ./data/config.json ./data/config-backup-$(date +%Y%m%d).json

# Restore
cp ./data/config-backup-20260101.json ./data/config.json
docker compose restart homedash-api
```
