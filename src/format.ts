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

const percentFormatter = new Intl.NumberFormat('en-IE', {
  maximumFractionDigits: 4,
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
      return `${percentFormatter.format(amount.value).replace('-', MINUS)}%`
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
