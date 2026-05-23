# EvidencePanel Agenda-context — Spec

**Datum:** 2026-05-23
**Status:** Goedgekeurd door gebruiker

---

## Probleemstelling

De `EvidencePanel` toont alleen browsergeschiedenis. De LLM gebruikt echter ook agenda-items (`overlappingMeetings`) als context bij classificatie. Die context is nu volledig onzichtbaar in de modal, waardoor de gebruiker niet kan zien waarom een blok aan een bepaald project is gekoppeld als de reden in een vergadering zit.

## Doel

Agenda-items die overlappen met een concept-blok tonen in het context-blok van de modal, zodat de gebruiker altijd de volledige classificatie-context ziet.

---

## Ontwerp

### Twee scenario's

**Zonder `overlappingMeetings`** (of lege array): gedrag ongewijzigd. Kopregel "Bezochte pagina's", alleen URL-lijst + samenvatting.

**Met `overlappingMeetings`**: kopregel wordt "Context", blok bevat twee subsecties gescheiden door een lijn:
1. Browsing (URL-lijst)
2. Agenda (vergadering-lijst)
LLM-samenvatting blijft onderaan als conclusie.

---

### Kopregel

- **Zonder meetings:** `Bezochte pagina's` links, `{N} · {startTime}–{endTime}` rechts (huidig gedrag)
- **Met meetings:** `Context` links, `{startTime}–{endTime}` rechts

---

### Browsing-sectie (met meetings)

Sub-label: `Browsing ({N})` in `#4a4540`, 8px uppercase.
Dezelfde URL-rijen als nu (domein-initiaalblokje + URL + paginatitel).
Max-height en scroll ongewijzigd.

---

### Scheidingslijn

`border-top: 1px solid #2e2a26` op `margin: 0 12px` — loopt niet tot de rand van het blok.

---

### Agenda-sectie

Sub-label: `Agenda ({N})` in `#4a4540`, 8px uppercase.

Elke vergadering-rij:
- **Icoontje** 22×22px: `background: #1a2a3a`, `border: 1px solid #2e2a26`, border-radius 4px, emoji `📅`
- **Titel**: `color: #e8e2d9`, 10px, font-weight 500
- **Status-badge** naast de titel (inline):
  - `accepted` → `color: #5a8a6a`, tekst `✓ accepted`
  - `tentative` → `color: #a07848`, tekst `? tentative`
- **Sub-tekst**: `{startTime}–{endTime} · {deelnemers}` in `#7a7268`, 9px
  - Tijden: `CalendarEvent.start` en `.end` geformatteerd als `HH:mm`
  - Deelnemers: eerste voornaam uit email (`jan@company.com` → `Jan`), hoofdletter. Max 3 namen getoond, daarna `+N`.

---

### LLM-samenvatting

Ongewijzigd — altijd onderaan het blok als `summary` aanwezig is.

---

### Props-wijziging

`EvidencePanel` krijgt één extra prop:

```ts
meetings?: CalendarEvent[]   // van evidenceBlock.overlappingMeetings
```

`CalendarEvent` heeft: `id`, `title`, `start: Date`, `end: Date`, `attendees: string[]`, `status: 'accepted' | 'tentative'`

---

## Geraakte bestanden

| Bestand | Wijziging |
|---|---|
| `src/ui/components/EvidencePanel.tsx` | Meetings prop toevoegen, conditionele rendering van agenda-sectie |
| `src/ui/pages/BookingModal.tsx` | `meetings={evidenceBlock.overlappingMeetings}` doorgeven aan EvidencePanel |
| `src/ui/components/EvidencePanel.test.tsx` | Tests voor agenda-sectie toevoegen |

> Geen wijzigingen in domain, application, of infrastructure lagen.

---

## Kleurpalet (alleen bestaande + één nieuwe token)

| Element | Kleur | Bron |
|---|---|---|
| Agenda-icoontje bg | `#1a2a3a` | Nieuw (blauwachtig donker, onderscheidt van browsing) |
| Agenda-icoontje border | `#2e2a26` | Bestaand |
| Accepted status | `#5a8a6a` | Bestaand groen |
| Tentative status | `#a07848` | Bestaand amber |
| Sub-label | `#4a4540` | Bestaand |
| Deelnemers tekst | `#7a7268` | Bestaand |

---

## Niet in scope

- Klikbaar maken van vergaderingen
- Vergaderingen als bron voor project-suggesties
- Tonen van vergadering-beschrijving of locatie
