import { redirect } from 'next/navigation'
import { ShieldCheck, AlertTriangle, AlertCircle, CheckCircle2, Clock } from 'lucide-react'
import { getSessionUser } from '@/lib/auth/session'
import { createServerClient } from '@/lib/supabase/server'
import { loadGovernancePortal } from '@/lib/ai-governance/load-governance-portal'
import type { AiGovernancePortalRow } from '@/lib/ai-governance/registry-types'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const RISK_CONFIG = {
  low:      { badge: 'bg-slate-50 text-slate-600 border-slate-200',   label: 'Low' },
  medium:   { badge: 'bg-yellow-50 text-yellow-700 border-yellow-200', label: 'Medium' },
  high:     { badge: 'bg-orange-50 text-orange-700 border-orange-200', label: 'High' },
  critical: { badge: 'bg-red-50 text-red-700 border-red-200',          label: 'Critical' },
} as const

const VALIDATION_CONFIG = {
  pass:    { badge: 'bg-green-50 text-green-700 border-green-200',   icon: CheckCircle2, label: 'Pass' },
  fail:    { badge: 'bg-red-50 text-red-700 border-red-200',          icon: AlertCircle,  label: 'Fail' },
  partial: { badge: 'bg-yellow-50 text-yellow-700 border-yellow-200', icon: AlertTriangle, label: 'Partial' },
  pending: { badge: 'bg-slate-50 text-slate-500 border-slate-200',   icon: Clock,        label: 'Pending' },
} as const

function RiskBadge({ level }: { level: string }) {
  const cfg = RISK_CONFIG[level as keyof typeof RISK_CONFIG] ?? RISK_CONFIG.low
  return (
    <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-semibold ${cfg.badge}`}>
      {cfg.label}
    </span>
  )
}

function ValidationBadge({ result }: { result: string | null }) {
  if (!result) return <span className="text-xs text-muted-foreground">—</span>
  const cfg = VALIDATION_CONFIG[result as keyof typeof VALIDATION_CONFIG] ?? VALIDATION_CONFIG.pending
  const Icon = cfg.icon
  return (
    <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-semibold ${cfg.badge}`}>
      <Icon className="w-3 h-3" />
      {cfg.label}
    </span>
  )
}

function GapFlag({ row }: { row: AiGovernancePortalRow }) {
  if (row.missingHumanReviewCheckpoint) {
    return (
      <span className="inline-flex items-center gap-1 text-xs text-red-600 font-medium">
        <AlertCircle className="w-3 h-3" />
        Missing review checkpoint
      </span>
    )
  }
  if (row.openValidationGap) {
    return (
      <span className="inline-flex items-center gap-1 text-xs text-yellow-700 font-medium">
        <Clock className="w-3 h-3" />
        Validation pending
      </span>
    )
  }
  return <span className="text-xs text-muted-foreground">—</span>
}

// ---------------------------------------------------------------------------
// Summary stats
// ---------------------------------------------------------------------------

