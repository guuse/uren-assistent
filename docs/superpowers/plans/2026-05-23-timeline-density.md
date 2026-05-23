# Tijdlijn Dichtheid Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Verhoog `HOUR_HEIGHT_PX` van 48 naar 80, voeg halve-uur `:30` labels toe in de uurkolom, en pas de minimale blokkhoogte aan zodat de tijdlijn meer detail toont met scroll.

**Architecture:** Alle wijzigingen zitten in één bestand: `DayTimeline.tsx`. De constante `HOUR_HEIGHT_PX` bepaalt de hoogte van alle blokken; de uurlabels-render-loop wordt uitgebreid met een `:30` label per uur. De helpers-logica en tests hoeven niet te worden aangepast.

**Tech Stack:** React 18, TypeScript strict, Tailwind CSS, Vitest

---

### Task 1: HOUR_HEIGHT_PX verhogen en minimale blokkhoogte aanpassen

**Files:**
- Modify: `src/ui/components/DayTimeline.tsx:10,19`

- [ ] **Stap 1: Pas de constanten aan**

In `src/ui/components/DayTimeline.tsx`, wijzig:

```ts
// was: const HOUR_HEIGHT_PX = 48
const HOUR_HEIGHT_PX = 80
```

En in `blockHeight()`:

```ts
// was: return Math.max(24, (mins / 60) * HOUR_HEIGHT_PX)
return Math.max(36, (mins / 60) * HOUR_HEIGHT_PX)
```

- [ ] **Stap 2: Typecheck**

```bash
npm run typecheck
```

Verwacht: geen fouten.

- [ ] **Stap 3: Commit**

```bash
git add src/ui/components/DayTimeline.tsx
git commit -m "feat: verhoog HOUR_HEIGHT_PX naar 80, minimale blokkhoogte 36px"
```

---

### Task 2: Halve-uur `:30` labels toevoegen aan de uurkolom

**Files:**
- Modify: `src/ui/components/DayTimeline.tsx` (uurlabels render sectie, ~regel 176-186)

De huidige render van de uurlabels ziet er zo uit:

```tsx
{Array.from({ length: 10 }, (_, i) => i + 8).map((hour) => (
  <div
    key={hour}
    className="text-[#475569] text-[0.5625rem] flex items-start"
    style={{ height: HOUR_HEIGHT_PX }}
  >
    {hour.toString().padStart(2, '0')}
  </div>
))}
```

- [ ] **Stap 1: Vervang de uurlabels render door een versie met halve-uur labels**

```tsx
{Array.from({ length: 10 }, (_, i) => i + 8).map((hour) => (
  <div
    key={hour}
    className="relative flex-shrink-0"
    style={{ height: HOUR_HEIGHT_PX }}
  >
    <span className="absolute top-0 text-[#475569] text-[0.5625rem]">
      {hour.toString().padStart(2, '0')}
    </span>
    <span
      className="absolute text-[#2e3a4a] text-[0.5rem]"
      style={{ top: HOUR_HEIGHT_PX / 2 }}
    >
      :30
    </span>
  </div>
))}
```

- [ ] **Stap 2: Typecheck**

```bash
npm run typecheck
```

Verwacht: geen fouten.

- [ ] **Stap 3: Run bestaande tests**

```bash
npm run test
```

Verwacht: alle 120 tests groen.

- [ ] **Stap 4: Commit**

```bash
git add src/ui/components/DayTimeline.tsx
git commit -m "feat: voeg halve-uur :30 labels toe aan tijdlijn uurkolom"
```
