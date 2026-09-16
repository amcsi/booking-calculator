# Booking Net Calculator Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a single-screen web app that computes the net money kept or lost from a month of short-term rental bookings, recalculating live as the user types, and printing the full trail of the calculation.

**Architecture:** One React state object holding seven raw input strings, persisted to a single localStorage key. A dependency-free `calculate()` function turns that object into every number on screen plus the ordered lines of the ledger and trail, so the printed trail cannot disagree with the totals. Formatting is a separate module so tests assert on numbers, never on locale-dependent strings.

**Tech Stack:** React 19, Vite 8, TypeScript, Vitest, pnpm. No UI framework, no router, no state library, no network calls.

**Spec:** `docs/superpowers/specs/2026-09-16-booking-net-calculator-design.md`

## Global Constraints

- Target directory is `/home/attila/0/booking-calculator`, already a git repo on `main` containing only the spec.
- Vite **8+** and React **19+** are required. Verify after scaffolding; pin explicitly and report if the registry yields older majors.
- Vitest is the **only** dependency added beyond the Vite template. No Tailwind, no component library, no testing-library, no date library.
- `DAYS_IN_MONTH = 30`, a named constant in `src/calc.ts`. No calendar logic anywhere.
- The tax base is `gross − commission` and nothing else. Per-stay and monthly costs never reduce tax.
- Net is computed as the single expression `gross − totalCosts`, not as a running chain.
- Arithmetic runs unrounded end to end; rounding happens only at display, to two decimals.
- Percentages have **no upper clamp**. All parsed values have a **lower clamp of 0**.
- `parse()` accepts `.` and `,` interchangeably as the decimal separator, and treats a separator followed by anything other than one or two digits as a thousands separator.
- Negative net results are preserved and displayed, never clamped.
- `src/calc.ts` imports nothing — not React, not `src/format.ts`.
- Tests assert on raw numbers (`652.4`), never on formatted strings.
- localStorage key is `booking-calculator:inputs:v1`.
- Defaults: commission `15`, tax `19`, fixed cost per stay `75`; the other four fields start empty.
- Currency display is euro in `en-IE` format (`€2,400.00`). Negative amounts use the minus sign U+2212 (`−`).
- Commit messages: imperative subject under 72 chars, no trailing period, no conventional-commit prefix, always ending with the `Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>` trailer.

## File Structure

| File | Responsibility |
|---|---|
| `src/calc.ts` | `DAYS_IN_MONTH`, `Inputs`/`Amount`/`Line`/`Result` types, `parse()`, `calculate()`. Imports nothing. |
| `src/calc.test.ts` | The calculation case table. |
| `src/usePersistedState.ts` | `DEFAULTS`, `STORAGE_KEY`, pure `restoreInputs()`, and the `usePersistedState()` hook. |
| `src/usePersistedState.test.ts` | Cases for `restoreInputs()` only — pure, no DOM. |
| `src/format.ts` | `formatEuro()`, `formatNumber()`, `formatAmount()`, `fillDetail()`. |
| `src/NumberField.tsx` | One labelled text input with a unit suffix. |
| `src/App.tsx` | Holds `Inputs`; renders the form, the result hero, the ledger and the trail. |
| `src/index.css` | Hand-written styles, CSS custom properties, dark-mode block. |
| `vite.config.ts` | Vite plus Vitest config (modified from template). |

### Two deliberate additions beyond the spec

Both are flagged for the reviewer to accept or reject at Task 3 and Task 2 respectively:

1. **`restoreInputs()` is extracted as a pure function and tested.** The spec says tests cover "the pure calc module only". Restoring a corrupt or outdated stored blob is the other genuinely fragile piece of logic, and testing it needs no new dependency and no DOM. The hook stays untested.
2. **`parse()` accepts both `.` and `,` as the decimal separator** — approved by the user after the spec was written. A separator is read as a decimal point only when one or two digits follow it, and as a thousands separator otherwise, so `"2,400"` is `2400` rather than `2.4`. Without that rule a plain comma-to-period swap turns €2,400 into €2.40 silently.

---

### Task 1: Scaffold the project

**Files:**
- Create: everything from the Vite `react-ts` template
- Modify: `package.json`, `vite.config.ts`

**Interfaces:**
- Consumes: nothing
- Produces: a working `pnpm dev` / `pnpm build` / `pnpm lint` / `pnpm test` toolchain on Vite 8 + React 19

- [ ] **Step 1: Scaffold into a temporary subdirectory**

The project directory already contains `.git/` and `docs/`. Running `create-vite` directly in it offers to **delete existing files**, which would destroy the spec. Scaffold into a subdirectory and copy up instead:

```bash
cd /home/attila/0/booking-calculator
pnpm create vite@latest scaffold-tmp --template react-ts
cp -r scaffold-tmp/. .
rm -rf scaffold-tmp
```