function summaryStats(rows: AiGovernancePortalRow[]) {
  const total = rows.length
  const withEvidence = rows.filter((r) => r.hasValidationEvidence).length
  const criticalOrHigh = rows.filter(
    (r) => r.useCase.riskLevel === 'critical' || r.useCase.riskLevel === 'high',
  ).length
  const openGaps = rows.filter(
    (r) => r.missingHumanReviewCheckpoint || r.openValidationGap,
  ).length
  const humanReviewRequired = rows.filter((r) => r.useCase.humanReviewRequired).length
  return { total, withEvidence, criticalOrHigh, openGaps, humanReviewRequired }
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default async function AiGovernancePage() {
  const user = await getSessionUser()
  if (!user) redirect('/login')

  const supabase = await createServerClient()
  const rows = await loadGovernancePortal(supabase)

  const stats = summaryStats(rows)

  // Group by module for display
  const byModule = new Map<string, AiGovernancePortalRow[]>()
  for (const row of rows) {
    const key = row.useCase.module
    if (!byModule.has(key)) byModule.set(key, [])
    byModule.get(key)!.push(row)
  }

  const moduleLabel = (key: string) =>
    key
      .split('_')
      .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
      .join(' ')

  return (
    <div className="flex flex-col h-full bg-accent">
      {/* Header */}
      <div className="px-6 py-5 bg-card border-b border-border">
        <h1 className="heading-serif text-xl text-foreground flex items-center gap-2">
          <ShieldCheck className="w-5 h-5 text-blue-500" />
          AI Governance Portal
        </h1>
        <p className="text-sm text-muted-foreground mt-0.5">
          Platform-level registry of all AI-assisted and automation-supported workflows.
          Read-only. Edits require direct database access.
        </p>
      </div>

      <div className="flex-1 overflow-auto p-6 space-y-6">
        {/* Summary strip */}
        <div className="flex flex-wrap items-center gap-6 rounded-lg border border-border bg-card px-5 py-3 text-sm">
          <div className="text-center">
            <div className="text-xl font-semibold text-foreground tabular-nums">{stats.total}</div>
            <div className="text-xs text-muted-foreground">Use Cases</div>
          </div>
          <div className="text-center">
            <div className="text-xl font-semibold tabular-nums text-orange-700">{stats.criticalOrHigh}</div>
            <div className="text-xs text-muted-foreground">High / Critical</div>
          </div>
          <div className="text-center">
            <div className="text-xl font-semibold tabular-nums text-blue-700">{stats.humanReviewRequired}</div>
            <div className="text-xs text-muted-foreground">Human Review Required</div>
          </div>
          <div className="text-center">
            <div className={`text-xl font-semibold tabular-nums ${stats.withEvidence > 0 ? 'text-green-700' : 'text-muted-foreground'}`}>
              {stats.withEvidence}
            </div>
            <div className="text-xs text-muted-foreground">With Validation Evidence</div>
          </div>
          {stats.openGaps > 0 && (
            <div className="text-center">
              <div className="text-xl font-semibold tabular-nums text-red-600">{stats.openGaps}</div>
              <div className="text-xs text-muted-foreground">Open Gaps</div>
            </div>
          )}
        </div>

        {rows.length === 0 ? (
          <div className="rounded-xl border border-border bg-card px-4 py-10 text-center">
            <p className="text-sm text-muted-foreground">
              No AI use cases found. Run migration 0208 + 0209 to seed the governance registries.
            </p>
          </div>
        ) : (
          Array.from(byModule.entries()).map(([moduleKey, moduleRows]) => (
            <section key={moduleKey}>
              <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2 px-1">
                {moduleLabel(moduleKey)}
              </h2>
              <div className="overflow-x-auto rounded-xl border border-border">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border bg-muted/40">
                      <th className="px-4 py-2.5 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                        Use Case
                      </th>
                      <th className="px-4 py-2.5 text-center text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                        Risk
                      </th>
                      <th className="px-4 py-2.5 text-center text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                        Human Review
                      </th>
                      <th className="px-4 py-2.5 text-center text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                        Validation
                      </th>
                      <th className="px-4 py-2.5 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                        Config Version
                      </th>
                      <th className="px-4 py-2.5 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                        Open Gap
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {moduleRows.map((row) => (
                      <tr
                        key={row.useCase.id}
                        className={`bg-card transition-colors ${row.missingHumanReviewCheckpoint ? 'bg-red-50/30' : 'hover:bg-muted/30'}`}
                      >
                        <td className="px-4 py-3">
                          <div className="font-medium text-foreground">{row.useCase.useCaseName}</div>
                          <div className="text-xs text-muted-foreground mt-0.5 max-w-xs line-clamp-1">
                            {row.useCase.purpose}
                          </div>
                        </td>
                        <td className="px-4 py-3 text-center">
                          <RiskBadge level={row.useCase.riskLevel} />
                        </td>
                        <td className="px-4 py-3 text-center">
                          {row.useCase.humanReviewRequired ? (
                            <span className="inline-flex items-center gap-1 text-xs font-medium text-blue-700">
                              <CheckCircle2 className="w-3 h-3" />
                              {row.useCase.humanReviewerRole ?? 'Required'}
                            </span>
                          ) : (
                            <span className="text-xs text-muted-foreground">Not required</span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-center">
                          <ValidationBadge result={row.latestValidation?.validationResult ?? null} />
                        </td>
                        <td className="px-4 py-3">
                          {row.activeConfig ? (
                            <span className="text-xs font-mono text-foreground">
                              {row.activeConfig.configName} v{row.activeConfig.configVersion}
                            </span>
                          ) : (
                            <span className="text-xs text-muted-foreground">—</span>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          <GapFlag row={row} />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          ))
        )}
      </div>
    </div>
  )
}
