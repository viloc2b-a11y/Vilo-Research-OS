import { redirect } from 'next/navigation'
import Link from 'next/link'
import { ShieldCheck, ShieldAlert, ShieldX, CheckCircle, AlertTriangle, XCircle, Info } from 'lucide-react'
import { getSessionUser, getOrganizationMemberships, getPrimaryOrganizationId } from '@/lib/auth/session'
import { canAccessSubjectVisitWorkspace } from '@/lib/rbac/permissions'
import { createServerClient } from '@/lib/supabase/server'
import {
  computeInspectionReadinessScore,
  type InspectionReadinessScore,
  type ReadinessDimension,
} from '@/lib/inspection-readiness/compute-readiness-score'
import {
  computeAuditFindings,
  type AuditSimulationResult,
  type AuditFinding,
} from '@/lib/inspection-readiness/compute-audit-findings'

// ---------------------------------------------------------------------------
// Page props
// ---------------------------------------------------------------------------

type PageProps = {
  searchParams: Promise<{ study_id?: string }>
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function scoreColor(score: number): string {
  if (score >= 85) return 'text-emerald-700'
  if (score >= 60) return 'text-amber-700'
  return 'text-red-700'
}

function scoreBg(score: number): string {
  if (score >= 85) return 'bg-emerald-50 border-emerald-200'
  if (score >= 60) return 'bg-amber-50 border-amber-200'
  return 'bg-red-50 border-red-200'
}

function riskLevelLabel(level: InspectionReadinessScore['riskLevel']): string {
  switch (level) {
    case 'inspection-ready': return 'Inspection Ready'
    case 'needs-attention': return 'Needs Attention'
    case 'not-ready': return 'Not Ready'
  }
}

function RiskLevelIcon({ level }: { level: InspectionReadinessScore['riskLevel'] }) {
  if (level === 'inspection-ready') return <ShieldCheck className="h-6 w-6 text-emerald-600" />
  if (level === 'needs-attention') return <ShieldAlert className="h-6 w-6 text-amber-600" />
  return <ShieldX className="h-6 w-6 text-red-600" />
}

function DimensionStatusIcon({ status }: { status: ReadinessDimension['status'] }) {
  if (status === 'pass') return <CheckCircle className="h-4 w-4 text-emerald-600 shrink-0" />
  if (status === 'warning') return <AlertTriangle className="h-4 w-4 text-amber-600 shrink-0" />
  return <XCircle className="h-4 w-4 text-red-600 shrink-0" />
}

function DimensionStatusBadge({ status }: { status: ReadinessDimension['status'] }) {
  const cls =
    status === 'pass'
      ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
      : status === 'warning'
      ? 'bg-amber-50 text-amber-700 border-amber-200'
      : 'bg-red-50 text-red-700 border-red-200'
  return (
    <span className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${cls}`}>
      {status}
    </span>
  )
}

function DimensionCard({ dimension }: { dimension: ReadinessDimension }) {
  return (
    <div className="rounded-md border border-slate-200 bg-white p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2">
          <DimensionStatusIcon status={dimension.status} />
          <h3 className="text-sm font-semibold text-slate-900">{dimension.name}</h3>
        </div>
        <DimensionStatusBadge status={dimension.status} />
      </div>
      <div className="mt-3">
        <div className="flex items-center justify-between gap-2 text-xs text-slate-500">
          <span>Score</span>
          <span className={`font-semibold text-sm ${scoreColor(dimension.score)}`}>
            {dimension.score}
          </span>
        </div>
        <div className="mt-1.5 h-2 w-full overflow-hidden rounded-full bg-slate-100">
          <div
            className={`h-2 rounded-full transition-all ${
              dimension.score >= 85
                ? 'bg-emerald-500'
                : dimension.score >= 60
                ? 'bg-amber-500'
                : 'bg-red-500'
            }`}
            style={{ width: `${dimension.score}%` }}
          />
        </div>
      </div>
      <p className="mt-2 text-xs text-slate-600">{dimension.detail}</p>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Audit Simulation components
// ---------------------------------------------------------------------------

function AuditSeverityIcon({ severity }: { severity: AuditFinding['severity'] }) {
  if (severity === 'critical') return <XCircle className="h-4 w-4 text-red-600 shrink-0" />
  if (severity === 'warning') return <AlertTriangle className="h-4 w-4 text-amber-600 shrink-0" />
  return <Info className="h-4 w-4 text-slate-500 shrink-0" />
}

function AuditFindingRow({ finding }: { finding: AuditFinding }) {
  const rowBg =
    finding.severity === 'critical'
      ? 'bg-red-50 border-red-100'
      : finding.severity === 'warning'
      ? 'bg-amber-50 border-amber-100'
      : 'bg-white border-slate-100'

  return (
    <div className={`flex items-start gap-3 rounded-md border px-4 py-3 ${rowBg}`}>
      <AuditSeverityIcon severity={finding.severity} />
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <span className="rounded bg-slate-100 px-1.5 py-0.5 font-mono text-[10px] text-slate-600">
            {finding.category}
          </span>
          <p className="text-sm font-medium text-slate-900">{finding.title}</p>
        </div>
        <p className="mt-0.5 text-xs text-slate-500">{finding.detail}</p>
      </div>
      {finding.href ? (
        <Link
          href={finding.href}
          className="shrink-0 text-xs text-teal-700 hover:text-teal-800"
        >
          →
        </Link>
      ) : null}
    </div>
  )
}

function AuditSimulationSection({ result }: { result: AuditSimulationResult }) {
  return (
    <section>
      <div className="mb-3 flex items-baseline gap-3">
        <h2 className="text-sm font-semibold text-slate-900">Audit Simulation</h2>
        <p className="text-xs text-slate-500">What an auditor would find today</p>
      </div>
      <p className="mb-3 text-xs text-slate-500">
        <span className="font-semibold text-red-700">{result.criticalCount} critical</span>
        {' · '}
        <span className="font-semibold text-amber-700">{result.warningCount} warning{result.warningCount !== 1 ? 's' : ''}</span>
      </p>
      {result.findings.length === 0 ? (
        <div className="rounded-md border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-800">
          No audit findings — inspection ready
        </div>
      ) : (
        <div className="space-y-2">
          {result.findings.map((finding) => (
            <AuditFindingRow key={finding.id} finding={finding} />
          ))}
        </div>
      )}
    </section>
  )
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default async function InspectionReadinessPage({ searchParams }: PageProps) {
  const user = await getSessionUser()
  if (!user) redirect('/login')

  const organizationId = await getPrimaryOrganizationId(user.id)
  if (!organizationId) {
    return (
      <div className="space-y-3 p-6">
        <h1 className="text-2xl font-semibold tracking-tight text-slate-900">Inspection Readiness</h1>
        <p className="text-sm text-slate-500">No active organization access is available.</p>
      </div>
    )
  }

  const memberships = await getOrganizationMemberships(user.id)
  if (!canAccessSubjectVisitWorkspace(memberships, organizationId)) {
    return (
      <div className="space-y-3 p-6">
        <h1 className="text-2xl font-semibold tracking-tight text-slate-900">Inspection Readiness</h1>
        <p className="text-sm text-slate-500">Access denied.</p>
      </div>
    )
  }

  const params = await searchParams
  const studyId = typeof params.study_id === 'string' ? params.study_id.trim() : null

  const supabase = await createServerClient()

  const { data: studies } = await supabase
    .from('studies')
    .select('id, name')
    .eq('organization_id', organizationId)
    .order('name', { ascending: true })
    .limit(100)

  const studyList = (studies ?? []).map((s) => ({ id: String(s.id), name: String(s.name) }))

  let score: InspectionReadinessScore | null = null
  let scoreError: string | null = null
  let auditFindings: AuditSimulationResult | null = null

  if (studyId) {
    const studyExists = studyList.some((s) => s.id === studyId)
    if (!studyExists) {
      scoreError = 'Study not found or access denied.'
    } else {
      try {
        score = await computeInspectionReadinessScore({ supabase, organizationId, studyId })
      } catch (err) {
        scoreError = err instanceof Error ? err.message : 'Failed to compute readiness score.'
      }
      if (score) {
        try {
          auditFindings = await computeAuditFindings({ supabase, organizationId, studyId })
        } catch {
          // findings are optional — degrade gracefully
        }
      }
    }
  }

  return (
    <div className="space-y-6 p-6">
      <header className="max-w-3xl">
        <p className="text-xs font-semibold uppercase tracking-wide text-teal-700">Compliance</p>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight text-slate-900">
          Inspection Readiness
        </h1>
        <p className="mt-2 text-sm text-slate-600">
          Real-time compliance signals aggregated into a readiness score per study. Select a
          study to see the current readiness assessment.
        </p>
      </header>

      {/* Study selector */}
      <section className="rounded-md border border-slate-200 bg-white p-4 max-w-sm">
        <h2 className="text-sm font-semibold text-slate-900">Select study</h2>
        <form method="get" className="mt-3 flex items-end gap-3">
          <label className="flex-1 space-y-1 text-xs font-medium text-slate-600">
            Study
            <select
              name="study_id"
              defaultValue={studyId ?? ''}
              className="h-10 w-full rounded-md border border-slate-300 bg-white px-3 text-sm"
            >
              <option value="">— choose a study —</option>
              {studyList.map((study) => (
                <option key={study.id} value={study.id}>
                  {study.name}
                </option>
              ))}
            </select>
          </label>
          <button
            type="submit"
            className="h-10 rounded-md bg-teal-700 px-4 text-sm font-semibold text-white hover:bg-teal-800"
          >
            Load
          </button>
        </form>
      </section>

      {scoreError ? (
        <div className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
          {scoreError}
        </div>
      ) : null}

      {score ? (
        <div className="space-y-6">
          {/* Overall score card */}
          <section className={`rounded-md border p-6 ${scoreBg(score.overallScore)} max-w-xl`}>
            <div className="flex items-center gap-4">
              <RiskLevelIcon level={score.riskLevel} />
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Overall Score
                </p>
                <div className="flex items-baseline gap-3 mt-1">
                  <span className={`text-5xl font-bold ${scoreColor(score.overallScore)}`}>
                    {score.overallScore}
                  </span>
                  <span className="text-sm text-slate-500">/ 100</span>
                </div>
              </div>
              <div className="ml-auto text-right">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Risk Level
                </p>
                <p className={`mt-1 text-sm font-semibold ${scoreColor(score.overallScore)}`}>
                  {riskLevelLabel(score.riskLevel)}
                </p>
              </div>
            </div>
            <p className="mt-4 text-xs text-slate-500">
              Generated at {new Date(score.generatedAt).toLocaleString()}
            </p>
          </section>

          {/* Dimension cards */}
          <section>
            <h2 className="text-sm font-semibold text-slate-900 mb-3">Compliance Dimensions</h2>
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {score.dimensions.map((dimension) => (
                <DimensionCard key={dimension.name} dimension={dimension} />
              ))}
            </div>
          </section>

          {/* Audit Simulation */}
          {auditFindings ? (
            <AuditSimulationSection result={auditFindings} />
          ) : null}

          {/* Refresh link */}
          <div className="text-xs text-slate-500">
            Scores are computed on-demand.{' '}
            <Link
              href={`/inspection-readiness?study_id=${encodeURIComponent(score.studyId)}`}
              className="text-teal-700 underline hover:text-teal-800"
            >
              Refresh
            </Link>
          </div>
        </div>
      ) : !studyId ? (
        <div className="rounded-md border border-dashed border-slate-300 p-8 text-center text-sm text-slate-500">
          Select a study above to view its inspection readiness score.
        </div>
      ) : null}
    </div>
  )
}