`cp -r scaffold-tmp/. .` copies dotfiles such as `.gitignore` as well.

- [ ] **Step 2: Verify the major versions**

```bash
node -p "const p=require('./package.json'); [p.dependencies.react, p.devDependencies.vite].join(' ')"
```

Expected: a react value of `^19.x` or higher and a vite value of `^8.x` or higher.

If either is lower, install the correct majors explicitly and report the discrepancy in the task summary rather than continuing quietly:

```bash
pnpm add react@^19 react-dom@^19
pnpm add -D vite@^8
```

- [ ] **Step 3: Install dependencies and add Vitest**

```bash
pnpm install
pnpm add -D vitest
```

- [ ] **Step 4: Add the test script**

In `package.json`, add to `"scripts"`:

```json
"test": "vitest run"
```

- [ ] **Step 5: Wire Vitest into the Vite config**

Replace `vite.config.ts` with:

```ts
import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
})
```

`environment: 'node'` is correct because no test touches the DOM.

- [ ] **Step 6: Verify the toolchain end to end**

```bash
pnpm build && pnpm lint && pnpm test
```

Expected: build succeeds, lint is clean, and Vitest exits successfully reporting **no test files found**. "No test files" is the expected pass state at this point, not a failure.

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "Scaffold the Vite React TypeScript project" -m "Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 2: The pure calculation module

**Files:**
- Create: `src/calc.ts`
- Test: `src/calc.test.ts`

**Interfaces:**
- Consumes: nothing
- Produces:
  - `const DAYS_IN_MONTH: 30`
  - `type Unit = 'euro' | 'plain' | 'percent'`
  - `interface Amount { value: number; unit: Unit }`
  - `interface Line { id: string; label: string; detail: string; operands: Amount[]; amount: Amount }`
  - `interface Inputs` — seven `string` fields: `nightlyRate`, `unfilledDays`, `stays`, `commissionPct`, `taxPct`, `fixedCostPerStay`, `monthlyFixedCosts`
  - `interface Result` — `filledNights`, `grossIncome`, `commission`, `taxableBase`, `tax`, `perStayCosts`, `monthlyFixedCosts`, `totalCosts`, `net` (all `number`), `netPerFilledNight: number | null`, `trail: Line[]`, `costLines: Line[]`
  - `function parse(raw: string): number`
  - `function calculate(inputs: Inputs): Result`

`Line.detail` is a template containing `{0}`, `{1}` placeholders filled from `operands` by the UI. This is what keeps `calc.ts` free of formatting while still owning the step list, so a step cannot be silently dropped from the screen.

- [ ] **Step 1: Write the failing tests**

