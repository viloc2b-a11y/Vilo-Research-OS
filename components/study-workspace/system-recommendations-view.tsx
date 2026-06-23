'use client'

import type { RecommendedSystemResult, GetRecommendedSystemsOutput } from '@/lib/study-workspace/system-recommendations'
import { recordSystemLaunch } from '@/lib/study-workspace/study-systems-actions'

// ── Recommended System Badge ──────────────────────────────────────────────────

function RecommendationBadge({ isDefault }: { isDefault: boolean }) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium ${
        isDefault
          ? 'bg-teal-100 text-teal-700'
          : 'bg-slate-100 text-slate-500'
      }`}
    >
      {isDefault ? 'Recommended' : 'Alternative'}
    </span>
  )
}

// ── Recommended System Card ───────────────────────────────────────────────────

export function RecommendedSystemCard({
  result,
}: {
  result: RecommendedSystemResult
}) {
  const { system, isRegistered, isDefault } = result

  return (
    <div
      className={`rounded-md border p-3 ${
        isDefault
          ? 'border-teal-200 bg-teal-50'
          : isRegistered
            ? 'border-slate-200 bg-white'
            : 'border-slate-200 bg-slate-50 opacity-70'
      }`}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <p className="text-sm font-medium text-slate-800">
              {system.system_name}
            </p>
            <RecommendationBadge isDefault={isDefault} />
          </div>
          <p className="mt-0.5 text-xs text-slate-400">
            {system.vendor_name}
            {system.vendor_name && system.system_type && <span> · </span>}
            {system.system_type}
          </p>
          <div className="mt-1 flex items-center gap-2 text-[10px]">
            <span className="text-slate-400">Weight: {system.recommendation_weight}</span>
            {isRegistered ? (
              <span className="inline-flex items-center gap-0.5 text-green-600">
                <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                </svg>
                Registered
              </span>
            ) : (
              <span className="text-amber-500">Not registered</span>
            )}
          </div>
        </div>
        {system.default_url && isRegistered && (
          <a
            href={system.default_url}
            target="_blank"
            rel="noopener noreferrer"
            onClick={() => recordSystemLaunch(system.system_library_id, '')}
            className="inline-flex shrink-0 items-center gap-1 rounded bg-slate-900 px-2.5 py-1.5 text-[10px] font-medium text-white hover:bg-slate-800"
          >
            Launch
          </a>
        )}
      </div>
    </div>
  )
}

// ── Recommended Systems Section ───────────────────────────────────────────────
// Shows the full recommendation output for a task/activity.

export function RecommendedSystemsSection({
  output,
  activityCode,
  studyId,
  onAddSystem,
}: {
  output: GetRecommendedSystemsOutput
  activityCode: string
  studyId: string
  onAddSystem?: () => void
}) {
  // No recommendations configured at all
  if (output.fallbackReason === 'no_recommendations') {
    return (
      <div className="rounded-md border border-dashed border-slate-200 bg-slate-50 p-4">
        <p className="text-xs font-medium text-slate-500">
          No recommendation configured
        </p>
        <p className="mt-0.5 text-[10px] text-slate-400">
          Activity: {activityCode}
        </p>
      </div>
    )
  }

  // Recommendations exist but no study system matches
  const hasRegistered = output.recommended.some((r) => r.isRegistered)
  if (!hasRegistered && output.recommended.length > 0) {
    return (
      <div className="rounded-md border border-dashed border-amber-200 bg-amber-50 p-4">
        <p className="text-xs font-medium text-amber-700">
          No matching study system registered
        </p>
        <p className="mt-0.5 text-[10px] text-amber-600">
          Register a system for {activityCode} to see recommendations.
        </p>
        {onAddSystem && (
          <button
            type="button"
            onClick={onAddSystem}
            className="mt-2 inline-flex items-center gap-1 rounded bg-amber-700 px-2.5 py-1.5 text-[10px] font-medium text-white hover:bg-amber-800"
          >
            Add System
          </button>
        )}
        {/* Still show available recommendations so coordinator knows what to add */}
        <div className="mt-3 space-y-2">
          {output.recommended.map((r) => (
            <RecommendedSystemCard key={r.system.recommendation_id} result={r} />
          ))}
        </div>
      </div>
    )
  }

  // Show registered recommendations
  const registered = output.recommended.filter((r) => r.isRegistered)
  const notRegistered = output.recommended.filter((r) => !r.isRegistered)

  return (
    <div className="space-y-3">
      {/* Registered (active) recommendations */}
      {registered.length > 0 && (
        <div>
          <p className="mb-2 text-xs font-semibold text-slate-700">
            Recommended Systems
          </p>
          <div className="space-y-2">
            {registered.map((r) => (
              <RecommendedSystemCard key={r.system.recommendation_id} result={r} />
            ))}
          </div>
        </div>
      )}

      {/* Unregistered options */}
      {notRegistered.length > 0 && (
        <div>
          <p className="mb-2 text-xs font-semibold text-slate-400">
            Other Options (not registered for this study)
          </p>
          <div className="space-y-2">
            {notRegistered.slice(0, 3).map((r) => (
              <RecommendedSystemCard key={r.system.recommendation_id} result={r} />
            ))}
          </div>
          {onAddSystem && (
            <button
              type="button"
              onClick={onAddSystem}
              className="mt-2 text-xs text-teal-700 hover:underline"
            >
              + Add from library
            </button>
          )}
        </div>
      )}
    </div>
  )
}

// ── Task Recommended System Widget ────────────────────────────────────────────
// Compact version for use directly in task cards / workflow views.

export function TaskRecommendedSystem({
  output,
  showAllOptions,
}: {
  output: GetRecommendedSystemsOutput
  showAllOptions?: boolean
}) {
  // No recommendations
  if (output.fallbackReason === 'no_recommendations') {
    return (
      <div className="rounded border border-dashed border-slate-200 px-3 py-2">
        <p className="text-[11px] text-slate-400">No recommendation configured</p>
      </div>
    )
  }

  // No matching system
  if (!output.recommended.some((r) => r.isRegistered)) {
    return (
      <div className="rounded border border-dashed border-amber-200 bg-amber-50 px-3 py-2">
        <p className="text-[11px] font-medium text-amber-700">No system registered</p>
        {output.defaultSystem && (
          <p className="text-[10px] text-amber-500">
            Recommended: {output.defaultSystem.system_name}
          </p>
        )}
      </div>
    )
  }

  // Show the default recommended system
  const defaultRec = output.recommended.find((r) => r.isDefault && r.isRegistered)
  const topRec = defaultRec ?? output.recommended.find((r) => r.isRegistered)

  if (!topRec) return null

  return (
    <div className="rounded border border-teal-200 bg-teal-50 px-3 py-2">
      <div className="flex items-center justify-between gap-2">
        <div className="min-w-0 flex-1">
          <p className="text-[11px] font-medium text-teal-800">
            {topRec.system.system_name}
          </p>
          <p className="text-[10px] text-teal-600">
            Recommended for this task
          </p>
        </div>
        {topRec.system.default_url && (
          <a
            href={topRec.system.default_url}
            target="_blank"
            rel="noopener noreferrer"
            onClick={() => recordSystemLaunch(topRec.system.system_library_id, '')}
            className="inline-flex shrink-0 items-center gap-1 rounded bg-teal-700 px-2 py-1 text-[10px] font-medium text-white hover:bg-teal-800"
          >
            Launch
          </a>
        )}
      </div>
    </div>
  )
}
