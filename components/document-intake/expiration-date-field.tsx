'use client'

interface ExpirationDateFieldProps {
  value: string
  onChange: (value: string) => void
}

export function ExpirationDateField({ value, onChange }: ExpirationDateFieldProps) {
  return (
    <div className="space-y-2">
      <label className="text-sm font-medium text-slate-700">Operational Expiration Date (Optional)</label>
      <input
        type="date"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-md border border-slate-300 p-2 text-sm"
      />
      <p className="text-xs text-slate-500">
        If set, the compliance runtime will automatically generate renewal alerts prior to this date.
      </p>
    </div>
  )
}
