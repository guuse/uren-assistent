# BookingModal Herontwerp — Spec

**Datum:** 2026-05-23
**Status:** Goedgekeurd door gebruiker

---

## Probleemstelling

De huidige `BookingModal` toont een minimale "Wat je deed" strip met maximaal 5 URLs in gedempte tekst. De gebruiker kan niet op basis van de modal alleen bepalen welk werk er in een blok zit — hij moet zijn browsergeschiedenis erbij pakken om te dubbelchecken. Dit kost tijd en doorbreekt de flow.

## Doel

Na dit herontwerp moet de gebruiker **nooit meer zijn browsergeschiedenis erbij hoeven pakken**. Alle informatie die de LLM heeft gebruikt om het blok te classificeren is direct zichtbaar in de modal.

---

## Ontwerp

### Lay-out: "Alles altijd zichtbaar" (optie B)

De modal bestaat van boven naar beneden uit:

1. **Modal header** — blok-naam prominent, datum/tijd/confidence als subtitle
2. **Evidence blok** — URL-lijst + LLM-samenvatting, altijd open
3. **Formuliervelden** — tijd, project, dienst, toelichting
4. **Boeken-knop**

### 1. Modal header

- **Titel:** `block.blockName` (bijv. "Hosting & DevOps"), niet meer de generieke string "Losse browser-activiteit"
- **Subtitle:** `{datum} · {startTime}–{endTime} · {hours}u · {confidence-badge}`
- Confidence badge: `background:#1a3a1a; color:#5a8a6a` met tekst `{Math.round(confidence * 100)}% zeker` (of `Cache` als `origin === 'cache'`)
- Sluit-knop rechts

### 2. Evidence blok

Achtergrond `#1c1917`, border `#2e2a26`, border-radius 8px.

#### 2a. Kopregel

```
Bezochte pagina's    {N} · {startTime}–{endTime}
```

Kleur: `#4a4540`, 9px uppercase.

#### 2b. URL-lijst

- `max-height` zodat ~6 items zichtbaar zijn, daarna `overflow-y: auto`
- Elke rij: domein-initiaal-blokje + URL + paginatitel
- **Domein-initiaal** (26×26px, border-radius 5px):
  - Harborn-domeinen (`*.harborn.*`): `background:#1a3a1a; color:#5a8a6a`
  - Auth/externe domeinen (`accounts.*`, `auth.*`, `login.*`, `sso.*`): `background:#3a2e10; color:#a07848`
  - Overig: `background:#252220; color:#7a7268`
  - Letter: eerste letter van de hostname, uppercase
- **URL-tekst:** `color:#e8e2d9`, 11px, truncate met ellipsis
- **Paginatitel:** `color:#7a7268`, 10px, eronder

Data-mapping:
- URLs komen uit `evidenceBlock.rawUrls` (of `evidenceBlock.urls` als fallback)
- Titels komen uit `evidenceBlock.rawTitles` (of `evidenceBlock.titles` als fallback)
- Toon alle items (geen harde afkap), de max-height + scroll regelt de lengte visueel

#### 2c. LLM-samenvatting

Direct onder de URL-lijst, gescheiden door een `border-top: 1px solid #2e2a26`:

- Groene verticale streep links: `width:2px; background:#5a8a6a`
- Label: `#4a4540`, 8px uppercase "LLM samenvatting"
- Tekst: `block.summary`, `color:#94a3b8`, 11px italic, `line-height:1.5`
- Achtergrond: `#1c1917`

### 3. Formuliervelden

Volgorde en gedrag ongewijzigd ten opzichte van huidig:

- **Datum-veld verwijderd** — zit al in de header, herhaling is overbodig
- Van / Tot: naast elkaar in grid (2 kolommen)
- Project: `FieldSelector`, highlight (`border: 2px solid #6366f1`) als leeg
- Dienst: `FieldSelector`, zichtbaar na project-keuze, highlight als leeg
- Urensoort: `FieldSelector`, zichtbaar na dienst-keuze
- Toelichting: tekstinput, prepopulated met `block.note ?? block.summary`

Input-achtergrond: `#171512`, border: `#3e3a36`, focus-border: `#5a5248`.

### 4. Boeken-knop

Ongewijzigd: `background:#e8e2d9; color:#1c1917`, disabled als `!canBook`.

---

## Geraakte bestanden

| Bestand | Wijziging |
|---|---|
| `src/ui/pages/BookingModal.tsx` | Header herschrijven, datum-veld verwijderen, `EvidencePanel` vervangen door nieuw `EvidenceBlock` |
| `src/ui/components/EvidencePanel.tsx` | Volledig herschrijven naar nieuw ontwerp (of vervangen door `EvidenceBlock`) |

> Geen wijzigingen in domain, application, of infrastructure lagen — dit is puur UI.

---

## Kleurpalet (alleen bestaande tokens)

| Element | Kleur |
|---|---|
| Modal bg | `#252220` |
| Evidence bg | `#1c1917` |
| Input bg | `#171512` |
| Border | `#2e2a26` |
| Input border | `#3e3a36` |
| Primaire tekst | `#e8e2d9` |
| Muted tekst | `#7a7268` |
| Zeer muted | `#4a4540` |
| LLM-tekst | `#94a3b8` |
| Groen accent | `#5a8a6a` / `#1a3a1a` |
| Amber accent | `#a07848` / `#3a2e10` |
| Indigo (required) | `#6366f1` / `#a5b4fc` |

---

## Niet in scope

- Bewerken van classificatie vanuit de modal (aparte feature)
- Inladen van extra browsergeschiedenis vanuit de modal
- Animaties of transities anders dan bestaande `transition-colors`
