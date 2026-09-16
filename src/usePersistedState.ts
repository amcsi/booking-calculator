import { useEffect, useState } from 'react'
import { parse, type Inputs } from './calc'

export const STORAGE_KEY = 'booking-calculator:inputs:v1'

export const DEFAULTS: Inputs = {
  nightlyRate: '',
  filledNights: '',
  stays: '',
  commissionPct: '15',
  taxPct: '19',
  fixedCostPerStay: '75',
  monthlyFixedCosts: '',
}

/**
 * The month length assumed by the app before `filledNights` became a direct
 * input. Used only to migrate a stored `unfilledDays` value from that
 * earlier schema — never for anything the calculator itself displays.
 */
const LEGACY_DAYS_IN_MONTH = 30

/**
 * Shallow-merges a stored blob over the defaults, keeping only known string
 * fields. A blob written before a field existed still loads, with the new
 * field taking its default rather than arriving as undefined.
 *
 * One exception to "unknown keys are dropped": a blob from before the
 * `unfilledDays` → `filledNights` rename is migrated rather than discarded.
 * If `filledNights` isn't already present, a stored `unfilledDays` value
 * becomes 30 minus itself (clamped at 0) before the merge runs. A blob that
 * already carries `filledNights` is left alone — a leftover `unfilledDays`
 * key from an old save is dropped like any other unknown key.
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

  const source = { ...(parsed as Record<string, unknown>) }
  if (typeof source.filledNights !== 'string' && typeof source.unfilledDays === 'string') {
    const unfilledDays = parse(source.unfilledDays)
    source.filledNights = String(Math.max(0, LEGACY_DAYS_IN_MONTH - unfilledDays))
  }

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
