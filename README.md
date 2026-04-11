# 🏠 home//dash

**Browser startpagina voor je homelab** — één scherm met alles wat je nodig hebt.

> Gemaakt door [huizebruin](https://github.com/huizebruin) met AI-assistentie (Claude door Anthropic)

[![License: MIT](https://img.shields.io/badge/License-MIT-green.svg)](LICENSE)
[![Docker](https://img.shields.io/badge/Docker-ready-blue.svg)](docker-compose.yml)

## Wat zie je?

- **Systeem stats** — CPU, geheugen, uptime, load, netwerk, schijven
- **Docker containers** — status en klikbare poorten
- **Diensten & IP-adressen** — eigen kaartjes met ping-check
- **Weer** — 5-daags via Open-Meteo (gratis, geen key)
- **Kalender + Agenda** — events, herhaling, Google Calendar koppelen
- **Zoekbalk** — kies zoekmachine, zoekgeschiedenis

## Installatie

```bash
git clone https://github.com/huizebruin/homedash.git
cd homedash
docker compose up -d --build
# open: http://server-ip:1000
```

## Update (data blijft bewaard)

```bash
docker compose up -d --build
```

Config staat in `./data/config.json` — nooit overschreven bij updates.

## Andere PC's in netwerk

Stel in ⚙ Algemeen → API URL: `http://nas-ip:3001`
Dan laadt elke browser dezelfde config van de server.

## Google Calendar koppelen

1. calendar.google.com → ⚙ → kalender kiezen
2. Scroll naar "Publiek adres in iCal-formaat"
3. Kopieer URL → ⚙ Kalenders in home//dash

## Debug

```bash
cat ./data/config.json
curl http://localhost:3001/health
docker logs homedash-api --tail 50
```

## Credits

- Gemaakt door **Wobbe Bruin** ([huizebruin](https://github.com/huizebruin))
- Met AI-assistentie van **Claude** (Anthropic)
- Weer: [Open-Meteo](https://open-meteo.com/)

## Licentie

[MIT License](LICENSE)
