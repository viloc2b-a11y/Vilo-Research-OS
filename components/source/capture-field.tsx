import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import type { CaptureFieldViewModel } from '@/lib/source/capture/types'

type CaptureFieldProps = {
  field: CaptureFieldViewModel
  disabled?: boolean
}

function fieldDefaultValue(field: CaptureFieldViewModel): string {
  if (field.kind === 'number' && field.value.number != null) return String(field.value.number)
  if (field.kind === 'date' && field.value.date) return field.value.date
  if (field.kind === 'json' && field.value.json) return field.value.json
  if (field.value.text) return field.value.text
  return ''
}

export function CaptureField({ field, disabled }: CaptureFieldProps) {
  const name = `field_${field.fieldId}`
  const inputId = `capture-${field.fieldId}`
  const required = field.runtimeState?.required ?? field.isRequired

  return (
    <div className="space-y-2">
      <Label htmlFor={inputId} className="text-sm font-medium">
        {field.label}
        {required ? <span className="text-destructive"> *</span> : null}
        <span className="ml-2 font-normal text-muted-foreground">({field.kind})</span>
      </Label>
      {field.runtimeState?.messages.length ? (
        <ul className="space-y-1 text-xs text-muted-foreground">
          {field.runtimeState.messages.map((message) => (
            <li key={message}>{message}</li>
          ))}
        </ul>
      ) : null}

      {field.kind === 'boolean' ? (
        <label className="flex items-center gap-2 text-sm">
          <input
            id={inputId}
            name={name}
            type="checkbox"
            defaultChecked={Boolean(field.value.boolean)}
            disabled={disabled}
            className="size-4 rounded border border-input"
          />
          <span>Yes</span>
        </label>
      ) : null}

      {field.kind === 'select' ? (
        <select
          id={inputId}
          name={name}
          defaultValue={fieldDefaultValue(field)}
          disabled={disabled}
          className="h-8 w-full rounded-lg border border-input bg-transparent px-2.5 text-sm"
        >
          <option value="">—</option>
          {field.options.map((opt) => (
            <option key={opt} value={opt}>
              {opt}
            </option>
          ))}
        </select>
      ) : null}

      {field.kind === 'json' ? (
        <textarea
          id={inputId}
          name={name}
          defaultValue={fieldDefaultValue(field)}
          disabled={disabled}
          rows={4}
          className="w-full rounded-lg border border-input bg-transparent px-2.5 py-2 font-mono text-xs"
        />
      ) : null}

      {field.kind === 'date' ? (
        <Input
          id={inputId}
          name={name}
          type="date"
          defaultValue={fieldDefaultValue(field)}
          disabled={disabled}
        />
      ) : null}

      {field.kind === 'number' ? (
        <Input
          id={inputId}
          name={name}
          type="number"
          defaultValue={fieldDefaultValue(field)}
          disabled={disabled}
        />
      ) : null}

      {field.kind === 'text' ? (
        <Input
          id={inputId}
          name={name}
          type="text"
          defaultValue={fieldDefaultValue(field)}
          disabled={disabled}
        />
      ) : null}
    </div>
  )
}