Create `src/calc.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { calculate, parse, type Inputs } from './calc'

const base: Inputs = {
  nightlyRate: '100',
  unfilledDays: '6',
  stays: '8',
  commissionPct: '15',
  taxPct: '19',
  fixedCostPerStay: '75',
  monthlyFixedCosts: '400',
}

const empty: Inputs = {
  nightlyRate: '',
  unfilledDays: '',
  stays: '',
  commissionPct: '',
  taxPct: '',
  fixedCostPerStay: '',
  monthlyFixedCosts: '',
}

describe('parse', () => {
  it('reads a plain number', () => {
    expect(parse('75')).toBe(75)
  })

  it('treats an empty string as zero', () => {
    expect(parse('')).toBe(0)
  })

  it('treats unparseable text as zero', () => {
    expect(parse('abc')).toBe(0)
  })

  it('floors negatives at zero', () => {
    expect(parse('-50')).toBe(0)
  })

  it('accepts a comma as the decimal separator', () => {
    expect(parse('33,33')).toBe(33.33)
  })

  it('accepts a period as the decimal separator', () => {
    expect(parse('33.5')).toBe(33.5)
  })

  it('reads a separator with three trailing digits as a thousands separator', () => {
    expect(parse('2,400')).toBe(2400)
    expect(parse('2.400')).toBe(2400)
  })

  it('handles both thousands and decimal separators together', () => {
    expect(parse('1.234,56')).toBe(1234.56)
    expect(parse('1,234.56')).toBe(1234.56)
  })

  it('tolerates a trailing separator mid-typing', () => {
    expect(parse('12.')).toBe(12)
    expect(parse('12,')).toBe(12)
  })

  it('ignores whitespace', () => {
    expect(parse(' 75 ')).toBe(75)
  })
})

describe('calculate', () => {
  it('reproduces the worked example', () => {
    const r = calculate(base)
    expect(r.filledNights).toBe(24)
    expect(r.grossIncome).toBe(2400)
    expect(r.commission).toBe(360)
    expect(r.taxableBase).toBe(2040)
    expect(r.tax).toBeCloseTo(387.6, 10)
    expect(r.perStayCosts).toBe(600)
    expect(r.monthlyFixedCosts).toBe(400)
    expect(r.totalCosts).toBeCloseTo(1747.6, 10)
    expect(r.net).toBeCloseTo(652.4, 10)
    expect(r.netPerFilledNight).toBeCloseTo(27.183333, 5)
  })

  it('does not let per-stay or monthly costs change the tax', () => {
    const cheap = calculate(base)
    const expensive = calculate({
      ...base,
      fixedCostPerStay: '500',
      monthlyFixedCosts: '9999',
    })
    expect(expensive.tax).toBe(cheap.tax)
    expect(expensive.taxableBase).toBe(cheap.taxableBase)
  })

  it('charges only the monthly cost when nothing is booked', () => {
    const r = calculate({ ...base, unfilledDays: '30', stays: '0' })
    expect(r.filledNights).toBe(0)
    expect(r.grossIncome).toBe(0)
    expect(r.commission).toBe(0)
    expect(r.tax).toBe(0)
    expect(r.perStayCosts).toBe(0)
    expect(r.net).toBe(-400)
  })

  it('preserves a negative net', () => {
    const r = calculate({ ...base, nightlyRate: '10', unfilledDays: '0' })
    expect(r.net).toBeLessThan(0)
    expect(r.net).toBeCloseTo(-793.45, 10)
  })

  it('clamps filled nights at zero when unfilled days exceed the month', () => {
    const r = calculate({ ...base, unfilledDays: '45' })
    expect(r.filledNights).toBe(0)
  })

  it('returns all zeros for empty input', () => {
    const r = calculate(empty)
    expect(r.grossIncome).toBe(0)
    expect(r.totalCosts).toBe(0)
    expect(r.net).toBe(0)
    expect(r.filledNights).toBe(30)
  })

  it('produces no NaN anywhere for garbage input', () => {
    const r = calculate({
      nightlyRate: 'abc',
      unfilledDays: 'xyz',
      stays: '??',
      commissionPct: 'nope',
      taxPct: '',
      fixedCostPerStay: 'zzz',
      monthlyFixedCosts: '!!',
    })
    const numbers = [
      r.filledNights, r.grossIncome, r.commission, r.taxableBase,
      r.tax, r.perStayCosts, r.monthlyFixedCosts, r.totalCosts, r.net,
    ]
    for (const n of numbers) expect(Number.isFinite(n)).toBe(true)
  })

  it('reports no per-night figure when no nights are filled', () => {
    const r = calculate({ ...base, unfilledDays: '30' })
    expect(r.netPerFilledNight).toBeNull()
  })

  it('does not round intermediate values', () => {
    const r = calculate({ ...base, nightlyRate: '33.33', unfilledDays: '0' })
    expect(r.grossIncome).toBeCloseTo(999.9, 10)
    expect(r.commission).toBeCloseTo(149.985, 10)
    expect(r.taxableBase).toBeCloseTo(849.915, 10)
    expect(r.tax).toBeCloseTo(161.48385, 10)
  })

  it('exposes seven trail steps and four cost lines', () => {
    const r = calculate(base)
    expect(r.trail.map((l) => l.id)).toEqual([
      'filledNights', 'grossIncome', 'commission', 'taxableBase',
      'tax', 'perStayCosts', 'monthlyFixedCosts',
    ])
    expect(r.costLines.map((l) => l.id)).toEqual([
      'commission', 'tax', 'perStay', 'monthly',
    ])
  })

  it('keeps the cost lines summing to total costs', () => {
    const r = calculate(base)
    const sum = r.costLines.reduce((acc, line) => acc + line.amount.value, 0)
    expect(sum).toBeCloseTo(r.totalCosts, 10)
  })
})
```

- [ ] **Step 2: Run the tests to verify they fail**

```bash
pnpm test
```

Expected: FAIL — `Failed to resolve import "./calc"`.

- [ ] **Step 3: Write the implementation**

Create `src/calc.ts`:

