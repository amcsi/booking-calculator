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
