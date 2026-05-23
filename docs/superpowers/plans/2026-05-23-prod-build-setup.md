# Prod Build Setup Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Productie-build van de app als "Uren assistent" naast de dev-build laten draaien, met eigen icoon (zonder moersleutel-badge) en `make build-prod` target die de app direct in `/Applications/` installeert.

**Architecture:** Twee Tauri config-bestanden (`tauri.conf.json` voor dev, `tauri.prod.conf.json` voor prod) met eigen `productName`, `identifier`, en icoon-map. Iconen worden gegenereerd vanuit twee bronbestanden via `tauri icon`. De app-titel in de UI komt uit `VITE_APP_TITLE` (gezet via `.env.production`).

**Tech Stack:** Tauri 2, Vite, React, TypeScript, macOS, ImageMagick (voor icoon-generatie)

---

## Bestandsoverzicht

| Actie | Bestand | Verantwoordelijkheid |
|---|---|---|
| Aanmaken | `src-tauri/tauri.prod.conf.json` | Prod Tauri config |
| Aanmaken | `src-tauri/app-icon-prod.png` | Prod icoon bronbestand (512x512, schoon) |
| Aanmaken | `src-tauri/app-icon-dev.png` | Dev icoon bronbestand (512x512, met moersleutel) |
| Aanmaken | `src-tauri/icons-prod/` | Gegenereerde prod icoon-set |
| Bijwerken | `src-tauri/icons/` | Dev iconen vervangen met moersleutel-versie |
| Aanmaken | `.env.production` | Zet `VITE_APP_TITLE=Uren assistent` |
| Aanmaken | `.env.development` | Zet `VITE_APP_TITLE=Uren schrijven (dev)` |
| Bijwerken | `index.html` | `<title>` leest uit env-var via Vite |
| Bijwerken | `Makefile` | `build-prod` en `build-dev` targets toevoegen |
| Bijwerken | `AGENTS.md` | Documenteer omgevingen, targets, icoon-workflow |

---

### Task 1: Iconen aanmaken

**Doel:** Twee bronbestanden aanmaken (512x512 PNG) — prod schoon, dev met moersleutel-badge — en beide icoon-sets genereren.

**Files:**
- Aanmaken: `src-tauri/app-icon-prod.png`
- Aanmaken: `src-tauri/app-icon-dev.png`
- Aanmaken: `src-tauri/icons-prod/` (gegenereerd)
- Bijwerken: `src-tauri/icons/` (gegenereerd)

- [ ] **Stap 1: Kopieer huidig icoon als prod-bronbestand**

```bash
cp src-tauri/icons/icon.png src-tauri/app-icon-prod.png
```

- [ ] **Stap 2: Maak dev-bronbestand aan met moersleutel-badge**

Gebruik ImageMagick om een gele moersleutel-emoji als badge rechtsboven toe te voegen. Controleer eerst of ImageMagick beschikbaar is:

```bash
which convert || brew install imagemagick
```

Maak dan het dev-icoon:

```bash
# Maak een gele moersleutel-badge (80x80) rechtsboven op het icoon
convert src-tauri/app-icon-prod.png \
  \( -size 160x160 xc:none \
     -fill '#F59E0B' \
     -draw 'circle 80,80 80,20' \
     -gravity center \
     -font "Apple-Color-Emoji" -pointsize 90 \
     -fill white \
     -annotate 0 '🔧' \
  \) \
  -gravity NorthEast \
  -geometry +10+10 \
  -composite \
  src-tauri/app-icon-dev.png
```

Als de emoji-font niet werkt, gebruik dan een fallback met een oranje cirkel:

```bash
convert src-tauri/app-icon-prod.png \
  \( -size 140x140 xc:none \
     -fill '#F59E0B' \
     -draw 'circle 70,70 70,5' \
     -fill '#1C1C1E' \
     -draw 'rectangle 55,60 85,80' \
     -draw 'rectangle 62,45 78,95' \
  \) \
  -gravity NorthEast \
  -geometry +15+15 \
  -composite \
  src-tauri/app-icon-dev.png
```

Controleer het resultaat:

```bash
open src-tauri/app-icon-dev.png
```

- [ ] **Stap 3: Genereer prod icoon-set**

```bash
mkdir -p src-tauri/icons-prod
npx tauri icon src-tauri/app-icon-prod.png --output src-tauri/icons-prod
```

Verwacht output: meerdere PNG-bestanden + `.icns` + `.ico` in `src-tauri/icons-prod/`.

- [ ] **Stap 4: Genereer dev icoon-set (vervangt huidige icons/)**

