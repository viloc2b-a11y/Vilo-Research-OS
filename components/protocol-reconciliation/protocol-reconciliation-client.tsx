'use client'

import { useCallback, useEffect, useState } from 'react'
import type { LoadedReconciliationWorkspace } from '@/lib/protocol-reconciliation/protocol-reconciliation-types'
import { ManualProcedureDialog } from './manual-procedure-dialog'
import { ManualVisitDialog } from './manual-visit-dialog'
import { ProcedureReconciliationList } from './procedure-reconciliation-list'
import { ReconciliationStatusSummary } from './reconciliation-status-summary'
import { ReconciliationVersionSelector } from './reconciliation-version-selector'
import { VisitReconciliationList } from './visit-reconciliation-list'

export function ProtocolReconciliationClient(props: { organizationId: string }) {
  const [selectedVersionId, setSelectedVersionId] = useState<string | null>(null)
  const [workspace, setWorkspace] = useState<LoadedReconciliationWorkspace | null>(null)
  const [refreshKey, setRefreshKey] = useState(0)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [actionMessage, setActionMessage] = useState<string | null>(null)

  const refresh = useCallback(() => setRefreshKey((v) => v + 1), [])

  useEffect(() => {
    const versionId = selectedVersionId
    if (!versionId) return
    let cancelled = false
    async function load(activeVersionId: string) {
      setLoading(true)
      setError(null)
      try {
        const res = await fetch(
          `/api/protocol-reconciliation/workspace/${encodeURIComponent(activeVersionId)}?organization_id=${encodeURIComponent(props.organizationId)}`,
        )
        const data = (await res.json()) as { workspace?: LoadedReconciliationWorkspace; error?: string }
        if (!res.ok) throw new Error(data.error || 'Failed to load workspace')
        if (!cancelled) setWorkspace(data.workspace ?? null)
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Failed to load workspace')
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    void load(versionId)
    return () => {
      cancelled = true
    }
  }, [props.organizationId, selectedVersionId, refreshKey])

  async function runInitialize() {
    if (!selectedVersionId) return
    setActionMessage(null)
    const res = await fetch(
      `/api/protocol-reconciliation/initialize/${encodeURIComponent(selectedVersionId)}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ organization_id: props.organizationId }),
      },
    )
    const data = (await res.json()) as { error?: string; visitCount?: number; procedureCount?: number }
    if (!res.ok) throw new Error(data.error || 'Initialize failed')
    setActionMessage(`Initialized ${data.visitCount ?? 0} visits and ${data.procedureCount ?? 0} procedures.`)
    refresh()
  }

  async function runSuggestMatches() {
    if (!selectedVersionId) return
    setActionMessage(null)
    const res = await fetch(
      `/api/protocol-reconciliation/suggest-matches/${encodeURIComponent(selectedVersionId)}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ organization_id: props.organizationId }),
      },
    )
    const data = (await res.json()) as {
      error?: string
      matchedCount?: number
      needsReviewCount?: number
    }
    if (!res.ok) throw new Error(data.error || 'Suggest matches failed')
    setActionMessage(
      `Suggested matches: ${data.matchedCount ?? 0} matched, ${data.needsReviewCount ?? 0} need review.`,
    )
    refresh()
  }

  return (
    <div className="space-y-6">
      <ReconciliationVersionSelector
        organizationId={props.organizationId}
        selectedVersionId={selectedVersionId}
        onSelect={setSelectedVersionId}
      />

      {selectedVersionId ? (
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => void runInitialize().catch((err) => setError(err instanceof Error ? err.message : 'Initialize failed'))}
            className="rounded-md bg-teal-700 px-3 py-1.5 text-sm font-medium text-white hover:bg-teal-800"
          >
            Initialize from candidates
          </button>
          <button
            type="button"
            onClick={() => void runSuggestMatches().catch((err) => setError(err instanceof Error ? err.message : 'Suggest failed'))}
            className="rounded-md border border-slate-300 px-3 py-1.5 text-sm text-slate-700 hover:bg-slate-50"
          >
            Suggest procedure matches
          </button>
        </div>
      ) : null}

      {actionMessage ? <p className="text-sm text-slate-600">{actionMessage}</p> : null}
      {loading ? <p className="text-sm text-slate-500">Loading reconciliation workspace…</p> : null}
      {error ? <p className="text-sm text-red-600">{error}</p> : null}

      {workspace ? (
        <>
          <ReconciliationStatusSummary summary={workspace.summary} versionLabel={workspace.versionLabel} />

          <section className="space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 className="text-sm font-semibold text-slate-900">Visit reconciliations</h2>
              <ManualVisitDialog
                organizationId={props.organizationId}
                protocolVersionId={workspace.protocolVersionId}
                onCreated={refresh}
              />
            </div>
            <VisitReconciliationList
              organizationId={props.organizationId}
              visits={workspace.visitReconciliations}
              onUpdated={refresh}
            />
          </section>

          <section className="space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 className="text-sm font-semibold text-slate-900">Procedure reconciliations</h2>
              <ManualProcedureDialog
                organizationId={props.organizationId}
                protocolVersionId={workspace.protocolVersionId}
                visits={workspace.visitReconciliations}
                onCreated={refresh}
              />
            </div>
            <ProcedureReconciliationList
              organizationId={props.organizationId}
              procedures={workspace.procedureReconciliations}
              onUpdated={refresh}
            />
          </section>

          <section>
            <h2 className="mb-2 text-sm font-semibold text-slate-900">Recent events</h2>
            <div className="vilo-scroll-contained max-h-48 overflow-y-auto rounded border border-slate-200 bg-white p-3 text-xs text-slate-600">
              {workspace.events.length === 0 ? (
                <p>No reconciliation events yet.</p>
              ) : (
                <ul className="space-y-1">
                  {workspace.events.slice(0, 20).map((event) => (
                    <li key={event.id}>
                      {event.eventType} · {new Date(event.eventTimestamp).toLocaleString()}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </section>
        </>
      ) : null}
    </div>
  )
}
