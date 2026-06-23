'use client'

import type { StartupReadinessResult } from '@/lib/study-workspace/study-startup-readiness'

// ── Colors ────────────────────────────────────────────────────────────────────

function scoreColor(score: number): string {
  if (score >= 80) return 'text-green-600'
  if (score >= 50) return 'text-amber-600'
  if (score >= 25) return 'text-orange-600'
  return 'text-red-600'
}

function scoreBg(score: number): string {
  if (score >= 80) return 'bg-green-500'
  if (score >= 50) return 'bg-amber-500'
  if (score >= 25) return 'bg-orange-500'
  return 'bg-red-500'
}

function labelBadge(label: string): { color: string; bg: string } {
  switch (label) {
    case 'Ready': return { color: 'text-green-700', bg: 'bg-green-100' }
    case 'Almost Ready': return { color: 'text-amber-700', bg: 'bg-amber-100' }
    case 'At Risk': return { color: 'text-orange-700', bg: 'bg-orange-100' }
    case 'Not Ready': return { color: 'text-red-700', bg: 'bg-red-100' }
    default: return { color: 'text-slate-700', bg: 'bg-slate-100' }
  }
}

// ── Score Ring ────────────────────────────────────────────────────────────────

function ScoreRing({ score, label, size = 'lg' }: { score: number; label: string; size?: 'sm' | 'lg' }) {
  const dim = size === 'lg' ? 120 : 80
  const stroke = size === 'lg' ? 8 : 6
  const radius = (dim - stroke) / 2
  const circumference = 2 * Math.PI * radius
  const offset = circumference - (score / 100) * circumference

  return (
    <div className="flex flex-col items-center">
      <svg width={dim} height={dim} className="-rotate-90">
        <circle cx={dim / 2} cy={dim / 2} r={radius} fill="none" stroke="#e2e8f0" strokeWidth={stroke} />
        <circle
          cx={dim / 2}
          cy={dim / 2}
          r={radius}
          fill="none"
          stroke="currentColor"
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          className={scoreColor(score)}
        />
      </svg>
      <div className="absolute flex flex-col items-center">
        <span className={`font-bold ${size === 'lg' ? 'text-2xl' : 'text-base'} ${scoreColor(score)}`}>
          {score}%
        </span>
      </div>
    </div>
  )
}

// ── Status Badge ──────────────────────────────────────────────────────────────

