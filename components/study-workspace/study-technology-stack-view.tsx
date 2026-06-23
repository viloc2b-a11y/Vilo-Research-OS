'use client'

import type { TechnologyStack, TechnologyStackSystem, TechnologyStackMetrics, TechnologyRisk } from '@/lib/study-workspace/load-study-technology-stack'
import { getAccessStatusColor } from '@/lib/study-workspace/study-system-access'

// ── Metric Card ───────────────────────────────────────────────────────────────

function MetricCard({
  label,
  value,
  sub,
  color,
}: {
  label: string
  value: string | number
  sub?: string
  color?: string
}) {
  return (
    <div className="rounded-md border border-slate-200 bg-white p-3">
      <p className="text-[11px] font-medium text-slate-500">{label}</p>
      <p className={`mt-1 text-xl font-bold ${color ?? 'text-slate-900'}`}>{value}</p>
      {sub && <p className="text-[10px] text-slate-400">{sub}</p>}
    </div>
  )
}

// ── Health Bar ────────────────────────────────────────────────────────────────

function HealthBar({
  score,
  label,
  goodColor = 'bg-green-500',
  midColor = 'bg-amber-500',
  badColor = 'bg-red-500',
}: {
  score: number
  label: string
  goodColor?: string
  midColor?: string
  badColor?: string
}) {
  const barColor = score >= 80 ? goodColor : score >= 50 ? midColor : badColor
  const textColor = score >= 80 ? 'text-green-600' : score >= 50 ? 'text-amber-600' : 'text-red-600'
  return (
    <div>
      <div className="flex items-center justify-between text-xs">
        <span className="font-medium text-slate-600">{label}</span>
        <span className={`font-bold ${textColor}`}>{score}%</span>
      </div>
      <div className="mt-1 h-2 w-full overflow-hidden rounded-full bg-slate-100">
        <div className={`h-full rounded-full ${barColor}`} style={{ width: `${score}%` }} />
      </div>
    </div>
  )
}

// ── Risk Badge ────────────────────────────────────────────────────────────────

function RiskBadge({ risk }: { risk: TechnologyRisk }) {
  const colorMap = {
    critical: 'border-red-200 bg-red-50 text-red-700',
    warning: 'border-amber-200 bg-amber-50 text-amber-700',
    info: 'border-blue-200 bg-blue-50 text-blue-700',
  }
  const iconMap = {
    critical: '✗',
    warning: '!',
    info: 'i',
  }
  return (
    <div className={`flex items-start gap-2 rounded-md border p-2 text-xs ${colorMap[risk.severity]}`}>
      <span className="mt-0.5 font-bold">{iconMap[risk.severity]}</span>
      <span>{risk.message}</span>
    </div>
  )
}

// ── System Card ───────────────────────────────────────────────────────────────

