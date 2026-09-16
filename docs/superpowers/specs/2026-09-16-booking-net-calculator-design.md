# Booking net calculator — design

**Date:** 2026-09-16
**Status:** Approved, ready for implementation planning

## Purpose

A single-screen web app that answers one question: given a nightly rate on
Booking.com or Airbnb, how much money is actually kept — or lost — in a month,
after platform commission, tax, per-stay costs, and recurring monthly costs.

Every figure recalculates as the user types. There is no calculate button. The
app also prints the full trail of the calculation, so the final number can be
checked line by line rather than trusted.

## Scope

In scope: one apartment, one month, one platform at a time, seven inputs,
localStorage persistence, a printed calculation trail.

Out of scope: multi-property support, side-by-side platform comparison,
per-night or seasonal rate variation, real calendar months, currency other than
euro, any server or network call.

## Calculation model

### Inputs

| Field | Unit | Default |
|---|---|---|
| Nightly rate | € | *(empty)* |
| Unfilled days this month | nights | *(empty)* |
| Number of stays | count | *(empty)* |
| Platform commission | % | `15` |
| Tax rate | % | `19` |
| Fixed cost per stay | € | `75` |
| Monthly fixed costs | € | *(empty)* |

All seven are held as raw strings. A blank or unparseable value becomes `0`.

`DAYS_IN_MONTH = 30` is a named constant in `calc.ts`. Months are always
treated as 30 days; no calendar logic exists.

### Derivation

| # | Step | Formula |
|---|---|---|
| 1 | Filled nights | `DAYS_IN_MONTH − unfilledDays`, clamped to 0–30 |
| 2 | Gross income | `nightlyRate × filledNights` |
| 3 | Commission | `gross × commissionPct / 100` |
| 4 | Taxable base | `gross − commission` |
| 5 | Tax | `taxableBase × taxPct / 100` |
| 6 | Per-stay costs | `stays × fixedCostPerStay` |
| 7 | Monthly fixed costs | *(entered directly)* |
| 8 | Total costs | `commission + tax + perStayCosts + monthlyCosts` |
| 9 | Net kept | `gross − totalCosts` |
| 10 | Net per filled night | `net / filledNights`, or `null` when `filledNights === 0` |

### Rules this encodes

- **The tax base is gross income minus commission, and nothing else.** Per-stay
  costs and monthly fixed costs are paid out of already-taxed money. They never
  reduce the tax figure.
- **Net is expressed as income minus total costs**, computed as that single
  expression, so the on-screen ledger and the code have the same shape.
- **Arithmetic is unrounded end to end**; rounding happens only at display, to
  two decimals. A printed line may therefore differ from its exact value by up
  to a cent, which is preferred over a total that does not match its inputs.
- **Percentages are not clamped to 100.** A 120% tax rate computes; showing a
  visibly wrong answer beats silently rewriting what the user typed.
- **Negative results are preserved.** A net below zero is the app answering the
  "or lose" half of its question.

### Worked example

Rate €100, 6 unfilled days, 8 stays, 15% commission, 19% tax, €75 per stay,
€400 monthly:

```
30 − 6                    =   24 filled nights
€100 × 24                 = €2,400.00  gross income
€2,400.00 × 15%           =   €360.00  commission
€2,400.00 − €360.00       = €2,040.00  taxable base
€2,040.00 × 19%           =   €387.60  tax
8 × €75                   =   €600.00  per-stay costs
                              €400.00  monthly fixed costs
```

Ledger:

```
  Gross income                        €2,400.00

  Commission (15%)                      €360.00
  Tax (19% of €2,040.00 base)           €387.60
  Per-stay costs (8 × €75)              €600.00
  Monthly fixed costs                   €400.00
  ──────────────────────────────────────────────
  Total costs                         €1,747.60
  ──────────────────────────────────────────────
  Net kept   (€2,400.00 − €1,747.60)    €652.40
             €27.18 per filled night
```

## Architecture

Approach: one state object, one persistence hook, one pure calculation module.

| File | Owns | Depends on |
|---|---|---|
| `src/calc.ts` | `Inputs` / `Result` types, `DAYS_IN_MONTH`, `parse()`, `calculate()` | nothing |
| `src/calc.test.ts` | the case table | `calc.ts` |
| `src/format.ts` | `formatEuro()`, `formatNumber()` via `Intl.NumberFormat` | nothing |
| `src/usePersistedState.ts` | localStorage-backed state hook | React |
| `src/NumberField.tsx` | one labelled input with unit suffix | nothing local |
| `src/App.tsx` | holds `Inputs`, renders form, ledger and trail | all of the above |

`calc.ts` imports nothing — not React, not `format.ts`. It accepts a plain
object of strings and returns numbers plus the labelled cost lines that the
ledger and trail render. This is the boundary that makes the math testable
without rendering, and it is the reason the printed trail cannot drift from the
totals: the trail is the function's output, not a separate narration of it.

