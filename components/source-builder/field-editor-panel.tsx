'use client'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { newId } from '@/lib/source-builder/procedure-library'
import type { DraftField, DraftFieldDataType, DraftProcedure } from '@/lib/source-builder/types'

type FieldEditorPanelProps = {
  procedures: DraftProcedure[]
  selectedProcedureId: string | null
  onSelectProcedure: (id: string | null) => void
  onUpdateProcedure: (procedureId: string, fields: DraftField[]) => void
  onRenameProcedure: (procedureId: string, displayName: string) => void
}

export function FieldEditorPanel({
  procedures,
  selectedProcedureId,
  onSelectProcedure,
  onUpdateProcedure,
  onRenameProcedure,
}: FieldEditorPanelProps) {
  const selected = procedures.find((p) => p.id === selectedProcedureId) ?? null
  const visibleFields = selected
    ? [...selected.fields].filter((f) => !f.hidden).sort((a, b) => a.displayOrder - b.displayOrder)
    : []

  function patchField(fieldId: string, patch: Partial<DraftField>) {
    if (!selected) return
    const fields = selected.fields.map((f) => (f.id === fieldId ? { ...f, ...patch } : f))
    onUpdateProcedure(selected.id, fields)
  }

  function addField() {
    if (!selected) return
    const order = selected.fields.length
    const field: DraftField = {
      id: newId(),
      fieldKey: `custom_field_${order + 1}`,
      displayLabel: 'New field',
      dataType: 'string',
      required: false,
      hidden: false,
      displayOrder: order,
    }
    onUpdateProcedure(selected.id, [...selected.fields, field])
  }

  function removeField(fieldId: string) {
    if (!selected) return
    onUpdateProcedure(
      selected.id,
      selected.fields.filter((f) => f.id !== fieldId),
    )
  }

  function moveField(fieldId: string, dir: -1 | 1) {
    if (!selected) return
    const sorted = [...selected.fields].sort((a, b) => a.displayOrder - b.displayOrder)
    const idx = sorted.findIndex((f) => f.id === fieldId)
    const swap = idx + dir
    if (swap < 0 || swap >= sorted.length) return
    const a = sorted[idx]
    const b = sorted[swap]
    const fields = selected.fields.map((f) => {
      if (f.id === a.id) return { ...f, displayOrder: b.displayOrder }
      if (f.id === b.id) return { ...f, displayOrder: a.displayOrder }
      return f
    })
    onUpdateProcedure(selected.id, fields)
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">Documentation fields</CardTitle>
        <CardDescription>
          Minimal operational fields from procedure profiles. Customize per study without
          engineering.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="space-y-1">
          <Label>Procedure</Label>
          <select
            className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm"
            value={selectedProcedureId ?? ''}
            onChange={(e) => onSelectProcedure(e.target.value || null)}
          >
            <option value="">Select a procedure…</option>
            {procedures.map((p) => (
              <option key={p.id} value={p.id}>
                {p.displayName}
                {p.isCustom ? ' (custom)' : ''}
              </option>
            ))}
          </select>
        </p>

        {selected ? (
          <>
            <p className="space-y-1">
              <Label>Display name</Label>
              <Input
                value={selected.displayName}
                onChange={(e) => onRenameProcedure(selected.id, e.target.value)}
              />
            </p>

            <section className="flex flex-wrap gap-2">
              <Button type="button" size="sm" onClick={addField}>
                + Add field
              </Button>
            </section>

            <ul className="space-y-3">
              {visibleFields.map((field) => (
                <li key={field.id} className="rounded-md border p-3">
                  <div className="grid gap-2 sm:grid-cols-2">
                    <p className="space-y-1 sm:col-span-2">
                      <Label className="text-xs">Label</Label>
                      <Input
                        value={field.displayLabel}
                        onChange={(e) => patchField(field.id, { displayLabel: e.target.value })}
                      />
                    </p>
                    <p className="space-y-1">
                      <Label className="text-xs">Field key</Label>
                      <Input
                        value={field.fieldKey}
                        onChange={(e) => patchField(field.id, { fieldKey: e.target.value })}
                      />
                    </p>
                    <p className="space-y-1">
                      <Label className="text-xs">Data type</Label>
                      <select
                        className="h-9 w-full rounded-md border border-input px-2 text-sm"
                        value={field.dataType}
                        onChange={(e) =>
                          patchField(field.id, {
                            dataType: e.target.value as DraftFieldDataType,
                          })
                        }
                      >
                        <option value="string">Text</option>
                        <option value="number">Number</option>
                        <option value="boolean">Yes/No</option>
                        <option value="datetime">Date/time</option>
                        <option value="date">Date</option>
                      </select>
                    </p>
                    <p className="space-y-1 sm:col-span-2">
                      <Label className="text-xs">Helper text</Label>
                      <Input
                        value={field.helperText ?? ''}
                        onChange={(e) => patchField(field.id, { helperText: e.target.value })}
                      />
                    </p>
                    <label className="flex items-center gap-2 text-sm">
                      <input
                        type="checkbox"
                        checked={field.required}
                        onChange={(e) => patchField(field.id, { required: e.target.checked })}
                      />
                      Required
                    </label>
                    <label className="flex items-center gap-2 text-sm">
                      <input
                        type="checkbox"
                        checked={field.hidden}
                        onChange={(e) => patchField(field.id, { hidden: e.target.checked })}
                      />
                      Hidden (disabled)
                    </label>
                  </div>
                  <div className="mt-2 flex flex-wrap gap-2">
                    <Button type="button" size="sm" variant="outline" onClick={() => moveField(field.id, -1)}>
                      ↑
                    </Button>
                    <Button type="button" size="sm" variant="outline" onClick={() => moveField(field.id, 1)}>
                      ↓
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      className="text-destructive"
                      onClick={() => removeField(field.id)}
                    >
                      Remove
                    </Button>
                  </div>
                </li>
              ))}
            </ul>

            {selected.fields.some((f) => f.hidden) ? (
              <p className="text-xs text-muted-foreground">
                {selected.fields.filter((f) => f.hidden).length} hidden field(s) — toggle Hidden to
                restore.
              </p>
            ) : null}
          </>
        ) : (
          <p className="text-sm text-muted-foreground">
            Select a procedure to preview and edit documentation fields.
          </p>
        )}
      </CardContent>
    </Card>
  )
}
