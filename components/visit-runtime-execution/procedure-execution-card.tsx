'use client'

import type { ProcedureRuntimeInstanceRow } from '@/lib/visit-runtime-execution/visit-runtime-types'
import { ProcedureFieldEditor } from './procedure-field-editor'

type ProcedureExecutionCardProps = {
  procedureInstance: ProcedureRuntimeInstanceRow
  fieldDefinitions: Array<{ field_id: string; label: string; type: string; required?: boolean }>
  disabled?: boolean
  onSaveFields: (values: Record<string, unknown>) => Promise<void>
  onComplete: () => Promise<void>
  onSkip: (reason: string) => Promise<void>
}

export function ProcedureExecutionCard({
  procedureInstance,
  fieldDefinitions,
  disabled,
  onSaveFields,
  onComplete,
  onSkip,
}: ProcedureExecutionCardProps) {
  const terminal =
    procedureInstance.procedureStatus === 'completed'
    || procedureInstance.procedureStatus === 'skipped'
    || procedureInstance.procedureStatus === 'not_applicable'

  return (
    <div className="rounded-md border border-slate-200 bg-white p-4">
      <div className="flex flex-wrap items-center gap-2">
        <span className="font-medium text-slate-900">
          {procedureInstance.procedureOrder}. {procedureInstance.procedureName}
        </span>
        <span className="font-mono text-xs text-slate-500">{procedureInstance.procedureCode}</span>
        <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs">
          {procedureInstance.procedureStatus}
        </span>
        {procedureInstance.required ? (
          <span className="text-xs text-amber-700">Required</span>
        ) : (
          <span className="text-xs text-slate-500">Optional</span>
        )}
      </div>

      <ProcedureFieldEditor
        fields={fieldDefinitions}
        values={procedureInstance.fieldValues}
        disabled={disabled || terminal}
        onSave={onSaveFields}
      />

      {!disabled && !terminal ? (
        <div className="mt-3 flex flex-wrap gap-2">
          <button
            type="button"
            className="rounded bg-emerald-700 px-3 py-1 text-xs text-white"
            onClick={() => void onComplete()}
          >
            Complete procedure
          </button>
          <button
            type="button"
            className="rounded border border-slate-300 px-3 py-1 text-xs text-slate-700"
            onClick={() => {
              const reason = window.prompt(
                procedureInstance.required
                  ? 'Skip reason (required for required procedures):'
                  : 'Skip reason (optional):',
              )
              if (reason === null) return
              void onSkip(reason)
            }}
          >
            Skip
          </button>
        </div>
      ) : null}
    </div>
  )
}
