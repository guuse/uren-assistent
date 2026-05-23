# Design: Production Build Setup

**Datum:** 2026-05-23  
**Status:** Goedgekeurd

---

## Doel

De app moet in twee smaken naast elkaar kunnen draaien op macOS:

- **Dev** — huidige app, gestart via `make run` of `tauri dev`
- **Prod** — installeerbare release-build als "Uren assistent", los van de dev-app

Rebuilden van prod vervangt altijd de vorige prod-installatie.

---

## Config-structuur

Twee afzonderlijke Tauri config-bestanden:

| Bestand | Omgeving | productName | identifier | Icoon-map |
|---|---|---|---|---|
| `src-tauri/tauri.conf.json` | Dev | `uren-schrijven` | `com.guus.uren-schrijven` | `icons/` |
| `src-tauri/tauri.prod.conf.json` | Prod | `Uren assistent` | `com.guus.uren-assistent` | `icons-prod/` |

De prod-config erft alle overige instellingen van de bestaande config (venstergrootte, CSP, plugins). Alleen `productName`, `identifier`, en de icoonpaden wijken af.

De `devtools` instelling wordt in de prod-config op `false` gezet.

---

## App-naam doorvoeren

"Uren assistent" als zichtbare naam wordt doorgevoerd in:

- `tauri.prod.conf.json` → `productName` en `app.windows[0].title`
- `index.html` → `<title>` (conditie: prod-build gebruikt env-var `VITE_APP_TITLE`)
- Eventuele hardcoded "uren-schrijven" strings in de UI die zichtbaar zijn voor de gebruiker

Technische identifiers (`package.json` `name`, `Cargo.toml` `name`) blijven ongewijzigd.

De app-titel in de UI wordt gelezen uit `import.meta.env.VITE_APP_TITLE` met fallback `"Uren assistent"`. De dev-build gebruikt de bestaande naam.

---

## Iconen

Twee bronbestanden (512x512 PNG):

- `src-tauri/app-icon-dev.png` — basisicoon met gele moersleutel-badge rechtsboven
- `src-tauri/app-icon-prod.png` — schoon basisicoon zonder badge

Gegenereerde icoon-sets via `tauri icon`:

- `src-tauri/icons/` — dev-set, gegenereerd vanuit `app-icon-dev.png`
- `src-tauri/icons-prod/` — prod-set, gegenereerd vanuit `app-icon-prod.png`

De icoonbestanden worden gecommit. Regenereren na icoon-wijziging:

```bash
tauri icon src-tauri/app-icon-dev.png --output src-tauri/icons
tauri icon src-tauri/app-icon-prod.png --output src-tauri/icons-prod
```

---

## Makefile

```makefile
build-prod: prepare
    npm run build
    tauri build --config src-tauri/tauri.prod.conf.json
    cp -rf "src-tauri/target/release/bundle/macos/Uren assistent.app" /Applications/

build-dev: prepare
    npm run build
    tauri build
```

- `make run` — ongewijzigd, start dev-server via `tauri dev`
- `make build-prod` — bouwt prod, kopieert naar `/Applications/`, overschrijft vorige versie
- `make build-dev` — bouwt installeerbare dev-app (optioneel, voor distributie)

---

## AGENTS.md update

De volgende sectie wordt toegevoegd aan AGENTS.md onder een nieuw kopje **"Bouwen & Omgevingen"**:

```markdown
## Bouwen & Omgevingen

De app heeft twee configuraties die naast elkaar kunnen draaien:

| Omgeving | Config | App-naam | Bundle ID |
|---|---|---|---|
| Dev | `src-tauri/tauri.conf.json` | uren-schrijven | com.guus.uren-schrijven |
| Prod | `src-tauri/tauri.prod.conf.json` | Uren assistent | com.guus.uren-assistent |

Makefile-targets:
- `make run` — start dev-server
- `make build-prod` — bouwt prod en installeert in /Applications/
- `make build-dev` — bouwt installeerbare dev-app

Iconen:
- Dev-icoon: `src-tauri/app-icon-dev.png` (met moersleutel-badge)
- Prod-icoon: `src-tauri/app-icon-prod.png` (schoon)
- Gegenereerde sets: `src-tauri/icons/` (dev) en `src-tauri/icons-prod/` (prod)
- Regenereer met: `tauri icon <bronbestand> --output <map>`
```

---

## Wat niet verandert

- `make run` en `tauri dev` — ongewijzigd
- Alle domein-, applicatie-, en infrastructuurcode
- Bestaande dev-iconen in `src-tauri/icons/`
- `Cargo.toml`, `package.json` technische namen