```ts
export const DAYS_IN_MONTH = 30

export type Unit = 'euro' | 'plain' | 'percent'

export interface Amount {
  value: number
  unit: Unit
}

/** A row of the ledger or trail. `detail` holds {0}/{1} placeholders filled from `operands`. */
export interface Line {
  id: string
  label: string
  detail: string
  operands: Amount[]
  amount: Amount
}

export interface Inputs {
  nightlyRate: string
  unfilledDays: string
  stays: string
  commissionPct: string
  taxPct: string
  fixedCostPerStay: string
  monthlyFixedCosts: string
}

export interface Result {
  filledNights: number
  grossIncome: number
  commission: number
  taxableBase: number
  tax: number
  perStayCosts: number
  monthlyFixedCosts: number
  totalCosts: number
  net: number
  netPerFilledNight: number | null
  trail: Line[]
  costLines: Line[]
}

/**
 * Reads a typed number. Both "." and "," count as the decimal separator, but
 * only when one or two digits follow; any other separator is a thousands
 * separator. So "33,33" is 33.33 while "2,400" is 2400, and a plain
 * comma-to-period swap cannot silently turn 2,400 into 2.4.
 * Blank, unparseable and negative input all read as 0.
 */
export function parse(raw: string): number {
  const cleaned = raw.replace(/\s/g, '')
  const lastSeparator = Math.max(cleaned.lastIndexOf('.'), cleaned.lastIndexOf(','))

  let normalised: string
  if (lastSeparator === -1) {
    normalised = cleaned
  } else {
    const trailingDigits = cleaned.length - lastSeparator - 1
    const isDecimalPoint = trailingDigits === 1 || trailingDigits === 2
    const head = cleaned.slice(0, lastSeparator).replace(/[.,]/g, '')
    const tail = cleaned.slice(lastSeparator + 1)
    normalised = isDecimalPoint ? `${head}.${tail}` : head + tail
  }

  const n = Number.parseFloat(normalised)
  if (!Number.isFinite(n) || n < 0) return 0
  return n
}

const euro = (value: number): Amount => ({ value, unit: 'euro' })
const plain = (value: number): Amount => ({ value, unit: 'plain' })
const percent = (value: number): Amount => ({ value, unit: 'percent' })

export function calculate(inputs: Inputs): Result {
  const nightlyRate = parse(inputs.nightlyRate)
  const unfilledDays = parse(inputs.unfilledDays)
  const stays = parse(inputs.stays)
  const commissionPct = parse(inputs.commissionPct)
  const taxPct = parse(inputs.taxPct)
  const fixedCostPerStay = parse(inputs.fixedCostPerStay)
  const monthlyFixedCosts = parse(inputs.monthlyFixedCosts)

  const filledNights = Math.min(
    DAYS_IN_MONTH,
    Math.max(0, DAYS_IN_MONTH - unfilledDays),
  )
  const grossIncome = nightlyRate * filledNights
  const commission = grossIncome * (commissionPct / 100)
  const taxableBase = grossIncome - commission
  const tax = taxableBase * (taxPct / 100)
  const perStayCosts = stays * fixedCostPerStay
  const totalCosts = commission + tax + perStayCosts + monthlyFixedCosts
  const net = grossIncome - totalCosts
  const netPerFilledNight = filledNights === 0 ? null : net / filledNights

  const trail: Line[] = [
    {
      id: 'filledNights',
      label: 'Filled nights',
      detail: '{0} days in the month − {1} unfilled',
      operands: [plain(DAYS_IN_MONTH), plain(unfilledDays)],
      amount: plain(filledNights),
    },
    {
      id: 'grossIncome',
      label: 'Gross income',
      detail: '{0} × {1} nights',
      operands: [euro(nightlyRate), plain(filledNights)],
      amount: euro(grossIncome),
    },
    {
      id: 'commission',
      label: 'Commission',
      detail: '{0} × {1}',
      operands: [euro(grossIncome), percent(commissionPct)],
      amount: euro(commission),
    },
    {
      id: 'taxableBase',
      label: 'Taxable base',
      detail: '{0} − {1} commission',
      operands: [euro(grossIncome), euro(commission)],
      amount: euro(taxableBase),
    },
    {
      id: 'tax',
      label: 'Tax',
      detail: '{0} × {1}',
      operands: [euro(taxableBase), percent(taxPct)],
      amount: euro(tax),
    },
    {
      id: 'perStayCosts',
      label: 'Per-stay costs',
      detail: '{0} stays × {1}',
      operands: [plain(stays), euro(fixedCostPerStay)],
      amount: euro(perStayCosts),
    },
    {
      id: 'monthlyFixedCosts',
      label: 'Monthly fixed costs',
      detail: 'as entered',
      operands: [],
      amount: euro(monthlyFixedCosts),
    },
  ]

  const costLines: Line[] = [
    {
      id: 'commission',
      label: 'Commission',
      detail: '{0} of gross',
      operands: [percent(commissionPct)],
      amount: euro(commission),
    },
    {
      id: 'tax',
      label: 'Tax',
      detail: '{0} of {1} base',
      operands: [percent(taxPct), euro(taxableBase)],
      amount: euro(tax),
    },
    {
      id: 'perStay',
      label: 'Per-stay costs',
      detail: '{0} × {1}',
      operands: [plain(stays), euro(fixedCostPerStay)],
      amount: euro(perStayCosts),
    },
    {
      id: 'monthly',
      label: 'Monthly fixed costs',
      detail: '',
      operands: [],
      amount: euro(monthlyFixedCosts),
    },
  ]

  return {
    filledNights,
    grossIncome,
    commission,
    taxableBase,
    tax,
    perStayCosts,
    monthlyFixedCosts,
    totalCosts,
    net,
    netPerFilledNight,
    trail,
    costLines,
  }
}
```

