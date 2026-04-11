# Changelog — home//dash

Alle versies en wijzigingen worden hier bijgehouden.
Formaat: [Semantic Versioning](https://semver.org/lang/nl/)

---

## [8.0.0] — 2026-04-11

### Nieuw
- 📆 **Kalender-feeds tab** — Google Calendar (iCal/webcal) en andere `.ics` feeds koppelen via de UI
- ℹ **Over-tab** in instellingen — informatie over het project, links naar GitHub, changelog, licentie
- 🛡 API health-check toont config-pad en bestandsgrootte in de Over-tab
- 🔗 Link naar GitHub repository in de statusbalk
- 📝 Verwijzingen naar maker (huizebruin) en AI-assistentie (Claude)
- Externe kalender-events worden apart getoond met 📆 markering
- iCal parser ingebouwd voor VEVENT parsing
- 30+ iconen in de icon-picker (diensten)

### Gewijzigd
- Standaard config leeg (geen voorbeelddata) — GitHub-klaar
- `.gitignore` toegevoegd — `data/config.json` wordt nooit gecommit
- `data/` map als bind mount zodat config zichtbaar is naast `docker-compose.yml`
- Nginx proxy gefixed: `proxy_pass` zonder trailing slash zodat volledig pad behouden blijft
- POST body forwarding correct geconfigureerd in nginx
- Config laadt nu altijd van server (met localStorage als fallback)
- Statusbalk toont opslaan-status (⏳ / ✓ / ⚠)
- Versie `8.0.0`

### Technisch
- `server.js`: `displayName` support, verbeterde logging, health endpoint uitgebreid
- `docker-compose.yml`: named volume → bind mount `./data`
- `frontend/Dockerfile`: `COPY logo.png` toegevoegd

---

## [7.1.0] — 2026-04-11

### Nieuw
- 📱 **Volledige mobiele responsive** — 3 breakpoints: desktop/tablet/mobiel/klein
- Tablet: 2-koloms grid, rechterkolom onder de containers
- Mobiel: single column, zoekbalk op tweede rij, bottom sheet modals
- Instellingen modal als bottom sheet op mobiel

### Gewijzigd
- Ping-intervallen uitgebreid: 10 min en 15 min toegevoegd
- Header grid verbeterd voor kleine schermen

---

## [7.0.0] — 2026-04-11

### Nieuw
- 💾 **Config persistent opgeslagen op server** via `/data/config.json`
- Config overleeft `docker compose up --build` updates
- LocalStorage als automatische fallback als server niet bereikbaar is
- Opslaan-status zichtbaar in statusbalk
- 🏷 **Logo** (PNG) zichtbaar in header, met fallback naar tekst
- 🔍 **Zoekbalk gecentreerd** in header via CSS 3-koloms grid
- 🖥 **Weergavenaam** voor server (vervangt technische hostname)
- 📡 **Ping** — kleine statusdot per dienst (groen/rood/oranje)
- Ping aan/uit knop in diensten-balk
- 🎨 **Icoon-picker** in instellingen voor diensten
- Ping-interval instelbaar: 30s/1min/2min/5min/10min/15min

### Gewijzigd
- Docker named volume → bind mount `./data`
- Nginx `proxy_pass` zonder trailing slash (fix voor POST requests)
- Container cards compacter — minder lege ruimte
- Diensten & IP-adressen paneel neemt resterende hoogte

---

## [6.0.0] — 2026-04-10

### Nieuw
- Config opslaan via API (`POST /api/config`)
- Health endpoint met config-info
- Logo integratie (PNG)
- LocalStorage backup bij server-fout

### Gewijzigd
- `server.js` herschreven met betere error handling
- Docker volume voor data persistentie

---

## [5.1.0] — 2026-04-10

### Nieuw
- 🖧 **Diensten & IP-adressen** paneel onder docker containers
- Diensten als kaartjes-grid met kleurcode per kaart
- Klik op kaart opent URL/IP direct
- Beheer via ⚙ Instellingen

### Gewijzigd
- Instellingen: 4 tabs (Algemeen / Diensten / Agenda / Thema)
- `svc-row` in instellingen: icoon · naam · IP · poort · omschrijving

---

## [5.0.0] — 2026-04-09

### Nieuw
- 📋 **Agenda** met terugkerende events (wekelijks/maandelijks/jaarlijks)
- Agenda events met kleur, tijd, herhaling
- Kalender-dots voor dagen met events
- Thema automatisch (dag/nacht op basis van tijdstip)
- Licht thema volledig uitgewerkt
- Zoekgeschiedenis (klik op zoekbalk)
- Sneltoets `/` focust zoekbalk

### Gewijzigd
- Instellingen 3 tabs: Algemeen / Agenda / Thema
- Ping-interval instelbaar
- Container sortering instelbaar
- Servernaam (weergavenaam) configureerbaar

---

## [4.0.0] — 2026-04-09

### Nieuw
- 🔍 **Zoekbalk** centraal als browser startpagina functie
- Keuze uit 6 zoekmachines (Google, DuckDuckGo, Bing, Brave, Startpage, YouTube)
- URL-detectie: typ een URL en navigeer direct
- ⚙ **Instellingen modal** met tabbladen
- Locatie configureerbaar voor weer

### Gewijzigd
- Snelkoppelingen verwijderd
- Nieuws verwijderd (CORS-problemen)
- Layout: 3-koloms grid
- Containers kleiner en compacter

---

## [3.0.0] — 2026-04-08

### Nieuw
- 3-koloms layout: systeem | containers | weer+kalender+nieuws
- Kalender widget
- Nieuws (NOS RSS)
- Snelkoppelingen grid

### Gewijzigd
- Systeem panel uitgebreid: load avg, netwerk, schijven
- Containers als kaartjes met poort-pills

---

## [2.0.0] — 2026-04-07

### Nieuw
- Docker containers overzicht
- Weer widget (Open-Meteo, gratis)
- Systeem stats (CPU, geheugen, uptime)
- Donker thema

---

## [1.0.0] — 2026-04-06

### Eerste versie
- Basisopzet Docker + nginx + Node.js API
- Docker containers lijst
- Systeem informatie
- Proof of concept

---

*Gemaakt door [huizebruin](https://github.com/huizebruin) met AI-assistentie*
