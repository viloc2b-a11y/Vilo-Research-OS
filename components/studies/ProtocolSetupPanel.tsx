'use client'

import { useActionState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  INITIAL_PROTOCOL_SETUP_STATE,
  updateProcedureMapProtocolAction,
  updateVisitDefinitionProtocolAction,
} from '@/lib/studies/protocol-setup-actions'
import type { ProtocolSetupMapRow, ProtocolSetupVisitRow } from '@/lib/studies/load-protocol-setup'
import { SUBJECT_ROLE_OPTIONS, VISIT_MODALITY_OPTIONS } from '@/lib/studies/protocol-primitives'

function VisitDefinitionProtocolForm({
  studyId,
  organizationId,
  row,
}: {
  studyId: string
  organizationId: string
  row: ProtocolSetupVisitRow
}) {
  const [state, action, pending] = useActionState(
    updateVisitDefinitionProtocolAction,
    INITIAL_PROTOCOL_SETUP_STATE,
  )

  return (
    <form action={action} className="space-y-3 rounded-md border border-border/60 p-3">
      <input type="hidden" name="study_id" value={studyId} />
      <input type="hidden" name="organization_id" value={organizationId} />
      <input type="hidden" name="visit_definition_id" value={row.id} />
      <p className="text-sm font-medium text-foreground">
        {row.label} <span className="text-muted-foreground">({row.code})</span>
      </p>
      <div className="grid gap-3 md:grid-cols-3">
        <div className="space-y-1">
          <Label className="text-xs">Eligible arms (comma-separated)</Label>
          <Input
            name="eligible_arms"
            className="h-8 text-xs"
            defaultValue={row.eligibleArms ?? ''}
            placeholder="Arm A, Arm B — empty = all arms"
          />
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Eligible subject roles</Label>
          <Input
            name="eligible_subject_roles"
            className="h-8 text-xs"
            defaultValue={row.eligibleSubjectRoles ?? ''}
            placeholder="index_patient, household_contact"
          />
          <p className="text-[10px] text-muted-foreground">
            Values: {SUBJECT_ROLE_OPTIONS.map(([v]) => v).join(', ')}. Empty = all roles.
          </p>
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Modality</Label>
          <select
            name="modality"
            defaultValue={row.modality ?? ''}
            className="h-8 w-full rounded-md border border-input bg-transparent px-2 text-xs"
          >
            {VISIT_MODALITY_OPTIONS.map(([value, label]) => (
              <option key={value || 'default'} value={value}>
                {label}
              </option>
            ))}
          </select>
        </div>
      </div>
      {state.message ? (
        <p className={state.ok ? 'text-xs text-emerald-700' : 'text-xs text-destructive'} role="status">
          {state.message}
        </p>
      ) : null}
      <Button type="submit" size="sm" variant="outline" disabled={pending}>
        {pending ? 'Saving…' : 'Save visit protocol'}
      </Button>
    </form>
  )
}

function ProcedureMapProtocolForm({
  studyId,
  organizationId,
  row,
}: {
  studyId: string
  organizationId: string
  row: ProtocolSetupMapRow
}) {
  const [state, action, pending] = useActionState(
    updateProcedureMapProtocolAction,
    INITIAL_PROTOCOL_SETUP_STATE,
  )

  return (
    <form action={action} className="flex flex-wrap items-end gap-3 rounded-md border border-border/60 p-3">
      <input type="hidden" name="study_id" value={studyId} />
      <input type="hidden" name="organization_id" value={organizationId} />
      <input type="hidden" name="map_id" value={row.id} />
      <div className="min-w-[200px] flex-1">
        <p className="text-sm font-medium text-foreground">
          {row.visitLabel} · {row.procedureLabel}
        </p>
      </div>
      <label className="flex items-center gap-2 text-xs">
        <input type="checkbox" name="is_conditional" defaultChecked={row.isConditional} />
        Conditional (not auto-created on schedule)
      </label>
      <div className="min-w-[220px] flex-1 space-y-1">
        <Label className="text-xs">Condition label</Label>
        <Input
          name="condition_label"
          className="h-8 text-xs"
          defaultValue={row.conditionLabel ?? ''}
          placeholder="e.g. ACTH if cortisol low"
        />
      </div>
      {state.message ? (
        <p className={state.ok ? 'text-xs text-emerald-700' : 'text-xs text-destructive'} role="status">
          {state.message}
        </p>
      ) : null}
      <Button type="submit" size="sm" variant="outline" disabled={pending}>
        {pending ? 'Saving…' : 'Save map'}
      </Button>
    </form>
  )
}

export function ProtocolSetupPanel({
  studyId,
  organizationId,
  visits,
  procedureMaps,
  error,
}: {
  studyId: string
  organizationId: string
  visits: ProtocolSetupVisitRow[]
  procedureMaps: ProtocolSetupMapRow[]
  error: string | null
}) {
  if (error) {
    return (
      <section id="protocol-setup" className="vilo-card p-5">
        <p className="text-sm text-destructive">{error}</p>
      </section>
    )
  }

  return (
    <section id="protocol-setup" className="vilo-card overflow-hidden">
      <div className="border-b border-border/60 px-5 py-4">
        <h2 className="text-sm font-semibold text-foreground">Protocol setup (Phase 11D fields)</h2>
        <p className="mt-1 text-xs text-muted-foreground">
          Configure arm/role eligibility, visit modality, and conditional procedures. Plain fields only — no
          schedule designer.
        </p>
      </div>
      <div className="space-y-4 p-5">
        <div>
          <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Visit definitions
          </h3>
          {visits.length === 0 ? (
            <p className="text-sm text-muted-foreground">No visit definitions on this study.</p>
          ) : (
            <div className="space-y-3">
              {visits.map((row) => (
                <VisitDefinitionProtocolForm
                  key={row.id}
                  studyId={studyId}
                  organizationId={organizationId}
                  row={row}
                />
              ))}
            </div>
          )}
        </div>
        <div>
          <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Visit × procedure maps
          </h3>
          {procedureMaps.length === 0 ? (
            <p className="text-sm text-muted-foreground">No procedure maps on this study.</p>
          ) : (
            <div className="space-y-3">
              {procedureMaps.map((row) => (
                <ProcedureMapProtocolForm
                  key={row.id}
                  studyId={studyId}
                  organizationId={organizationId}
                  row={row}
                />
              ))}
            </div>
          )}
        </div>
      </div>
    </section>
  )
}