- [ ] **Step 4: Run the tests to verify they pass**

```bash
pnpm test
```

Expected: PASS — 21 tests across two describe blocks (10 for `parse`, 11 for `calculate`).

- [ ] **Step 5: Commit**

```bash
git add src/calc.ts src/calc.test.ts
git commit -m "Add the pure booking net calculation module" -m "Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

- [ ] **Step 6: Note the separator handling in the task summary**

Record that `parse()` accepts both separators per the user's decision, and that the thousands-separator rule is what keeps `"2,400"` from reading as `2.4`.

---

### Task 3: Persisted input state

**Files:**
- Create: `src/usePersistedState.ts`
- Test: `src/usePersistedState.test.ts`

**Interfaces:**
- Consumes: `Inputs` from `./calc`
- Produces:
  - `const STORAGE_KEY = 'booking-calculator:inputs:v1'`
  - `const DEFAULTS: Inputs`
  - `function restoreInputs(raw: string | null, defaults: Inputs): Inputs`
  - `function usePersistedState(): { inputs: Inputs; setField: (field: keyof Inputs, value: string) => void; reset: () => void }`

- [ ] **Step 1: Write the failing tests**

Create `src/usePersistedState.test.ts`. These cover `restoreInputs` only — a pure function needing no DOM:

```ts
import { describe, expect, it } from 'vitest'
import { DEFAULTS, restoreInputs } from './usePersistedState'

describe('restoreInputs', () => {
  it('returns the defaults when nothing is stored', () => {
    expect(restoreInputs(null, DEFAULTS)).toEqual(DEFAULTS)
  })

  it('returns the defaults for corrupt JSON', () => {
    expect(restoreInputs('{not json', DEFAULTS)).toEqual(DEFAULTS)
  })

  it('returns the defaults when the stored value is not an object', () => {
    expect(restoreInputs('5', DEFAULTS)).toEqual(DEFAULTS)
    expect(restoreInputs('null', DEFAULTS)).toEqual(DEFAULTS)
  })

  it('merges stored values over the defaults', () => {
    const stored = JSON.stringify({ nightlyRate: '120', taxPct: '27' })
    expect(restoreInputs(stored, DEFAULTS)).toEqual({
      ...DEFAULTS,
      nightlyRate: '120',
      taxPct: '27',
    })
  })

  it('ignores stored values that are not strings', () => {
    const stored = JSON.stringify({ taxPct: 27, stays: null })
    expect(restoreInputs(stored, DEFAULTS)).toEqual(DEFAULTS)
  })

  it('drops keys that are not part of the input shape', () => {
    const stored = JSON.stringify({ nightlyRate: '120', legacyField: 'x' })
    const result = restoreInputs(stored, DEFAULTS)
    expect(result).toEqual({ ...DEFAULTS, nightlyRate: '120' })
    expect('legacyField' in result).toBe(false)
  })

  it('ships the agreed defaults', () => {
    expect(DEFAULTS).toEqual({
      nightlyRate: '',
      unfilledDays: '',
      stays: '',
      commissionPct: '15',
      taxPct: '19',
      fixedCostPerStay: '75',
      monthlyFixedCosts: '',
    })
  })
})
```

- [ ] **Step 2: Run the tests to verify they fail**

```bash
pnpm test
```

Expected: FAIL — `Failed to resolve import "./usePersistedState"`.

- [ ] **Step 3: Write the implementation**

Create `src/usePersistedState.ts`:

```ts
import { useEffect, useState } from 'react'
import type { Inputs } from './calc'

export const STORAGE_KEY = 'booking-calculator:inputs:v1'

export const DEFAULTS: Inputs = {
  nightlyRate: '',
  unfilledDays: '',
  stays: '',
  commissionPct: '15',
  taxPct: '19',
  fixedCostPerStay: '75',
  monthlyFixedCosts: '',
}

/**
 * Shallow-merges a stored blob over the defaults, keeping only known string
 * fields. A blob written before a field existed still loads, with the new
 * field taking its default rather than arriving as undefined.
 */
export function restoreInputs(raw: string | null, defaults: Inputs): Inputs {
  if (!raw) return defaults
  let parsed: unknown
  try {
    parsed = JSON.parse(raw)
  } catch {
    return defaults
  }
  if (typeof parsed !== 'object' || parsed === null) return defaults

  const source = parsed as Record<string, unknown>
  const merged = { ...defaults }
  for (const key of Object.keys(defaults) as (keyof Inputs)[]) {
    const value = source[key]
    if (typeof value === 'string') merged[key] = value
  }
  return merged
}

