import { calculate, type Inputs } from './calc'
import { fillDetail, formatAmount, formatEuro } from './format'
import { NumberField } from './NumberField'
import { usePersistedState } from './usePersistedState'

const FIELDS: { field: keyof Inputs; label: string; unit: string }[] = [
  { field: 'nightlyRate', label: 'Nightly rate', unit: '€' },
  { field: 'filledNights', label: 'Number of nights booked in month', unit: 'nights' },
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

      <section className="card" aria-live="polite">
        <h2>Result</h2>
        <p className={positive ? 'hero positive' : 'hero negative'}>
          {formatEuro(result.net)}
        </p>
        <p className="hero-caption">net kept this month</p>
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
