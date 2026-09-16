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
      filledNights: '',
      stays: '',
      commissionPct: '15',
      taxPct: '19',
      fixedCostPerStay: '75',
      monthlyFixedCosts: '',
    })
  })

  it('migrates a stored unfilledDays value into filledNights', () => {
    const stored = JSON.stringify({ unfilledDays: '6' })
    expect(restoreInputs(stored, DEFAULTS)).toEqual({ ...DEFAULTS, filledNights: '24' })
  })

  it('migrates a fully-unfilled month to zero filled nights', () => {
    const stored = JSON.stringify({ unfilledDays: '30' })
    expect(restoreInputs(stored, DEFAULTS)).toEqual({ ...DEFAULTS, filledNights: '0' })
  })

  it('clamps a migrated value at zero rather than going negative', () => {
    const stored = JSON.stringify({ unfilledDays: '45' })
    expect(restoreInputs(stored, DEFAULTS)).toEqual({ ...DEFAULTS, filledNights: '0' })
  })

  it('never migrates over a filledNights value that is already present', () => {
    const stored = JSON.stringify({ unfilledDays: '6', filledNights: '10' })
    const result = restoreInputs(stored, DEFAULTS)
    expect(result.filledNights).toBe('10')
    expect('unfilledDays' in result).toBe(false)
  })

  it('does not migrate when unfilledDays is not a string', () => {
    const stored = JSON.stringify({ unfilledDays: 6 })
    expect(restoreInputs(stored, DEFAULTS)).toEqual(DEFAULTS)
  })

  it('drops a plain unknown key exactly as it drops any other', () => {
    const stored = JSON.stringify({ someOtherLegacyField: '6' })
    const result = restoreInputs(stored, DEFAULTS)
    expect(result).toEqual(DEFAULTS)
    expect('someOtherLegacyField' in result).toBe(false)
  })
})