Parsing lives at the entry of `calc.ts`. `parse()` maps `""`, `"abc"`, and
negative values to `0`, so every downstream number is finite by construction
and no `NaN` can reach the screen.

`format.ts` is separate so that tests assert on numbers (`652.4`) rather than
on locale-dependent strings.

## State and persistence

One React state object, one localStorage key: `booking-calculator:inputs:v1`,
holding the seven raw strings as JSON.

`usePersistedState` reads and parses the key once in a lazy `useState`
initialiser, and writes the serialised object in an effect on every change.
Both sides are wrapped in try/catch: storage may be unavailable (private
windows, blocked site data) or hold corrupt JSON, and in either case the app
falls back to defaults rather than failing to render.

Restore is a shallow merge over the defaults — `{...DEFAULTS, ...parsed}` —
keeping only values that are actually strings. A blob written before a field
existed still loads, with the new field taking its default rather than arriving
as `undefined` and breaking a controlled input. If the shape ever changes
incompatibly, the `:v1` suffix is bumped instead of writing a migration.

A Reset button restores the defaults above.

## The screen

Single column, max-width ~640px, centred. Three cards: Inputs, Result, and
"How this was calculated". No routing, no tabs, no button other than Reset.

```
┌─ Inputs ──────────────────────────────┐
│ Nightly rate              [   100 ] € │
│ Unfilled days this month  [     6 ] n │
│ Number of stays           [     8 ] × │
│ Platform commission       [    15 ] % │
│ Tax rate                  [    19 ] % │
│ Fixed cost per stay       [    75 ] € │
│ Monthly fixed costs       [   400 ] € │
│                               [Reset] │
└───────────────────────────────────────┘
┌─ Result ──────────────────────────────┐
│           € 652.40                    │
│           net kept in a 30-day month  │
│           €27.18 per filled night     │
│                                       │
│   … the ledger, as above …            │
└───────────────────────────────────────┘
┌─ How this was calculated ─────────────┐
│   steps 1–7, each as text + number    │
└───────────────────────────────────────┘
```

Inputs are `type="text"` with `inputMode="decimal"`, not `type="number"`.
Since state is raw strings, `type="number"` buys nothing and costs real
annoyances: the scroll wheel silently changes values, spinner arrows clutter
the layout, and browsers report `""` for input they consider invalid, hiding
what was actually typed. `inputMode` still raises the numeric keypad on mobile.

The three cards split the derivation between them: the trail card prints steps
1–7, where each cost comes from; the ledger in the Result card prints steps 8
and 9; and the hero prints step 9 again with step 10 beneath it.

The hero number carries the sign: positive green, negative red and prefixed
`−`. The per-night figure renders `—` when filled nights is zero.

Styling is one hand-written `index.css` using CSS custom properties, with a
`prefers-color-scheme: dark` block redefining the palette. No Tailwind, no
component library.

## Tooling and tests

Scaffolded with `pnpm create vite@latest . --template react-ts`, plus Vitest as
the only additional dev dependency. Node 22.17 clears Vite 8's engine floor.
Scripts: `dev`, `build`, `test`, `lint` (the template's ESLint config,
unmodified).

**Verification step before anything else:** confirm the scaffold resolves to
Vite 8+ and React 19. If the registry yields older majors, pin them explicitly
and report it rather than proceeding on Vite 7.

`calc.test.ts` is a table of cases against the pure function:

- The worked example above, end to end.
- **The tax rule:** raising per-stay and monthly costs leaves the tax figure
  unchanged. This is the one invariant stated explicitly by the user, and the
  one a future refactor would most plausibly break.
- Zero occupancy (30 unfilled): gross 0, percentage costs 0, net equals minus
  the monthly costs.
- Negative net: the sign survives.
- Clamping: 45 unfilled days yields 0 filled nights, not −15.
- Empty and garbage input: `""` and `"abc"` both parse to 0; no `NaN` appears
  anywhere in the result.
- Zero filled nights: per-night figure is `null`, not `Infinity`.
- Rounding: a rate with repeating decimals, asserted via `toBeCloseTo`.

Cases assert on raw numbers, never formatted strings.

## Assumptions

- The 15% commission default is an assumption confirmed by the user; it suits
  Booking.com, whereas Airbnb's host-only fee is nearer 3%.
- "Rate" means the nightly price set on the platform, from which commission is
  deducted — not a total or a post-commission payout.
- Stay count and filled nights are independent inputs; the app does not check
  that they are consistent with each other.

## Definition of done

- `pnpm build` and `pnpm lint` pass clean.
- `pnpm test` passes, covering every case listed above.
- Typing in any field updates the result with no button press.
- A reload restores the last entered values.
- The worked example reproduces €652.40 in the browser.