```bash
npx tauri icon src-tauri/app-icon-dev.png --output src-tauri/icons
```

Verwacht: `src-tauri/icons/icon.png` is nu het dev-icoon met moersleutel.

- [ ] **Stap 5: Commit**

```bash
git add src-tauri/app-icon-prod.png src-tauri/app-icon-dev.png src-tauri/icons/ src-tauri/icons-prod/
git commit -m "feat: add dev and prod icons (dev has wrench badge)"
```

---

### Task 2: Prod Tauri config aanmaken

**Doel:** `tauri.prod.conf.json` aanmaken met eigen naam, identifier, iconen, en zonder devtools.

**Files:**
- Aanmaken: `src-tauri/tauri.prod.conf.json`

- [ ] **Stap 1: Maak prod config aan**

Maak `src-tauri/tauri.prod.conf.json` aan met de volgende inhoud:

```json
{
  "$schema": "https://schema.tauri.app/config/2",
  "productName": "Uren assistent",
  "version": "0.1.0",
  "identifier": "com.guus.uren-assistent",
  "build": {
    "beforeDevCommand": "npm run dev",
    "devUrl": "http://localhost:1420",
    "beforeBuildCommand": "npm run build",
    "frontendDist": "../dist"
  },
  "app": {
    "windows": [
      {
        "title": "Uren assistent",
        "width": 800,
        "height": 600,
        "devtools": false
      }
    ],
    "security": {
      "csp": null
    }
  },
  "bundle": {
    "active": true,
    "targets": "all",
    "icon": [
      "icons-prod/32x32.png",
      "icons-prod/128x128.png",
      "icons-prod/128x128@2x.png",
      "icons-prod/icon.icns",
      "icons-prod/icon.ico"
    ]
  }
}
```

- [ ] **Stap 2: Verifieer dat de config valide JSON is**

```bash
node -e "JSON.parse(require('fs').readFileSync('src-tauri/tauri.prod.conf.json', 'utf8')); console.log('OK')"
```

Verwacht: `OK`

- [ ] **Stap 3: Commit**

```bash
git add src-tauri/tauri.prod.conf.json
git commit -m "feat: add tauri.prod.conf.json for production build"
```

---

### Task 3: App-titel doorvoeren via env-vars

**Doel:** `index.html` en UI gebruiken `VITE_APP_TITLE` zodat prod-build "Uren assistent" toont en dev een duidelijke dev-naam.

**Files:**
- Aanmaken: `.env.production`
- Aanmaken: `.env.development`
- Bijwerken: `index.html`

- [ ] **Stap 1: Maak `.env.production` aan**

```
VITE_APP_TITLE=Uren assistent
```

- [ ] **Stap 2: Maak `.env.development` aan**

```
VITE_APP_TITLE=Uren schrijven (dev)
```

- [ ] **Stap 3: Controleer of `.env.production` en `.env.development` in `.gitignore` staan**

```bash
grep "\.env" .gitignore
```

Als ze er staan (bijv. via `.env*`), voeg dan expliciete uitzondering toe zodat ze wél gecommit worden (dit zijn geen secrets):

```bash
# In .gitignore — voeg toe als `.env*` alles uitsluit:
# !.env.production
# !.env.development
```

Controleer `.gitignore`:

```bash
cat .gitignore | grep env
```

Als `.env.production` en `.env.development` al worden uitgesloten, pas `.gitignore` aan:

```bash
# Voeg toe aan .gitignore:
!.env.production
!.env.development
```

- [ ] **Stap 4: Update `index.html` om `VITE_APP_TITLE` te gebruiken**

Vervang de huidige `<title>`:

```html
<!-- Oud: -->
<title>Tauri + React + Typescript</title>

<!-- Nieuw: -->
<title>%VITE_APP_TITLE%</title>
```

Vite vervangt `%VITE_APP_TITLE%` automatisch bij build.

- [ ] **Stap 5: Verifieer lokaal dat de dev-title werkt**

```bash
npm run dev &
sleep 3
curl -s http://localhost:1420 | grep "<title>"
# Verwacht: <title>Uren schrijven (dev)</title>
kill %1
```

- [ ] **Stap 6: Commit**

```bash
git add .env.production .env.development index.html .gitignore
git commit -m "feat: use VITE_APP_TITLE env var for app title (prod/dev)"
```

---

### Task 4: Makefile uitbreiden

**Doel:** `build-prod` en `build-dev` targets toevoegen aan de Makefile.

**Files:**
- Bijwerken: `Makefile`