function StatusBadge({ label }: { label: string }) {
  const { color, bg } = labelBadge(label)
  return (
    <span className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold ${bg} ${color}`}>
      {label}
    </span>
  )
}

// ── Section Card ──────────────────────────────────────────────────────────────

function SectionCard({
  title,
  score,
  children,
}: {
  title: string
  score: number
  children: React.ReactNode
}) {
  return (
    <div className="rounded-md border border-slate-200 bg-white p-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-slate-800">{title}</h3>
        <span className={`text-lg font-bold ${scoreColor(score)}`}>{score}%</span>
      </div>
      <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-slate-100">
        <div className={`h-full rounded-full ${scoreBg(score)}`} style={{ width: `${score}%` }} />
      </div>
      <div className="mt-3 space-y-1 text-xs text-slate-600">{children}</div>
    </div>
  )
}

// ── Blocker Item ──────────────────────────────────────────────────────────────

function BlockerItem({ text }: { text: string }) {
  return (
    <div className="flex items-start gap-2 rounded-md border border-red-100 bg-red-50 p-2 text-xs text-red-700">
      <span className="mt-0.5 font-bold text-red-500">✗</span>
      <span>{text}</span>
    </div>
  )
}

// ── Recommendation Item ───────────────────────────────────────────────────────

function RecommendationItem({ text }: { text: string }) {
  return (
    <div className="flex items-start gap-2 rounded-md border border-teal-100 bg-teal-50 p-2 text-xs text-teal-700">
      <span className="mt-0.5 font-bold text-teal-500">→</span>
      <span>{text}</span>
    </div>
  )
}

// ── Main Component ────────────────────────────────────────────────────────────

export function StudyStartupWorkspaceView({
  readiness,
}: {
  readiness: StartupReadinessResult
}) {
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-sm font-semibold text-slate-800">Study Startup Workspace</h2>
          <p className="mt-1 text-sm text-slate-500">
            Operational readiness for study activation. All scores derived from live runtime data.
          </p>
        </div>
        <StatusBadge label={readiness.startupLabel} />
      </div>

      {/* Overall Score */}
      <div className="flex flex-col items-center py-6">
        <div className="relative">
          <ScoreRing score={readiness.startupScore} label={readiness.startupLabel} />
        </div>
        <p className="mt-4 text-sm font-medium text-slate-600">
          Startup Readiness Score
        </p>
        <p className="text-xs text-slate-400">
          System (30%) · Access (35%) · Enrollment (35%)
        </p>
      </div>

      {/* Blockers */}
      {readiness.blockers.length > 0 && (
        <div className="space-y-2">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-red-600">
            Blockers ({readiness.blockers.length})
          </h3>
          <div className="space-y-1.5">
            {readiness.blockers.map((b, i) => (
              <BlockerItem key={i} text={b} />
            ))}
          </div>
        </div>
      )}

      {/* Recommendations */}
      <div className="space-y-2">
        <h3 className="text-xs font-semibold uppercase tracking-wide text-teal-600">
          Recommended Actions
        </h3>
        <div className="space-y-1.5">
          {readiness.recommendations.map((r, i) => (
            <RecommendationItem key={i} text={r} />
          ))}
        </div>
      </div>

      {/* Sub-sections */}
      <div className="grid gap-4 sm:grid-cols-2">
        {/* System Readiness */}
        <SectionCard title="System Readiness" score={readiness.systemReadiness.score}>
          <p>Total systems: {readiness.systemReadiness.totalSystems}</p>
          <p>Configured: {readiness.systemReadiness.configuredSystems}</p>
          <p>Inactive: {readiness.systemReadiness.inactiveSystems}</p>
          {readiness.systemReadiness.systemsMissingUrls > 0 && (
            <p className="text-amber-600">
              {readiness.systemReadiness.systemsMissingUrls} system(s) missing URLs
            </p>
          )}
        </SectionCard>

        {/* Access Readiness */}
        <SectionCard title="Access Readiness" score={readiness.accessReadiness.score}>
          <p>Pending requests: {readiness.accessReadiness.pendingRequests}</p>
          <p>Access issues: {readiness.accessReadiness.accessIssues}</p>
          {readiness.accessReadiness.blockers.length > 0 && (
            <p className="text-red-600">
              {readiness.accessReadiness.blockers.length} blocker(s)
            </p>
          )}
        </SectionCard>

        {/* Technology Readiness */}
        <SectionCard title="Technology Readiness" score={readiness.technologyReadiness.healthScore}>
          <p>Complexity: {readiness.technologyReadiness.complexityLabel}</p>
          <p>Dependency: {readiness.technologyReadiness.dependencyLabel}</p>
          <p>Health: {readiness.technologyReadiness.healthLabel}</p>
          {readiness.technologyReadiness.criticalRiskCount > 0 && (
            <p className="text-red-600">
              {readiness.technologyReadiness.criticalRiskCount} critical risk(s)
            </p>
          )}
        </SectionCard>

        {/* Enrollment Readiness */}
        <SectionCard
          title="Enrollment Readiness"
          score={readiness.enrollmentReadiness.ready ? 100 : 0}
        >
          {readiness.enrollmentReadiness.ready ? (
            <p className="text-green-600">Ready for enrollment</p>
          ) : (
            <>
              <p className="text-red-600">Blocked</p>
              {readiness.enrollmentReadiness.blockers.map((b, i) => (
                <p key={i} className="text-xs text-slate-500">{b}</p>
              ))}
            </>
          )}
        </SectionCard>
      </div>
    </div>
  )
}

// ── Command Center Summary Card ───────────────────────────────────────────────

export function StartupReadinessCard({
  readiness,
}: {
  readiness: StartupReadinessResult
}) {
  const { color, bg } = labelBadge(readiness.startupLabel)

  return (
    <div className="rounded-md border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-slate-800">Startup Readiness</h3>
        <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold ${bg} ${color}`}>
          {readiness.startupLabel}
        </span>
      </div>
      <div className="mt-3 grid grid-cols-2 gap-3 text-xs">
        <div>
          <p className="text-slate-400">Score</p>
          <p className={`text-lg font-bold ${scoreColor(readiness.startupScore)}`}>
            {readiness.startupScore}%
          </p>
        </div>
        <div>
          <p className="text-slate-400">Blockers</p>
          <p className={`font-semibold ${readiness.blockers.length > 0 ? 'text-red-600' : 'text-green-600'}`}>
            {readiness.blockers.length}
          </p>
        </div>
        <div>
          <p className="text-slate-400">Systems</p>
          <p className="font-semibold text-slate-700">
            {readiness.systemReadiness.configuredSystems}/{readiness.systemReadiness.totalSystems}
          </p>
        </div>
        <div>
          <p className="text-slate-400">Access Issues</p>
          <p className={`font-semibold ${readiness.accessReadiness.accessIssues > 0 ? 'text-red-600' : 'text-green-600'}`}>
            {readiness.accessReadiness.accessIssues}
          </p>
        </div>
      </div>
    </div>
  )
}
