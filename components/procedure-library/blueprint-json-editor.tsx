'use client'

import type { BlueprintJson } from '@/lib/procedure-library/procedure-types'

type BlueprintJsonEditorProps = {
  value: BlueprintJson
  onChange: (value: BlueprintJson) => void
  readOnly?: boolean
}

export function BlueprintJsonEditor({ value, onChange, readOnly = false }: BlueprintJsonEditorProps) {
  const text = JSON.stringify(value, null, 2)

  return (
    <div className="space-y-2">
      <label className="text-sm font-medium text-slate-700">Blueprint JSON</label>
      <textarea
        className="min-h-[200px] w-full rounded-md border border-slate-300 font-mono text-xs p-2"
        value={text}
        readOnly={readOnly}
        onChange={(e) => {
          if (readOnly) return
          try {
            const parsed = JSON.parse(e.target.value) as BlueprintJson
            onChange(parsed)
          } catch {
            // keep typing until valid JSON
          }
        }}
      />
      <p className="text-xs text-slate-500">
        Sections, fields, coordinator guidance, and dependencies. Published versions are immutable.
      </p>
    </div>
  )
}