- [ ] **Stap 1: Voeg targets toe aan Makefile**

Voeg het volgende toe na de bestaande `clean` target:

```makefile
.PHONY: prepare run clean build-prod build-dev

build-prod: prepare
	npm run build
	npx tauri build --config src-tauri/tauri.prod.conf.json
	cp -rf "src-tauri/target/release/bundle/macos/Uren assistent.app" /Applications/
	@echo "Uren assistent geïnstalleerd in /Applications/"

build-dev: prepare
	npm run build
	npx tauri build
	@echo "Dev build klaar in src-tauri/target/release/bundle/"
```

Let op: de inspringing in Makefile moet een **tab** zijn, geen spaties.

- [ ] **Stap 2: Verifieer Makefile syntax**

```bash
make --dry-run build-prod 2>&1 | head -20
```

Verwacht: toont de commando's zonder ze uit te voeren, geen syntax errors.

- [ ] **Stap 3: Commit**

```bash
git add Makefile
git commit -m "feat: add build-prod and build-dev Makefile targets"
```

---

### Task 5: AGENTS.md updaten

**Doel:** Documenteer de twee omgevingen, Makefile-targets, en icoon-workflow in AGENTS.md.

**Files:**
- Bijwerken: `AGENTS.md`

- [ ] **Stap 1: Voeg sectie toe aan AGENTS.md**

Voeg het volgende toe vóór de "Common Pitfalls" sectie:

```markdown
## Bouwen & Omgevingen

De app heeft twee configuraties die naast elkaar kunnen draaien:

| Omgeving | Config | App-naam | Bundle ID |
|---|---|---|---|
| Dev | `src-tauri/tauri.conf.json` | uren-schrijven | com.guus.uren-schrijven |
| Prod | `src-tauri/tauri.prod.conf.json` | Uren assistent | com.guus.uren-assistent |

### Makefile-targets

- `make run` — start de dev-server (hot reload, devtools aan)
- `make build-prod` — bouwt prod-release en installeert in `/Applications/` (overschrijft vorige)
- `make build-dev` — bouwt installeerbare dev-app

### App-titel

De zichtbare app-naam komt uit `VITE_APP_TITLE`:
- `.env.production` → `Uren assistent` (gebruikt door `tauri build --config tauri.prod.conf.json`)
- `.env.development` → `Uren schrijven (dev)` (gebruikt door `tauri dev`)

### Iconen

- Dev-icoon: `src-tauri/app-icon-dev.png` (512x512, met gele moersleutel-badge)
- Prod-icoon: `src-tauri/app-icon-prod.png` (512x512, schoon)
- Gegenereerde sets: `src-tauri/icons/` (dev) en `src-tauri/icons-prod/` (prod)

Na een icoon-wijziging regenereer je de sets:

```bash
npx tauri icon src-tauri/app-icon-dev.png --output src-tauri/icons
npx tauri icon src-tauri/app-icon-prod.png --output src-tauri/icons-prod
```
```

- [ ] **Stap 2: Commit**

```bash
git add AGENTS.md
git commit -m "docs: document prod/dev build environments in AGENTS.md"
```

---

### Task 6: End-to-end verificatie

**Doel:** Bevestigen dat de prod-build slaagt en de app correct geïnstalleerd wordt.

- [ ] **Stap 1: Verifieer dat dev nog werkt**

```bash
make --dry-run run
# Verwacht: npm install + npm run tauri dev
```

- [ ] **Stap 2: Voer prod-build uit**

```bash
make build-prod
```

Verwacht:
- Vite build slaagt
- Tauri build slaagt (dit duurt enkele minuten)
- `src-tauri/target/release/bundle/macos/Uren assistent.app` bestaat
- App is gekopieerd naar `/Applications/Uren assistent.app`

- [ ] **Stap 3: Verifieer installatie**

```bash
ls /Applications/ | grep "Uren"
# Verwacht: Uren assistent.app
```

Open de app en controleer:
- App-naam in de menubalk is "Uren assistent"
- Icoon in Dock is zonder moersleutel
- Devtools zijn niet beschikbaar (geen "Inspect Element" in contextmenu)

- [ ] **Stap 4: Verifieer dat dev-app apart blijft staan**

```bash
ls /Applications/ | grep -i uren
# Verwacht: alleen "Uren assistent.app" (de dev-app draait via tauri dev, niet geïnstalleerd)
```

- [ ] **Stap 5: Finale commit als alles werkt**

```bash
git status
# Verwacht: working tree clean (alles al gecommit in vorige tasks)
```
