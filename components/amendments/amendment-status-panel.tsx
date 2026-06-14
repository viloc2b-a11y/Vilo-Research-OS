'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { CheckCircle, Clock, FileCheck, Send } from 'lucide-react'

export type AmendmentLifecycleStatus = 'pending' | 'submitted' | 'irb_review' | 'approved' | 'activated'

export type AmendmentStatusRecord = {
  status: AmendmentLifecycleStatus
  submitted_at: string | null
  irb_review_at: string | null
  approved_at: string | null
  activated_at: string | null
}

type Props = {
  studyId: string
  protocolVersionId: string
  organizationId: string
  statusRecord: AmendmentStatusRecord | null
}

const STATUS_LABELS: Record<AmendmentLifecycleStatus, string> = {
  pending: 'Pending',
  submitted: 'Submitted to IRB',
  irb_review: 'In IRB Review',
  approved: 'IRB Approved',
  activated: 'Activated',
}

const STATUS_COLORS: Record<AmendmentLifecycleStatus, string> = {
  pending: 'bg-slate-50 border-slate-200 text-slate-700',
  submitted: 'bg-blue-50 border-blue-200 text-blue-800',
  irb_review: 'bg-violet-50 border-violet-200 text-violet-800',
  approved: 'bg-amber-50 border-amber-200 text-amber-800',
  activated: 'bg-green-50 border-green-200 text-green-800',
}

const NEXT_TRANSITION: Record<AmendmentLifecycleStatus, AmendmentLifecycleStatus | null> = {
  pending: 'submitted',
  submitted: 'irb_review',
  irb_review: 'approved',
  approved: null,
  activated: null,
}

const TRANSITION_LABELS: Partial<Record<AmendmentLifecycleStatus, string>> = {
  submitted: 'Submit to IRB',
  irb_review: 'Mark as In IRB Review',
  approved: 'Mark as IRB Approved',
}

function statusIcon(status: AmendmentLifecycleStatus) {
  switch (status) {
    case 'activated':
      return <CheckCircle className="h-3.5 w-3.5 text-green-600" />
    case 'approved':
      return <FileCheck className="h-3.5 w-3.5 text-amber-600" />
    case 'submitted':
    case 'irb_review':
      return <Send className="h-3.5 w-3.5 text-blue-600" />
    default:
      return <Clock className="h-3.5 w-3.5 text-slate-400" />
  }
}

export function AmendmentStatusPanel({ studyId, protocolVersionId, organizationId, statusRecord }: Props) {
  const router = useRouter()
  const current = statusRecord?.status ?? 'pending'
  const nextStatus = NEXT_TRANSITION[current]

  const [transitioning, setTransitioning] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleTransition() {
    if (!nextStatus) return
    setTransitioning(true)
    setError(null)

    try {
      const res = await fetch(`/api/amendments/${studyId}/${protocolVersionId}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ organization_id: organizationId, status: nextStatus }),
      })

      if (!res.ok) {
        const body = (await res.json()) as { error?: string }
        throw new Error(body.error ?? `Request failed (${res.status})`)
      }

      router.refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Status update failed')
    } finally {
      setTransitioning(false)
    }
  }

  const activatedAt = statusRecord?.activated_at
    ? new Date(statusRecord.activated_at).toLocaleDateString(undefined, { dateStyle: 'medium' })
    : null

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-slate-200 bg-white px-4 py-3">
      <div className="flex items-center gap-2">
        {statusIcon(current)}
        <span className={`rounded-full border px-2.5 py-0.5 text-xs font-semibold ${STATUS_COLORS[current]}`}>
          {STATUS_LABELS[current]}
        </span>
        {activatedAt && (
          <span className="text-xs text-slate-400">activated {activatedAt}</span>
        )}
      </div>

      <div className="flex items-center gap-2">
        {error && <span className="text-xs text-red-600">{error}</span>}
        {nextStatus && TRANSITION_LABELS[nextStatus] && (
          <button
            onClick={handleTransition}
            disabled={transitioning}
            className="inline-flex items-center gap-1.5 rounded-md border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 shadow-sm hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50 transition-colors"
          >
            {transitioning ? 'Updating…' : TRANSITION_LABELS[nextStatus]}
          </button>
        )}
        {current === 'approved' && (
          <span className="text-xs text-slate-400">Ready — use Activate button below</span>
        )}
      </div>
    </div>
  )
}