function read(): Inputs {
  try {
    return restoreInputs(window.localStorage.getItem(STORAGE_KEY), DEFAULTS)
  } catch {
    return DEFAULTS
  }
}

export function usePersistedState() {
  const [inputs, setInputs] = useState<Inputs>(read)

  useEffect(() => {
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(inputs))
    } catch {
      // Storage can be unavailable in private windows or with site data
      // blocked. Losing persistence is acceptable; failing to render is not.
    }
  }, [inputs])

  const setField = (field: keyof Inputs, value: string) => {
    setInputs((current) => ({ ...current, [field]: value }))
  }

  const reset = () => setInputs(DEFAULTS)

  return { inputs, setField, reset }
}
```

- [ ] **Step 4: Run the tests to verify they pass**

```bash
pnpm test
```

Expected: PASS — all `calc` tests plus 7 `restoreInputs` tests.

- [ ] **Step 5: Commit**

```bash
git add src/usePersistedState.ts src/usePersistedState.test.ts
git commit -m "Persist calculator inputs to localStorage" -m "Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

- [ ] **Step 6: Flag the testing-scope addition in the task summary**

Report that `restoreInputs` is tested although the spec scoped tests to the calc module, that it needed no new dependency and no DOM, and that the hook itself remains untested.

---

### Task 4: Formatting and the input field

**Files:**
- Create: `src/format.ts`, `src/NumberField.tsx`

**Interfaces:**
- Consumes: `Amount`, `Line` from `./calc`
- Produces:
  - `function formatEuro(value: number): string`
  - `function formatNumber(value: number): string`
  - `function formatAmount(amount: Amount): string`
  - `function fillDetail(line: Line): string`
  - `function NumberField(props: NumberFieldProps)` rendering the labelled input, where
    `NumberFieldProps = { label: string; unit: string; value: string; onChange: (value: string) => void }`

No tests here: this module is a thin wrapper over `Intl.NumberFormat`, and asserting on its output would pin locale behaviour that the spec deliberately keeps out of the test suite.

- [ ] **Step 1: Write the formatting module**

Create `src/format.ts`:

```ts
import type { Amount, Line } from './calc'

const MINUS = '−'

const euroFormatter = new Intl.NumberFormat('en-IE', {
  style: 'currency',
  currency: 'EUR',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
})

const plainFormatter = new Intl.NumberFormat('en-IE', {
  maximumFractionDigits: 2,
})

export function formatEuro(value: number): string {
  return euroFormatter.format(value).replace('-', MINUS)
}

export function formatNumber(value: number): string {
  return plainFormatter.format(value).replace('-', MINUS)
}

export function formatAmount(amount: Amount): string {
  switch (amount.unit) {
    case 'euro':
      return formatEuro(amount.value)
    case 'percent':
      return `${formatNumber(amount.value)}%`
    case 'plain':
      return formatNumber(amount.value)
  }
}

/** Fills a line's {0}/{1} placeholders with its formatted operands. */
export function fillDetail(line: Line): string {
  return line.detail.replace(/\{(\d+)\}/g, (match, index: string) => {
    const operand = line.operands[Number(index)]
    return operand ? formatAmount(operand) : match
  })
}
```

- [ ] **Step 2: Write the input field component**

Create `src/NumberField.tsx`:

```tsx
export interface NumberFieldProps {
  label: string
  unit: string
  value: string
  onChange: (value: string) => void
}

export function NumberField({ label, unit, value, onChange }: NumberFieldProps) {
  return (
    <label className="field">
      <span className="field-label">{label}</span>
      <span className="field-control">
        <input
          type="text"
          inputMode="decimal"
          autoComplete="off"
          value={value}
          onChange={(event) => onChange(event.target.value)}
        />
        <span className="field-unit">{unit}</span>
      </span>
    </label>
  )
}
```

`type="text"` with `inputMode="decimal"` is deliberate, per the spec: `type="number"` lets the scroll wheel change values silently, adds spinner arrows, and reports `""` for input the browser considers invalid, hiding what was typed.

- [ ] **Step 3: Verify it compiles and nothing regressed**

```bash
pnpm build && pnpm lint && pnpm test
```

Expected: all three pass. The new modules are not yet imported by `App.tsx`, so the build only type-checks them.

- [ ] **Step 4: Commit**

```bash
git add src/format.ts src/NumberField.tsx
git commit -m "Add euro formatting and the labelled number field" -m "Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 5: The screen

**Files:**
- Create: `src/App.tsx` (replacing the template's), `src/index.css` (replacing the template's)
- Delete: `src/App.css`
- Modify: `src/main.tsx` if it imports `App.css`

**Interfaces:**
- Consumes: `calculate`, `Inputs` from `./calc`; `usePersistedState` from `./usePersistedState`; `formatEuro`, `formatAmount`, `fillDetail` from `./format`; `NumberField` from `./NumberField`
- Produces: the rendered application

- [ ] **Step 1: Replace App.tsx**

```tsx
import { calculate, type Inputs } from './calc'
import { fillDetail, formatAmount, formatEuro } from './format'
import { NumberField } from './NumberField'
import { usePersistedState } from './usePersistedState'

