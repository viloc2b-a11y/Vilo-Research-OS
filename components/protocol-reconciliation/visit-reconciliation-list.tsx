'use client'

import { useState } from 'react'
import type { ProtocolVisitReconciliationRow } from '@/lib/protocol-reconciliation/protocol-reconciliation-types'

export function VisitReconciliationCard(props: {
  organizationId: string
  visit: ProtocolVisitReconciliationRow
  onUpdated: () => void
}) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function postAction(path: 'approve' | 'reject') {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(
        `/api/protocol-reconciliation/visits/${encodeURIComponent(props.visit.id)}/${path}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ organization_id: props.organizationId }),
        },
      )
      const data = (await res.json()) as { error?: string }
      if (!res.ok) throw new Error(data.error || `Failed to ${path} visit`)
      props.onUpdated()
    } catch (err) {
      setError(err instanceof Error ? err.message : `Failed to ${path} visit`)
    } finally {
      setLoading(false)
    }
  }

  return (
    <li className="group rounded border border-slate-200 bg-white p-3 text-sm">
      <div className="flex flex-wrap items-center gap-2">
        <span className="font-medium text-slate-900">
          {props.visit.visitCode} · {props.visit.visitName}
        </span>
        <span className="rounded bg-slate-100 px-2 py-0.5 text-xs text-slate-600">
          {props.visit.reconciliationStatus}
        </span>
        <span className="text-xs text-slate-500">{props.visit.reconciliationSource}</span>
      </div>
      <p className="mt-1 text-xs text-slate-500">
        Day {props.visit.studyDay ?? '—'} · window −{props.visit.windowBeforeDays ?? '—'} / +
        {props.visit.windowAfterDays ?? '—'}
      </p>
      {props.visit.reconciliationStatus !== 'approved' && props.visit.reconciliationStatus !== 'rejected' ? (
        <div className="mt-3 flex flex-wrap gap-2 vilo-hover-reveal opacity-100 md:opacity-0 md:group-hover:opacity-100">
          <button
            type="button"
            disabled={loading}
            onClick={() => void postAction('approve')}
            className="rounded border border-teal-200 px-2 py-1 text-xs text-teal-800 hover:bg-teal-50"
          >
            Approve visit
          </button>
          <button
            type="button"
            disabled={loading}
            onClick={() => void postAction('reject')}
            className="rounded border border-slate-300 px-2 py-1 text-xs text-slate-500 hover:bg-slate-50"
          >
            Reject
          </button>
        </div>
      ) : null}
      {error ? <p className="mt-2 text-xs text-red-600">{error}</p> : null}
    </li>
  )
}

export function VisitReconciliationList(props: {
  organizationId: string
  visits: ProtocolVisitReconciliationRow[]
  onUpdated: () => void
}) {
  if (props.visits.length === 0) {
    return <p className="text-sm text-slate-500">No visit reconciliations yet. Initialize from candidates.</p>
  }
  return (
    <ul className="space-y-2">
      {props.visits.map((visit) => (
        <VisitReconciliationCard
          key={visit.id}
          organizationId={props.organizationId}
          visit={visit}
          onUpdated={props.onUpdated}
        />
      ))}
    </ul>
  )
}
