'use client'

import { useEffect, useState } from 'react'
import type { LoadedVisitWorkspace } from '@/lib/visit-runtime-execution/visit-runtime-types'
import { LockVisitButton } from '@/components/visit-runtime-locking/lock-visit-button'
import { VisitLockStatusBanner } from '@/components/visit-runtime-locking/visit-lock-status-banner'
import { VisitSnapshotViewer } from '@/components/visit-runtime-locking/visit-snapshot-viewer'
import type { VisitRuntimeSnapshotRow } from '@/lib/visit-runtime-locking/visit-locking-types'
import { CompleteVisitButton } from './complete-visit-button'
import { ProcedureExecutionCard } from './procedure-execution-card'
import { StartVisitButton } from './start-visit-button'
import { VisitRuntimeEventTimeline } from './visit-runtime-event-timeline'

type VisitWorkspaceProps = {
  organizationId: string
  visitInstanceId: string
  refreshKey: number
  procedureFieldDefinitions: Record<
    string,
    Array<{ field_id: string; label: string; type: string; required?: boolean }>
  >
  onUpdated: () => void
}

export function VisitWorkspace({
  organizationId,
  visitInstanceId,
  refreshKey,
  procedureFieldDefinitions,
  onUpdated,
}: VisitWorkspaceProps) {
  const [workspace, setWorkspace] = useState<LoadedVisitWorkspace | null>(null)
  const [snapshot, setSnapshot] = useState<VisitRuntimeSnapshotRow | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    async function load() {
      setLoading(true)
      setError(null)
      try {
        const res = await fetch(
          `/api/visit-runtime/instances/${encodeURIComponent(visitInstanceId)}?organization_id=${encodeURIComponent(organizationId)}`,
        )
        const data = (await res.json()) as LoadedVisitWorkspace & { error?: string }
        if (!res.ok) throw new Error(data.error || 'Failed to load workspace')
        if (!cancelled) {
          setWorkspace({
            visitInstance: data.visitInstance,
            procedureInstances: data.procedureInstances ?? [],
            events: data.events ?? [],
          })
          if (data.visitInstance?.lockStatus === 'locked') {
            const snapRes = await fetch(
              `/api/visit-runtime/instances/${encodeURIComponent(visitInstanceId)}/snapshot?organization_id=${encodeURIComponent(organizationId)}`,
            )
            const snapData = (await snapRes.json()) as { snapshot?: VisitRuntimeSnapshotRow }
            if (snapRes.ok && snapData.snapshot) setSnapshot(snapData.snapshot)
          } else {
            setSnapshot(null)
          }
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Failed to load workspace')
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    void load()
    return () => {
      cancelled = true
    }
  }, [organizationId, visitInstanceId, refreshKey])

  async function postJson(url: string, body: Record<string, unknown>) {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    const data = (await res.json()) as { error?: string }
    if (!res.ok) throw new Error(data.error || 'Request failed')
    onUpdated()
  }

  if (loading) return <p className="text-sm text-slate-500">Loading workspace…</p>
  if (error) return <p className="text-sm text-red-600">{error}</p>
  if (!workspace) return <p className="text-sm text-slate-500">Workspace not found.</p>

  const { visitInstance, procedureInstances, events } = workspace
  const isLocked = visitInstance.lockStatus === 'locked'
  const readOnly =
    isLocked
    || visitInstance.visitStatus === 'completed'
    || visitInstance.visitStatus === 'cancelled'

  return (
    <div className="space-y-6">
      <VisitLockStatusBanner
        lockStatus={visitInstance.lockStatus}
        snapshotHash={snapshot?.snapshotHash}
      />

      <header className="rounded-md border border-slate-200 bg-white p-4">
        <h2 className="text-lg font-semibold text-slate-900">
          {visitInstance.visitCode} · {visitInstance.visitName}
        </h2>
        <p className="mt-1 text-sm text-slate-500">
          Status: {visitInstance.visitStatus} · Progress: {visitInstance.progressPercent}%
        </p>
        <div className="mt-3 flex flex-wrap gap-3">
          {visitInstance.visitStatus === 'not_started' && !isLocked ? (
            <StartVisitButton
              onStart={() =>
                postJson(
                  `/api/visit-runtime/instances/${encodeURIComponent(visitInstanceId)}/start`,
                  { organization_id: organizationId },
                )
              }
            />
          ) : null}
          {visitInstance.visitStatus === 'in_progress' && !isLocked ? (
            <CompleteVisitButton
              onComplete={() =>
                postJson(
                  `/api/visit-runtime/instances/${encodeURIComponent(visitInstanceId)}/complete`,
                  { organization_id: organizationId },
                )
              }
            />
          ) : null}
          {visitInstance.visitStatus === 'completed' && !isLocked ? (
            <LockVisitButton
              onLock={(lockReason) =>
                postJson(
                  `/api/visit-runtime/instances/${encodeURIComponent(visitInstanceId)}/lock`,
                  { organization_id: organizationId, lock_reason: lockReason },
                )
              }
            />
          ) : null}
        </div>
      </header>

      {snapshot ? <VisitSnapshotViewer snapshot={snapshot} /> : null}

      <section className="space-y-3">
        <h3 className="text-sm font-semibold text-slate-800">Procedures</h3>
        {procedureInstances.map((procedure) => (
          <ProcedureExecutionCard
            key={procedure.id}
            procedureInstance={procedure}
            fieldDefinitions={procedureFieldDefinitions[procedure.procedureShellId] ?? []}
            disabled={readOnly || isLocked}
            onSaveFields={(values) =>
              postJson(
                `/api/visit-runtime/procedures/${encodeURIComponent(procedure.id)}/field-values`,
                { organization_id: organizationId, field_values: values },
              )
            }
            onComplete={() =>
              postJson(
                `/api/visit-runtime/procedures/${encodeURIComponent(procedure.id)}/complete`,
                { organization_id: organizationId },
              )
            }
            onSkip={(reason) =>
              postJson(
                `/api/visit-runtime/procedures/${encodeURIComponent(procedure.id)}/skip`,
                { organization_id: organizationId, reason },
              )
            }
          />
        ))}
      </section>

      <section>
        <h3 className="mb-2 text-sm font-semibold text-slate-800">Event timeline</h3>
        <VisitRuntimeEventTimeline events={events} />
      </section>
    </div>
  )
}
