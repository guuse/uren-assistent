# Spec: Tijdlijn dichtheid — 80px/uur met halve-uur labels

**Datum:** 2026-05-23  
**Status:** Goedgekeurd

## Doel

De DayTimeline is te compact. Blokken van 30 minuten zijn nauwelijks leesbaar. De tijdlijn moet meer detail tonen per tijdseenheid, met scroll als gevolg. Dit is bewust gewenst.

## Wijzigingen

### 1. `HOUR_HEIGHT_PX`: 48 → 80

In `src/ui/components/DayTimeline.tsx`:

```ts
const HOUR_HEIGHT_PX = 80
```

Gevolg:
- 10 uur (08:00–18:00) = 800px — vereist scroll (~1.7× typische vensterhogte)
- 30 min = 40px — ruim genoeg voor titel + subtitel + noot
- 1 uur = 80px

### 2. Halve-uur `:30` labels in de uurkolom

De uurkolom links toont momenteel alleen hele uren (`08`, `09`, …). Hieraan worden dimme `:30` labels toegevoegd op de halverwege-positie (40px van de bovenkant van elk uur-blok).

Kleur voor `:30` labels: `#2e3a4a` (veel dimmer dan de uurlabels `#475569`).

De uurkolom-items krijgen `position: relative` zodat `:30` absoluut gepositioneerd kan worden, of de uurlabels-render-loop wordt uitgebreid om per uur ook het halve-uur te renderen.

### 3. Minimale blokkhoogte: 24 → 36px

In `blockHeight()`:

```ts
return Math.max(36, (mins / 60) * HOUR_HEIGHT_PX)
```

Voorkomt dat zeer korte blokken (< 30 min) onleesbaar klein worden.

### 4. Scroll — geen wijziging nodig

De tijdlijn container heeft al `overflow-y: auto`. Met de grotere hoogte scrollt hij automatisch. Startpositie: bovenaan (08:00), geen auto-scroll naar huidige tijd.

### 5. Optionele halve-uur gridlijn

Subtiele horizontale lijn op elk half uur (de `:30` positie) om de tijdslots visueel te verduidelijken. Kleur: `#252220` (nauwelijks zichtbaar, enkel als structuur-cue).

## Niet in scope

- Auto-scroll naar huidige tijd
- Aanpasbare tijdlijn hoogte door gebruiker
- Tijdlijn buiten 08:00–18:00

## Bestanden

- `src/ui/components/DayTimeline.tsx` — `HOUR_HEIGHT_PX`, `blockHeight`, uurlabels render
- `src/ui/components/DayTimeline.helpers.ts` — geen wijzigingen
- `src/ui/components/DayTimeline.helpers.test.ts` — geen nieuwe tests nodig (logica ongewijzigd)
