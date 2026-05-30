---
name: uren-classificatie
description: De prompt-templates die de app naar Gemini stuurt om browser-activiteit, agenda en historie om te zetten in boekbare uren-blokken. Gebruik dit als je de classificatie-instructies, confidence-schaal of patroonherkenning wilt aanpassen.
---

# Uren-classificatie prompts

Deze skill bevat de prompt-context die `GeminiRepository` op runtime naar
Gemini (`gemini-2.5-flash`) stuurt. De prompt-tekst staat hier — los van de
code — zodat hij makkelijk te lezen, te reviewen en aan te passen is zonder de
TypeScript aan te raken.

## Bestanden

| Bestand | Gebruikt door | Doel |
| --- | --- | --- |
| `classify-blocks.md` | `GeminiRepository.classify()` | Classificeert losse browser-activiteit-blokken (Engelstalige instructie). |
| `classify-day.md` | `GeminiRepository.classifyDay()` | Classificeert een hele dag inclusief vergaderingen, cache-hints, GitHub/Linear-context en patroonherkenning (Nederlandstalig). |

## Placeholders

De templates zijn skeletten met `{{placeholder}}`-tokens. De app vult de
dynamische stukken in via `renderPrompt()` in
[`src/infrastructure/gemini/promptStore.ts`](../../../src/infrastructure/gemini/promptStore.ts).
De waarden zelf worden in `GeminiRepository` opgebouwd uit de echte data.

### `classify-blocks.md`
- `{{calendarContext}}` — agenda-items van de dag (`## Today's meetings` + lijst), of leeg.
- `{{projectList}}` — beschikbare projecten (`- id: "...", name: "..."`).
- `{{serviceList}}` — beschikbare diensten (`- id, name, projectId`).
- `{{blockList}}` — te verwerken browser-blokken (urlPattern, urls, titles, visitCount, evt. overlappende vergaderingen).

### `classify-day.md`
- `{{date}}` — de doeldatum (komt meerdere keren voor).
- `{{sections}}` — samengevoegde secties: vergaderingen, losse activiteit, cache-hints, dag-context (GitHub-commits + Linear-issues) en historische boekingen.
- `{{projectList}}` / `{{serviceList}}` — zoals hierboven.

## Hoe de app de templates laadt

`promptStore.loadPromptTemplate(name)` — **de repo wint zodra hij verandert**:
1. Bij het builden wordt de hash van elke gebundelde prompt (dit bestand, via
   Vite `?raw`-import) berekend en bewaard in `$APPDATA/prompts/.versions.json`.
2. Verschilt de gebundelde hash van wat er als laatst geseed is (of bestaat het
   bestand niet), dan schrijft hij de gebundelde default naar
   `$APPDATA/prompts/<name>.md` en gebruikt die.
3. Is de hash gelijk, dan wint de versie op schijf.

**Gevolg:** een gewijzigde prompt in deze repo komt vanzelf mee bij de volgende
build — geen handmatig verwijderen meer nodig. Tussen builds door kun je de
prompt nog steeds live aanpassen in `$APPDATA/prompts/<name>.md`; die tweak
blijft staan tot de repo-prompt verandert en hem overschrijft.

> Belangrijk: deze `.md` worden 1-op-1 als prompt naar Gemini gestuurd. Voeg
> géén YAML-frontmatter of markdown-uitleg toe aan `classify-blocks.md` /
> `classify-day.md` — alleen de kale prompt met placeholders.
