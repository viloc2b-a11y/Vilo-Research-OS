'use client'

import { useEffect, useState } from 'react'
import {
  ACKNOWLEDGEMENT_TYPE_LABELS,
  SIGNATURE_MEANING_LABELS,
  type PendingObligationView,
} from '@/lib/document-intake/obligation-types'
import { CompleteObligationButton } from './complete-obligation-button'

type PendingObligationsPanelProps = {
  organizationId: string
  refreshKey?: number
  onObligationChanged?: () => void
}

function formatWhen(iso: string | null): string {
  if (!iso) return '—'
  try {
    return new Date(iso).toLocaleString()
  } catch {
    return iso
  }
}

function actionLabel(obligation: PendingObligationView): string {
  if (obligation.obligationType === 'signature' && obligation.signatureMeaning) {
    return `Signature · ${SIGNATURE_MEANING_LABELS[obligation.signatureMeaning]}`
  }
  if (obligation.obligationType === 'acknowledgement' && obligation.acknowledgementType) {
    return `Acknowledgement · ${ACKNOWLEDGEMENT_TYPE_LABELS[obligation.acknowledgementType]}`
  }
  return obligation.obligationType
}

function assigneeLabel(obligation: PendingObligationView): string {
  if (obligation.assignedUserId) return `User ${obligation.assignedUserId.slice(0, 8)}…`
  if (obligation.assignedRole) return `Role: ${obligation.assignedRole.replace(/_/g, ' ')}`
  return 'Unassigned'
}

export function PendingObligationsPanel({
  organizationId,
  refreshKey = 0,
  onObligationChanged,
}: PendingObligationsPanelProps) {
  const [obligations, setObligations] = useState<PendingObligationView[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  useEffect(() => {
    let cancelled = false

    async function load() {
      try {
        const res = await fetch(
          `/api/document-intake/obligations?organization_id=${encodeURIComponent(organizationId)}`,
        )
        const data = (await res.json()) as { obligations?: PendingObligationView[]; error?: string }
        if (!res.ok) throw new Error(data.error || 'Could not load obligations')
        if (!cancelled) {
          setObligations(data.obligations ?? [])
          setError(null)
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Could not load obligations')
          setObligations([])
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    void load()

    return () => {
      cancelled = true
    }
  }, [organizationId, refreshKey])

  return (
    <div className="mx-auto max-w-2xl rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
      <h2 className="mb-1 text-xl font-bold text-slate-800">Pending obligations</h2>
      <p className="mb-4 text-sm text-slate-500">Signature and acknowledgement requests awaiting completion.</p>

      {loading ? <p className="text-sm text-slate-500">Loading…</p> : null}
      {error ? <p className="text-sm text-red-600">{error}</p> : null}

      {!loading && !error && obligations.length === 0 ? (
        <p className="text-sm text-slate-500">No pending obligations.</p>
      ) : null}

      <div className="space-y-4">
        {obligations.map((obligation) => (
          <div
            key={obligation.id}
            className="flex flex-col gap-2 rounded-md border border-slate-100 bg-slate-50 p-4 sm:flex-row sm:items-start sm:justify-between"
          >
            <div className="min-w-0 flex-1 space-y-1">
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-medium text-slate-800">{obligation.documentOperationalDisplayName}</span>
                <span className="rounded-full bg-slate-200 px-2 py-0.5 text-xs text-slate-700">
                  {obligation.documentClassification}
                </span>
                <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-800">
                  {obligation.status}
                </span>
              </div>
              <p className="text-sm text-slate-600">{actionLabel(obligation)}</p>
              <p className="text-xs text-slate-500">
                Assigned: {assigneeLabel(obligation)} · Due: {formatWhen(obligation.dueDate)} · Requested{' '}
                {formatWhen(obligation.requestedAt)}
              </p>
            </div>
            <CompleteObligationButton
              organizationId={organizationId}
              obligationId={obligation.id}
              obligationType={obligation.obligationType}
              onCompleted={onObligationChanged}
            />
          </div>
        ))}
      </div>
    </div>
  )
}
