# Evidence Panel in ImportBlockModal

**Datum:** 2026-05-21  
**Status:** Goedgekeurd

---

## Probleem

De import flow classificeert browser history blokken via de LLM en toont de gebruiker het resultaat. De gebruiker moet dit nakijken, maar heeft onvoldoende context in de tool om te verifiëren of de classificatie klopt. Hij moet zijn browser history apart openen om te zien wat hij op dat moment deed. De ruwe data (paginatitels, URLs) wordt wel naar de LLM gestuurd maar verdwijnt daarna uit de UI.

---

## Doel

De gebruiker kan een LLM-voorstel beoordelen zonder een extra venster te openen. De tool wordt een companion: LLM stelt voor, gebruiker ziet de basis van het voorstel en bevestigt of past aan.

---

## Oplossing

Een altijd-zichtbaar "Bewijs" paneel bovenaan de `ImportBlockModal`, dat de ruwe browser data toont waarop de LLM zijn classificatie baseerde.

### Wat het paneel toont

- **Paginatitels** — de echte `document.title` waarden uit de browser history, max 5 stuks, afgekapt op 80 tekens
- **Domeinen + pad** — de URL zonder query string en fragment, zodat het leesbaar blijft maar de locatie duidelijk is
- **Kalenderevents** — eventueel overlappende agenda-items (titel + tijdstip), indien aanwezig voor dit blok

### Layout

```
┌─────────────────────────────────────────────┐
│ Wat je deed                                 │
│ ─────────────────────────────────────────── │
│ • github.com/org/repo/pulls                 │
│   "Review: Add payment flow – Pull Req..."  │
│ • linear.app/team/EIN-123                   │
│   "EIN-123 Implement checkout"              │
│ • github.com/org/repo/pull/42/files         │
│   "Files changed · Pull Request #42"        │
│                                             │
│ 📅 10:00–11:00  Standup Eindhoven Doet      │
├─────────────────────────────────────────────┤
│ Voorstel LLM                                │
│ Project: Eindhoven Doet                     │
│ Service: Development                        │
│ ...bestaande velden...                      │
└─────────────────────────────────────────────┘
```

---

## Datawijzigingen

### Domain — `ClassifiedBlock`

`src/domain/entities/ClassifiedBlock.ts` uitbreiden met:

```ts
rawTitles: string[]   // paginatitels uit browser history, max 5
rawUrls: string[]     // URLs zonder query string/fragment, max 5
```

Deze velden zijn optioneel (`string[] | undefined`) voor backwards compatibility met bestaande gecachte blokken.

### Infrastructure — `CopilotRepository`

In `classifyDay()` (en `classify()` als fallback): na het parsen van de LLM output, de `rawTitles` en `rawUrls` vullen vanuit de input block data die al beschikbaar is vóór de LLM call. Geen extra API calls nodig.

### UI — `ImportBlockModal`

Bovenaan de modal een `EvidencePanel` component toevoegen dat `rawTitles` en `rawUrls` ontvangt en weergeeft. Het paneel is altijd zichtbaar (niet ingeklapt). Indien beide arrays leeg/undefined zijn, wordt het paneel niet getoond.

---

## Wat er NIET verandert

- LLM prompts blijven ongewijzigd
- De rest van de modal (project/service dropdowns, tijdpickers, notitieveld) blijft ongewijzigd
- De bulk-booking flow verandert niet
- Cache-logica verandert niet

---

## Succescriteria

- Gebruiker kan voor elk blok in de modal zien welke pagina's en URLs de LLM heeft gezien
- Gebruiker hoeft geen apart venster te openen om het voorstel te beoordelen
- De modal is niet significant groter of drukker dan nu

---

## Componenten

| Component | Locatie | Wijziging |
|---|---|---|
| `ClassifiedBlock` | `src/domain/entities/ClassifiedBlock.ts` | Velden `rawTitles`, `rawUrls` toevoegen |
| `CopilotRepository` | `src/infrastructure/copilot/CopilotRepository.ts` | Velden vullen na LLM parse |
| `ImportBlockModal` | `src/ui/components/ImportBlockModal.tsx` | `EvidencePanel` toevoegen bovenaan |
| `EvidencePanel` | `src/ui/components/EvidencePanel.tsx` | Nieuw component |
