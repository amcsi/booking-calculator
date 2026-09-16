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
  filledNights: string
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
 * Reads a typed number. Both "." and "," are accepted as the decimal
 * separator; what a lone separator means depends on the field.
 *
 * In 'amount' mode (money and counts) a lone separator followed by exactly
 * three digits is grouping, so "2,400" is 2400, while "33,33" is 33.33.
 * In 'rate' mode (percentages) a lone separator is always a decimal point,
 * so "19.375" is 19.375 rather than a 19375% tax.
 *
 * With two or more separators, all but the last are grouping in both modes
 * and the last is a decimal point only when one or two digits follow, so
 * "1.234,56" and "1,234.56" are both 1234.56 and "1,234,567" is 1234567.
 *
 * Blank, unparseable, negative and negative-zero input all read as 0.
 */
export function parse(raw: string, mode: 'amount' | 'rate' = 'amount'): number {
  const cleaned = raw.replace(/\s/g, '')
  const lastSeparator = Math.max(cleaned.lastIndexOf('.'), cleaned.lastIndexOf(','))
  const separatorCount = (cleaned.match(/[.,]/g) ?? []).length

  let normalised: string
  if (lastSeparator === -1) {
    normalised = cleaned
  } else {
    const tail = cleaned.slice(lastSeparator + 1)
    const isDecimalPoint =
      separatorCount === 1
        ? mode === 'rate' || !/^\d{3}$/.test(tail)
        : /^\d{1,2}$/.test(tail)
    const head = cleaned.slice(0, lastSeparator).replace(/[.,]/g, '')
    normalised = isDecimalPoint ? `${head}.${tail}` : head + tail
  }

  const n = Number.parseFloat(normalised)
  if (!Number.isFinite(n) || n <= 0) return 0
  return n
}

const euro = (value: number): Amount => ({ value, unit: 'euro' })
const plain = (value: number): Amount => ({ value, unit: 'plain' })
const percent = (value: number): Amount => ({ value, unit: 'percent' })

export function calculate(inputs: Inputs): Result {
  const nightlyRate = parse(inputs.nightlyRate)
  const filledNights = parse(inputs.filledNights)
  const stays = parse(inputs.stays)
  const commissionPct = parse(inputs.commissionPct, 'rate')
  const taxPct = parse(inputs.taxPct, 'rate')
  const fixedCostPerStay = parse(inputs.fixedCostPerStay)
  const monthlyFixedCosts = parse(inputs.monthlyFixedCosts)

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