const FIELDS: { field: keyof Inputs; label: string; unit: string }[] = [
  { field: 'nightlyRate', label: 'Nightly rate', unit: '€' },
  { field: 'unfilledDays', label: 'Unfilled days this month', unit: 'nights' },
  { field: 'stays', label: 'Number of stays', unit: '×' },
  { field: 'commissionPct', label: 'Platform commission', unit: '%' },
  { field: 'taxPct', label: 'Tax rate', unit: '%' },
  { field: 'fixedCostPerStay', label: 'Fixed cost per stay', unit: '€' },
  { field: 'monthlyFixedCosts', label: 'Monthly fixed costs', unit: '€' },
]

export default function App() {
  const { inputs, setField, reset } = usePersistedState()
  const result = calculate(inputs)
  const positive = result.net >= 0

  return (
    <main className="app">
      <h1>Booking net calculator</h1>

      <section className="card">
        <h2>Inputs</h2>
        {FIELDS.map(({ field, label, unit }) => (
          <NumberField
            key={field}
            label={label}
            unit={unit}
            value={inputs[field]}
            onChange={(value) => setField(field, value)}
          />
        ))}
        <button type="button" className="reset" onClick={reset}>
          Reset
        </button>
      </section>

      <section className="card">
        <h2>Result</h2>
        <p className={positive ? 'hero positive' : 'hero negative'}>
          {formatEuro(result.net)}
        </p>
        <p className="hero-caption">net kept in a 30-day month</p>
        <p className="hero-caption">
          {result.netPerFilledNight === null
            ? '— per filled night'
            : `${formatEuro(result.netPerFilledNight)} per filled night`}
        </p>

        <dl className="ledger">
          <div className="ledger-row ledger-income">
            <dt>Gross income</dt>
            <dd>{formatEuro(result.grossIncome)}</dd>
          </div>

          {result.costLines.map((line) => (
            <div className="ledger-row" key={line.id}>
              <dt>
                {line.label}
                {line.detail ? (
                  <span className="ledger-detail"> ({fillDetail(line)})</span>
                ) : null}
              </dt>
              <dd>{formatAmount(line.amount)}</dd>
            </div>
          ))}

          <div className="ledger-row ledger-subtotal">
            <dt>Total costs</dt>
            <dd>{formatEuro(result.totalCosts)}</dd>
          </div>

          <div className="ledger-row ledger-net">
            <dt>
              Net kept
              <span className="ledger-detail">
                {' '}
                ({formatEuro(result.grossIncome)} − {formatEuro(result.totalCosts)})
              </span>
            </dt>
            <dd>{formatEuro(result.net)}</dd>
          </div>
        </dl>
      </section>

      <section className="card">
        <h2>How this was calculated</h2>
        <ol className="trail">
          {result.trail.map((line) => (
            <li key={line.id}>
              <span className="trail-label">{line.label}</span>
              <span className="trail-detail">{fillDetail(line)}</span>
              <span className="trail-value">{formatAmount(line.amount)}</span>
            </li>
          ))}
        </ol>
      </section>
    </main>
  )
}
```

- [ ] **Step 2: Replace index.css**

```css
:root {
  --bg: #f6f7f9;
  --card: #ffffff;
  --text: #1c1f23;
  --muted: #6b7280;
  --line: #e3e6ea;
  --positive: #0f7b4f;
  --negative: #b3261e;
  --accent: #2563eb;
  color-scheme: light;
}

@media (prefers-color-scheme: dark) {
  :root {
    --bg: #15181c;
    --card: #1e2227;
    --text: #e8eaed;
    --muted: #9aa2ad;
    --line: #2d333b;
    --positive: #4ade80;
    --negative: #f87171;
    --accent: #60a5fa;
    color-scheme: dark;
  }
}

* {
  box-sizing: border-box;
}

body {
  margin: 0;
  background: var(--bg);
  color: var(--text);
  font: 15px/1.5 system-ui, -apple-system, Segoe UI, Roboto, sans-serif;
}

.app {
  max-width: 640px;
  margin: 0 auto;
  padding: 2rem 1rem 4rem;
}

h1 {
  font-size: 1.35rem;
  margin: 0 0 1.25rem;
}

h2 {
  font-size: 0.8rem;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  color: var(--muted);
  margin: 0 0 1rem;
}

