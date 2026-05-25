# Design: Twee-kolommen BookingModal

**Datum:** 2026-05-25  
**Probleem:** De BookingModal is te klein — de EvidencePanel neemt zoveel verticale ruimte in dat de gebruiker moet scrollen om Project/Dienst/Urensoort te bereiken.  
**Oplossing:** Twee-kolommen layout waarbij formulier en bewijs naast elkaar staan.

---

## Layout

Modal breedte: **720px** (was ~440px).

### Header (volle breedte)
- Titel (blockName of prop, default "Uren boeken")
- Subheader: datum, tijdspan, duur, confidence badge (conditioneel op evidenceBlock)
- Sluitknop (×) rechts

### Body (twee kolommen, 50/50)

| Linkerkolom | Rechterkolom |
|---|---|
| Tijdvelden (Van / Tot) | EvidencePanel |
| Project selector | |
| Dienst selector | |
| Urensoort selector | |
| Toelichting (optioneel) | |
| Foutmelding (conditioneel) | |
| Boeken-knop | |

Kolommen gescheiden door een verticale lijn (`border-right`).  
Beide kolommen `align-items: stretch` zodat ze gelijke hoogte hebben.

### Fallback: geen evidenceBlock
Als er geen `evidenceBlock` prop is, valt het modal terug naar de smalle single-column layout (geen lege rechterkolom).

---

## Scrollgedrag

- **Linkerkolom**: geen interne scroll — alle velden passen altijd in beeld
- **Rechterkolom**: `overflow-y: auto` + `max-height: 100%` — EvidencePanel scrolt intern als er veel items zijn
- Het modal zelf heeft een `max-height` (bijv. 85vh) met `overflow: hidden` zodat de body nooit buiten beeld valt

---

## Geraakte bestanden

| Bestand | Wijziging |
|---|---|
| `src/ui/pages/BookingModal.tsx` | Flex-row wrapper conditioneel op `evidenceBlock`, `max-width` verhoogd naar 720px |
| `src/ui/components/EvidencePanel.tsx` | `overflow-y: auto`, `max-height: 100%` toegevoegd |

**Geen wijzigingen** aan domein-, applicatie- of infrastructuurlaag.

---

## Niet in scope

- Responsiviteit / mobiel (Tauri desktop-only app)
- Animaties of transitie bij in/uitklappen
- Wijzigingen aan de volgorde of inhoud van de formuliervelden