function TechStackSystemCard({ system }: { system: TechnologyStackSystem }) {
  const accessActive = system.accessRecords.filter((r) => r.access_status === 'Active').length
  const accessIssues = system.accessRecords.filter((r) => r.access_status === 'Issue').length
  const accessPending = system.accessRecords.filter(
    (r) => r.access_status === 'Not Requested' || r.access_status === 'Requested',
  ).length

  return (
    <div className={`rounded-md border p-3 ${system.active ? 'bg-white' : 'bg-slate-50 opacity-70'}`}>
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          {/* Name + badges */}
          <div className="flex items-center gap-1.5">
            <span className="truncate text-sm font-medium text-slate-800">{system.system_name}</span>
            {!system.is_custom ? (
              <span className="inline-flex items-center rounded-full bg-blue-100 px-1.5 py-0.5 text-[9px] font-medium text-blue-700">Lib</span>
            ) : (
              <span className="inline-flex items-center rounded-full bg-amber-100 px-1.5 py-0.5 text-[9px] font-medium text-amber-700">Custom</span>
            )}
            {system.pinned && <span className="text-[10px] text-teal-600">📌</span>}
            {!system.active && <span className="text-[10px] text-slate-400">Inactive</span>}
          </div>

          {/* Vendor + Type */}
          <p className="mt-0.5 text-[11px] text-slate-400">
            {system.vendor_name && <span>{system.vendor_name}</span>}
            {system.vendor_name && system.system_type && <span> · </span>}
            {system.system_type && <span>{system.system_type}</span>}
            {system.owner_role && <span> · Owner: {system.owner_role}</span>}
          </p>

          {/* Access summary */}
          {(accessActive > 0 || accessIssues > 0 || accessPending > 0) && (
            <div className="mt-1 flex items-center gap-2 text-[10px]">
              {accessActive > 0 && <span className="text-green-600">{accessActive} active</span>}
              {accessIssues > 0 && <span className="text-red-600">{accessIssues} issues</span>}
              {accessPending > 0 && <span className="text-amber-600">{accessPending} pending</span>}
            </div>
          )}

          {/* Activity mapping counts */}
          {(system.mappedActivityCount > 0 || system.recommendedActivityCount > 0) && (
            <div className="mt-1 flex items-center gap-2 text-[10px] text-slate-400">
              {system.mappedActivityCount > 0 && <span>{system.mappedActivityCount} mapped</span>}
              {system.recommendedActivityCount > 0 && <span>{system.recommendedActivityCount} recommended</span>}
            </div>
          )}

          {/* URL links */}
          <div className="mt-1 flex flex-wrap gap-2 text-[10px]">
            {system.launch_url && (
              <a href={system.launch_url} target="_blank" rel="noopener noreferrer" className="text-teal-600 hover:underline">
                Launch
              </a>
            )}
            {system.training_url && (
              <a href={system.training_url} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">
                Training
              </a>
            )}
            {system.support_url && (
              <a href={system.support_url} target="_blank" rel="noopener noreferrer" className="text-slate-500 hover:underline">
                Support
              </a>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

// ── Category Section ──────────────────────────────────────────────────────────

function CategorySection({
  category,
  systems,
}: {
  category: string
  systems: TechnologyStackSystem[]
}) {
  const active = systems.filter((s) => s.active).length
  const issues = systems.filter(
    (s) => s.accessRecords.some((r) => r.access_status === 'Issue'),
  ).length

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500">{category}</h3>
        <span className="text-[10px] text-slate-400">
          {active} active{issues > 0 ? ` · ${issues} issues` : ''}
        </span>
      </div>
      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
        {systems.map((s) => (
          <TechStackSystemCard key={s.study_system_id} system={s} />
        ))}
      </div>
    </div>
  )
}

// ── Metrics Dashboard ─────────────────────────────────────────────────────────

function MetricsDashboard({ metrics }: { metrics: TechnologyStackMetrics }) {
  return (
    <div className="space-y-4">
      {/* Top row — counts */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-6">
        <MetricCard label="Total Systems" value={metrics.totalSystems} />
        <MetricCard label="Active" value={metrics.activeSystems} color="text-green-600" />
        <MetricCard label="Inactive" value={metrics.inactiveSystems} color="text-slate-400" />
        <MetricCard label="Pinned" value={metrics.pinnedSystems} color="text-teal-600" />
        <MetricCard label="Access Issues" value={metrics.systemsWithAccessIssues} color={metrics.systemsWithAccessIssues > 0 ? 'text-red-600' : undefined} />
        <MetricCard label="Pending Access" value={metrics.systemsWithPendingAccess} color={metrics.systemsWithPendingAccess > 0 ? 'text-amber-600' : undefined} />
      </div>

      {/* Second row — activities + categories */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <MetricCard label="Mapped Activities" value={metrics.mappedActivities} />
        <MetricCard label="Recommended Activities" value={metrics.recommendedActivities} />
        <MetricCard label="Categories Used" value={metrics.categoriesUsed} />
        <MetricCard
          label="Complexity"
          value={metrics.technologyComplexityLabel}
          sub={`Score: ${metrics.technologyComplexityScore}`}
          color={
            metrics.technologyComplexityLabel === 'Low' ? 'text-green-600'
            : metrics.technologyComplexityLabel === 'Moderate' ? 'text-amber-600'
            : 'text-red-600'
          }
        />
      </div>

      {/* Health bars */}
      <div className="grid gap-4 sm:grid-cols-3">
        <HealthBar
          score={metrics.technologyHealthScore}
          label="Technology Health"
          goodColor="bg-green-500"
          midColor="bg-amber-500"
          badColor="bg-red-500"
        />
        <div>
          <div className="flex items-center justify-between text-xs">
            <span className="font-medium text-slate-600">Operational Dependency</span>
            <span className="font-bold text-slate-700">{metrics.operationalDependencyLabel}</span>
          </div>
          <div className="mt-1 h-2 w-full overflow-hidden rounded-full bg-slate-100">
            <div
              className={`h-full rounded-full ${
                metrics.operationalDependencyScore <= 20 ? 'bg-green-500'
                : metrics.operationalDependencyScore <= 40 ? 'bg-amber-500'
                : metrics.operationalDependencyScore <= 60 ? 'bg-orange-500'
                : 'bg-red-500'
              }`}
              style={{ width: `${metrics.operationalDependencyScore}%` }}
            />
          </div>
        </div>
        <div>
          <div className="flex items-center justify-between text-xs">
            <span className="font-medium text-slate-600">Access Readiness</span>
            <span className="font-bold text-slate-700">{metrics.technologyHealthLabel}</span>
          </div>
          <div className="mt-1 h-2 w-full overflow-hidden rounded-full bg-slate-100">
            <div
              className={`h-full rounded-full ${
                metrics.technologyHealthScore >= 80 ? 'bg-green-500'
                : metrics.technologyHealthScore >= 50 ? 'bg-amber-500'
                : 'bg-red-500'
              }`}
              style={{ width: `${metrics.technologyHealthScore}%` }}
            />
          </div>
        </div>
      </div>
    </div>
  )
}

// ── Risks Section ─────────────────────────────────────────────────────────────

function RisksSection({ risks }: { risks: TechnologyRisk[] }) {
  if (risks.length === 0) {
    return (
      <div className="rounded-md border border-green-200 bg-green-50 p-3">
        <p className="text-xs font-medium text-green-700">No technology risks detected</p>
      </div>
    )
  }

  const critical = risks.filter((r) => r.severity === 'critical')
  const warnings = risks.filter((r) => r.severity === 'warning')
  const info = risks.filter((r) => r.severity === 'info')

  return (
    <div className="space-y-2">
      <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500">
        Risks ({risks.length})
        {critical.length > 0 && <span className="ml-1 text-red-500">· {critical.length} critical</span>}
      </h3>
      <div className="space-y-1.5">
        {critical.map((r, i) => <RiskBadge key={`c-${i}`} risk={r} />)}
        {warnings.map((r, i) => <RiskBadge key={`w-${i}`} risk={r} />)}
        {info.map((r, i) => <RiskBadge key={`i-${i}`} risk={r} />)}
      </div>
    </div>
  )
}

// ── Main Component ────────────────────────────────────────────────────────────

export function StudyTechnologyStackView({
  techStack,
}: {
  techStack: TechnologyStack
}) {
  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-sm font-semibold text-slate-800">Study Technology Stack</h2>
        <p className="mt-1 text-sm text-slate-500">
          Complete operational view of the technology ecosystem for this study.
        </p>
      </div>

      {/* Metrics */}
      <MetricsDashboard metrics={techStack.metrics} />

      {/* Risks */}
      <RisksSection risks={techStack.risks} />

      {/* Categories */}
      <div className="space-y-6">
        {techStack.categories.map((cat) => (
          <CategorySection key={cat.category} category={cat.category} systems={cat.systems} />
        ))}
        {techStack.categories.length === 0 && (
          <div className="rounded-md border border-dashed border-slate-300 p-8 text-center">
            <p className="text-sm text-slate-500">No systems registered for this study.</p>
          </div>
        )}
      </div>
    </div>
  )
}

// ── Command Center Summary Card ───────────────────────────────────────────────

export function TechStackSummaryCard({ metrics, risks }: { metrics: TechnologyStackMetrics; risks: TechnologyRisk[] }) {
  const criticalRisks = risks.filter((r) => r.severity === 'critical').length
  const warnings = risks.filter((r) => r.severity === 'warning').length

  return (
    <div className="rounded-md border border-slate-200 bg-white p-4 shadow-sm">
      <h3 className="text-sm font-semibold text-slate-800">Technology Stack</h3>
      <div className="mt-3 grid grid-cols-2 gap-3 text-xs">
        <div>
          <p className="text-slate-400">Systems</p>
          <p className="font-semibold text-slate-800">{metrics.totalSystems} ({metrics.activeSystems} active)</p>
        </div>
        <div>
          <p className="text-slate-400">Complexity</p>
          <p className={`font-semibold ${
            metrics.technologyComplexityLabel === 'Low' ? 'text-green-600'
            : metrics.technologyComplexityLabel === 'Moderate' ? 'text-amber-600'
            : 'text-red-600'
          }`}>
            {metrics.technologyComplexityLabel}
          </p>
        </div>
        <div>
          <p className="text-slate-400">Health</p>
          <p className={`font-semibold ${
            metrics.technologyHealthLabel === 'Healthy' ? 'text-green-600'
            : metrics.technologyHealthLabel === 'Watch' ? 'text-amber-600'
            : 'text-red-600'
          }`}>
            {metrics.technologyHealthLabel} ({metrics.technologyHealthScore}%)
          </p>
        </div>
        <div>
          <p className="text-slate-400">Dependency</p>
          <p className="font-semibold text-slate-700">{metrics.operationalDependencyLabel}</p>
        </div>
      </div>
      {(criticalRisks > 0 || warnings > 0) && (
        <div className="mt-3 flex gap-2 text-[10px]">
          {criticalRisks > 0 && <span className="rounded bg-red-100 px-2 py-0.5 font-medium text-red-700">{criticalRisks} critical</span>}
          {warnings > 0 && <span className="rounded bg-amber-100 px-2 py-0.5 font-medium text-amber-700">{warnings} warnings</span>}
        </div>
      )}
    </div>
  )
}
