'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { AlertTriangle, CheckCircle, Clock, Loader2, Zap } from 'lucide-react'
import type { AmendmentAction, AmendmentActionPlan } from '@/lib/amendment-runtime/generate-amendment-actions'
import type { ActivationResult } from '@/lib/amendment-runtime/activate-amendment-actions'

type Props = {
  studyId: string
  protocolVersionId: string
  organizationId: string
  subjectCount: number
  diff: {
    requiresReconsent: boolean
    requiresTrainingReview: boolean
    operationalImpactScore: number
  }
}

function priorityBadge(priority: AmendmentAction['priority']) {
  switch (priority) {
    case 'high':
      return (
        <span className="inline-flex items-center rounded-full border border-red-200 bg-red-50 px-2 py-0.5 text-xs font-semibold text-red-700">
          High
        </span>
      )
    case 'medium':
      return (
        <span className="inline-flex items-center rounded-full border border-yellow-200 bg-yellow-50 px-2 py-0.5 text-xs font-semibold text-yellow-700">
          Medium
        </span>
      )
    case 'low':
      return (
        <span className="inline-flex items-center rounded-full border border-blue-200 bg-blue-50 px-2 py-0.5 text-xs font-semibold text-blue-700">
          Low
        </span>
      )
  }
}

function ActionRow({ action }: { action: AmendmentAction }) {
  return (
    <div className="flex items-start justify-between gap-3 py-3 border-b border-slate-100 last:border-0">
      <div className="flex-1 min-w-0">
        <div className="flex flex-wrap items-center gap-2 mb-1">
          {priorityBadge(action.priority)}
          <span className="text-xs font-medium text-slate-700 capitalize">
            {action.actionType.replace(/_/g, ' ')}
          </span>
        </div>
        <p className="text-xs text-slate-500 leading-relaxed">{action.description}</p>
      </div>
      <div className="shrink-0 text-right space-y-1">
        <p className="text-xs text-slate-500">
          {action.affectedCount} affected
        </p>
        {action.dueWithinDays !== null && (
          <p className="flex items-center gap-1 text-xs text-slate-400">
            <Clock className="h-3 w-3" />
            {action.dueWithinDays}d
          </p>
        )}
      </div>
    </div>
  )
}

export function AmendmentActionPanel({
  studyId,
  protocolVersionId,
  organizationId,
  subjectCount,
  diff,
}: Props) {
  const router = useRouter()
  const [plan, setPlan] = useState<AmendmentActionPlan | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [activationResult, setActivationResult] = useState<ActivationResult | null>(null)
  const [activating, setActivating] = useState(false)
  const [activationError, setActivationError] = useState<string | null>(null)

  const showActivateButton =
    plan !== null ||
    diff.requiresReconsent ||
    diff.requiresTrainingReview ||
    diff.operationalImpactScore > 50

  async function handleGenerate() {
    setLoading(true)
    setError(null)

    try {
      const res = await fetch(`/api/amendments/${studyId}/actions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          organization_id: organizationId,
          protocol_version_id: protocolVersionId,
          subject_count: subjectCount,
        }),
      })

      if (!res.ok) {
        const body = (await res.json()) as { error?: string }
        throw new Error(body.error ?? `Request failed (${res.status})`)
      }

      const data = (await res.json()) as { actionPlan: AmendmentActionPlan }
      setPlan(data.actionPlan)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to generate action plan')
    } finally {
      setLoading(false)
    }
  }

  async function handleActivate() {
    setActivating(true)
    setActivationError(null)

    try {
      const res = await fetch(`/api/amendments/${studyId}/${protocolVersionId}/activate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          organization_id: organizationId,
          requires_reconsent: diff.requiresReconsent || diff.operationalImpactScore > 50,
          requires_training_review: diff.requiresTrainingReview,
        }),
      })

      if (!res.ok) {
        const body = (await res.json()) as { error?: string }
        throw new Error(body.error ?? `Request failed (${res.status})`)
      }

      const data = (await res.json()) as { result: ActivationResult }
      setActivationResult(data.result)
      router.refresh()
    } catch (err) {
      setActivationError(err instanceof Error ? err.message : 'Failed to activate amendment actions')
    } finally {
      setActivating(false)
    }
  }

  return (
    <div className="rounded-lg border border-slate-200 bg-white overflow-hidden">
      <div className="flex items-center justify-between gap-3 px-5 py-4 bg-slate-50 border-b border-slate-200">
        <div className="flex items-center gap-2">
          <Zap className="h-4 w-4 text-slate-400" />
          <h3 className="text-sm font-semibold text-slate-900">Amendment Action Plan</h3>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handleGenerate}
            disabled={loading}
            className="inline-flex items-center gap-1.5 rounded-md border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 shadow-sm hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {loading ? (
              <>
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                Generating…
              </>
            ) : (
              'Generate Action Plan'
            )}
          </button>
          {showActivateButton && (
            <button
              onClick={handleActivate}
              disabled={activating}
              className="inline-flex items-center gap-1.5 rounded-md border border-indigo-300 bg-indigo-50 px-3 py-1.5 text-xs font-medium text-indigo-700 shadow-sm hover:bg-indigo-100 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {activating ? (
                <>
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  Activating…
                </>
              ) : (
                'Activate Amendment Actions'
              )}
            </button>
          )}
        </div>
      </div>

      {error && (
        <div className="px-5 py-3 text-xs text-red-600 bg-red-50 border-b border-red-100">
          {error}
        </div>
      )}

      {activationError && (
        <div className="px-5 py-3 text-xs text-red-600 bg-red-50 border-b border-red-100">
          {activationError}
        </div>
      )}

      {activationResult && (
        <div className="flex items-start gap-2 px-5 py-3 text-xs text-green-700 bg-green-50 border-b border-green-100">
          <CheckCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          <span>
            {activationResult.subjectImpactsCreated} subject impact{activationResult.subjectImpactsCreated !== 1 ? 's' : ''} created
            {activationResult.subjectImpactsSkipped > 0 && `, ${activationResult.subjectImpactsSkipped} already on record`}
            {activationResult.trainingAssignmentsCreated > 0 && `, ${activationResult.trainingAssignmentsCreated} training assignment${activationResult.trainingAssignmentsCreated !== 1 ? 's' : ''} created`}
          </span>
        </div>
      )}

      {plan && (
        <>
          {/* Summary line */}
          <div className="px-5 py-3 border-b border-slate-100">
            {plan.requiresImmediateAction ? (
              <p className="flex items-center gap-1.5 text-xs font-semibold text-red-700">
                <AlertTriangle className="h-3.5 w-3.5" />
                {plan.totalHighPriority} high-priority action{plan.totalHighPriority > 1 ? 's' : ''} require immediate attention
              </p>
            ) : (
              <p className="flex items-center gap-1.5 text-xs font-semibold text-green-700">
                <CheckCircle className="h-3.5 w-3.5" />
                Action plan ready
              </p>
            )}
          </div>

          {/* Action list */}
          <div className="px-5">
            {plan.actions.map((action, i) => (
              <ActionRow key={`${action.actionType}-${i}`} action={action} />
            ))}
          </div>
        </>
      )}

      {!plan && !loading && !error && (
        <div className="px-5 py-8 text-center">
          <p className="text-xs text-slate-400">
            Generate an action plan to see what operational steps this amendment requires.
          </p>
        </div>
      )}
    </div>
  )
}
