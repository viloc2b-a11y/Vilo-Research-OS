'use client'

import { useState } from 'react'

type FieldDefinition = {
  field_id: string
  label: string
  type: string
  required?: boolean
}

type ProcedureFieldEditorProps = {
  fields: FieldDefinition[]
  values: Record<string, unknown>
  disabled?: boolean
  onSave: (values: Record<string, unknown>) => Promise<void>
}

export function ProcedureFieldEditor({
  fields,
  values,
  disabled,
  onSave,
}: ProcedureFieldEditorProps) {
  const [draft, setDraft] = useState<Record<string, string>>(() => {
    const initial: Record<string, string> = {}
    for (const field of fields) {
      const current = values[field.field_id]
      initial[field.field_id] = current == null ? '' : String(current)
    }
    return initial
  })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSave() {
    setSaving(true)
    setError(null)
    try {
      const payload: Record<string, unknown> = {}
      for (const field of fields) {
        const raw = draft[field.field_id] ?? ''
        if (field.type === 'number') {
          payload[field.field_id] = raw === '' ? null : Number(raw)
        } else if (field.type === 'boolean') {
          payload[field.field_id] = raw === 'true'
        } else {
          payload[field.field_id] = raw
        }
      }
      await onSave(payload)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save field values')
    } finally {
      setSaving(false)
    }
  }

  if (fields.length === 0) {
    return (
      <div className="mt-2">
        <label className="block text-xs text-slate-500">Field values (JSON)</label>
        <textarea
          className="mt-1 w-full rounded border border-slate-300 p-2 font-mono text-xs"
          rows={4}
          disabled={disabled}
          value={JSON.stringify(values, null, 2)}
          onChange={(e) => {
            try {
              const parsed = JSON.parse(e.target.value) as Record<string, unknown>
              void onSave(parsed)
            } catch {
              setError('Invalid JSON')
            }
          }}
        />
        {error ? <p className="mt-1 text-xs text-red-600">{error}</p> : null}
      </div>
    )
  }

  return (
    <div className="mt-2 space-y-2">
      {fields.map((field) => (
        <label key={field.field_id} className="block text-xs text-slate-600">
          {field.label}
          {field.required ? ' *' : ''}
          <input
            className="mt-1 w-full rounded border border-slate-300 px-2 py-1 text-sm"
            type={field.type === 'number' ? 'number' : 'text'}
            disabled={disabled || saving}
            value={draft[field.field_id] ?? ''}
            onChange={(e) =>
              setDraft((current) => ({ ...current, [field.field_id]: e.target.value }))
            }
          />
        </label>
      ))}
      <button
        type="button"
        className="rounded bg-slate-800 px-3 py-1 text-xs text-white disabled:opacity-50"
        disabled={disabled || saving}
        onClick={() => void handleSave()}
      >
        {saving ? 'Saving…' : 'Save field values'}
      </button>
      {error ? <p className="text-xs text-red-600">{error}</p> : null}
    </div>
  )
}
