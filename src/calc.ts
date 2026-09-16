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
