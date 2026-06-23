'use client'

import type { StudyReadiness } from '@/lib/study-readiness/study-readiness'
import type { ReadinessDomain } from '@/lib/study-readiness/study-readiness'

// ── Colors ───────────────────────────────────────────────────────────────────

function statusColor(status: string): string {
  switch (status) {
    case 'ready': return 'text-green-600'
    case 'warning': return 'text-amber-600'
    case 'blocked': return 'text-red-600'
    default: return 'text-slate-500'
  }
}

function statusBg(status: string): string {
  switch (status) {
    case 'ready': return 'bg-green-100 text-green-800'
    case 'warning': return 'bg-amber-100 text-amber-800'
    case 'blocked': return 'bg-red-100 text-red-800'
    default: return 'bg-slate-100 text-slate-600'
  }
}

function scoreBg(score: number): string {
  if (score >= 80) return 'bg-green-500'
  if (score >= 50) return 'bg-amber-500'
  return 'bg-red-500'
}

// ── Domain chip ──────────────────────────────────────────────────────────────

function DomainChip({ domain }: { domain: ReadinessDomain }) {
  const color = domain.status === 'ready' ? 'border-green-200 bg-green-50 text-green-700'
    : domain.status === 'warning' ? 'border-amber-200 bg-amber-50 text-amber-700'
    : 'border-red-200 bg-red-50 text-red-700'

  return (
    <span className={`inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-[10px] font-medium ${color}`}>
      <span className={`h-1.5 w-1.5 rounded-full ${
        domain.status === 'ready' ? 'bg-green-500'
        : domain.status === 'warning' ? 'bg-amber-500'
        : 'bg-red-500'
      }`} />
      {domain.domain}
    </span>
  )
}

// ── Main Card ───────────────────────────────────────────────────────────────

export function StudyReadinessCard({ readiness }: { readiness: StudyReadiness }) {
  const topBlockers = readiness.allBlockers.slice(0, 3)

  return (
    <div className="rounded-md border border-slate-200 bg-white p-4 shadow-sm">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-slate-800">Study Readiness</h3>
        <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${statusBg(readiness.overall)}`}>
          {readiness.overall === 'ready' ? 'Ready' : readiness.overall === 'warning' ? 'Warning' : 'Blocked'}
        </span>
      </div>

      {/* Score */}
      <div className="mt-3 flex items-center gap-3">
        <div className="flex-1">
          <div className="flex items-center justify-between text-xs">
            <span className="font-medium text-slate-500">Overall Score</span>
            <span className={`font-bold ${statusColor(readiness.overall)}`}>{readiness.overallScore}%</span>
          </div>
          <div className="mt-1 h-2 w-full overflow-hidden rounded-full bg-slate-100">
            <div
              className={`h-full rounded-full ${scoreBg(readiness.overallScore)}`}
              style={{ width: `${readiness.overallScore}%` }}
            />
          </div>
        </div>
      </div>

      {/* Domain chips */}
      <div className="mt-3 flex flex-wrap gap-1.5">
        {readiness.domains.map((d) => (
          <DomainChip key={d.domain} domain={d} />
        ))}
      </div>

      {/* Summary stats */}
      <div className="mt-3 grid grid-cols-3 gap-2 text-center text-xs">
        <div>
          <p className={`font-bold text-sm ${readiness.blockedDomainCount > 0 ? 'text-red-600' : 'text-green-600'}`}>
            {readiness.blockedDomainCount}
          </p>
          <p className="text-slate-400">Blocked</p>
        </div>
        <div>
          <p className={`font-bold text-sm ${readiness.warningDomainCount > 0 ? 'text-amber-600' : 'text-slate-600'}`}>
            {readiness.warningDomainCount}
          </p>
          <p className="text-slate-400">Warning</p>
        </div>
        <div>
          <p className="font-bold text-sm text-slate-600">{readiness.readyDomainCount}</p>
          <p className="text-slate-400">Ready</p>
        </div>
      </div>

      {/* Top blockers */}
      {topBlockers.length > 0 && (
        <div className="mt-3 space-y-1 border-t border-slate-100 pt-3">
          <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">Top Blockers</p>
          {topBlockers.map((b, i) => (
            <div
              key={i}
              className={`flex items-start gap-1.5 rounded p-1.5 text-[11px] ${
                b.severity === 'critical' ? 'text-red-700 bg-red-50'
                : b.severity === 'warning' ? 'text-amber-700 bg-amber-50'
                : 'text-blue-700 bg-blue-50'
              }`}
            >
              <span className="mt-0.5 font-bold">{b.severity === 'critical' ? '✗' : b.severity === 'warning' ? '!' : 'i'}</span>
              <span className="flex-1">{b.message}</span>
            </div>
          ))}
          {readiness.allBlockers.length > 3 && (
            <p className="text-[10px] text-slate-400">+{readiness.allBlockers.length - 3} more</p>
          )}
        </div>
      )}

      {/* Ready state */}
      {readiness.allBlockers.length === 0 && (
        <div className="mt-3 rounded border border-green-100 bg-green-50 p-2 text-center text-[11px] text-green-700">
          All domains ready — no blockers detected
        </div>
      )}
    </div>
  )
}
