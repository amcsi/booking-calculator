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