.card {
  background: var(--card);
  border: 1px solid var(--line);
  border-radius: 12px;
  padding: 1.25rem;
  margin-bottom: 1rem;
}

.field {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
  padding: 0.4rem 0;
}

.field-label {
  color: var(--text);
}

.field-control {
  display: inline-flex;
  align-items: baseline;
  gap: 0.4rem;
}

.field-control input {
  width: 7rem;
  padding: 0.4rem 0.55rem;
  text-align: right;
  font: inherit;
  color: var(--text);
  background: var(--bg);
  border: 1px solid var(--line);
  border-radius: 7px;
}

.field-control input:focus {
  outline: 2px solid var(--accent);
  outline-offset: 1px;
}

.field-unit {
  width: 3.2rem;
  color: var(--muted);
  font-size: 0.85rem;
}

.reset {
  display: block;
  margin: 1rem 0 0 auto;
  padding: 0.4rem 0.9rem;
  font: inherit;
  color: var(--muted);
  background: transparent;
  border: 1px solid var(--line);
  border-radius: 7px;
  cursor: pointer;
}

.hero {
  font-size: 2.4rem;
  font-weight: 650;
  margin: 0;
  letter-spacing: -0.02em;
}

.hero.positive {
  color: var(--positive);
}

.hero.negative {
  color: var(--negative);
}

.hero-caption {
  margin: 0.15rem 0 0;
  color: var(--muted);
  font-size: 0.9rem;
}

.ledger {
  margin: 1.5rem 0 0;
}

.ledger-row {
  display: flex;
  justify-content: space-between;
  gap: 1rem;
  padding: 0.35rem 0;
}

.ledger-row dt,
.ledger-row dd {
  margin: 0;
}

.ledger-row dd {
  font-variant-numeric: tabular-nums;
  white-space: nowrap;
}

.ledger-income {
  padding-bottom: 0.75rem;
  margin-bottom: 0.25rem;
}

.ledger-detail {
  color: var(--muted);
  font-size: 0.85rem;
}

.ledger-subtotal,
.ledger-net {
  border-top: 1px solid var(--line);
  margin-top: 0.5rem;
  padding-top: 0.6rem;
}

.ledger-net {
  font-weight: 650;
}

.trail {
  margin: 0;
  padding-left: 1.2rem;
  color: var(--text);
}

.trail li {
  padding: 0.3rem 0;
}

.trail-label {
  display: inline-block;
  min-width: 11rem;
}

.trail-detail {
  color: var(--muted);
  font-size: 0.85rem;
  margin-right: 0.5rem;
}

.trail-value {
  font-variant-numeric: tabular-nums;
  font-weight: 600;
}
```

- [ ] **Step 3: Remove the template stylesheet**

```bash
rm -f src/App.css
grep -rn "App.css" src/ || echo "no remaining references"
```

If `src/main.tsx` still imports `./App.css`, delete that import line. Confirm `src/main.tsx` imports `./index.css`.

- [ ] **Step 4: Verify build, lint and tests**

```bash
pnpm build && pnpm lint && pnpm test
```

Expected: all three pass.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "Build the calculator screen with live ledger and trail" -m "Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 6: Verify against the definition of done

**Files:**
- Modify: only if a check fails

**Interfaces:**
- Consumes: the complete application
- Produces: a verified build, and a report of any check that failed

- [ ] **Step 1: Run the full check suite**

```bash
pnpm build && pnpm lint && pnpm test
```

Expected: build clean, lint clean, all tests passing. Record the actual test count in the task summary.

- [ ] **Step 2: Start the dev server**

```bash
pnpm dev
```

Note the printed localhost URL.

- [ ] **Step 3: Reproduce the worked example in the browser**

Enter: nightly rate `100`, unfilled days `6`, stays `8`, commission `15`, tax `19`, fixed cost per stay `75`, monthly fixed costs `400`.

Verify on screen:
- Gross income `€2,400.00`
- Commission `€360.00`
- Tax `€387.60`, labelled as 19% of the `€2,040.00` base
- Per-stay costs `€600.00`
- Monthly fixed costs `€400.00`
- Total costs `€1,747.60`
- Net kept `€652.40`, rendered green
- `€27.18 per filled night`
- The trail lists all seven steps

- [ ] **Step 4: Verify live recalculation and the negative state**

Change the nightly rate to `10` without pressing anything else. The result must update on each keystroke, with no button press, and the hero must turn red with a `−` prefix.

- [ ] **Step 5: Verify persistence**

Reload the page. Every field must still hold its last value.

- [ ] **Step 6: Verify the reset button**

Click Reset. Rate, unfilled days, stays and monthly costs empty; commission `15`; tax `19`; per stay `75`.

- [ ] **Step 7: Stop the dev server and report**

Report every check as passed or failed with the observed value. Do not claim completion for any step not actually run.
