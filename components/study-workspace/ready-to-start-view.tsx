'use client'

import type { ReadyToStartDecision, EvidenceItem } from '@/lib/study-workspace/ready-to-start-decision'

// ── Status badge ─────────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: ReadyToStartDecision['status'] }) {
  const cfg = {
    READY_TO_START: { bg: 'bg-green-100', text: 'text-green-800', label: 'READY TO START' },
    ALMOST_READY: { bg: 'bg-amber-100', text: 'text-amber-800', label: 'ALMOST READY' },
    NOT_READY: { bg: 'bg-red-100', text: 'text-red-800', label: 'NOT READY TO START' },
  }
  const c = cfg[status]
  return (
    <span className={`inline-flex items-center rounded-full px-4 py-1.5 text-sm font-bold tracking-wide ${c.bg} ${c.text}`}>
      {c.label}
    </span>
  )
}

// ── Evidence Item ────────────────────────────────────────────────────────────

function EvidenceRow({ item }: { item: EvidenceItem }) {
  const icon = item.severity === 'blocker' ? '✗' : '!'
  const border = item.severity === 'blocker' ? 'border-red-200 bg-red-50' : 'border-amber-200 bg-amber-50'
  const textColor = item.severity === 'blocker' ? 'text-red-700' : 'text-amber-700'

  return (
    <div className={`flex items-start gap-2 rounded-md border p-2 text-xs ${border} ${textColor}`}>
      <span className="mt-0.5 font-bold">{icon}</span>
      <div className="min-w-0 flex-1">
        <p className="font-medium">{item.message}</p>
        <div className="mt-0.5 flex flex-wrap gap-2 text-[10px] opacity-75">
          {item.owner && <span>Owner: {item.owner}</span>}
          {item.nextAction && <span>→ {item.nextAction}</span>}
        </div>
      </div>
    </div>
  )
}

// ── Main Component ───────────────────────────────────────────────────────────

export function ReadyToStartCard({ decision }: { decision: ReadyToStartDecision }) {
  return (
    <div className="space-y-4 rounded-md border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-sm font-semibold text-slate-800">Ready To Start</h2>
          <p className="mt-0.5 text-xs text-slate-500">
            Score: {decision.score}% · Startup: {decision.startupScore}% · Tech Health: {decision.technologyHealth}%
          </p>
        </div>
        <StatusBadge status={decision.status} />
      </div>

      {/* Quick summary */}
      <div className="flex flex-wrap gap-3 text-xs">
        <span className="text-slate-500">
          {decision.blockers.length} blocker{decision.blockers.length !== 1 ? 's' : ''}
        </span>
        <span className="text-slate-500">
          {decision.warnings.length} warning{decision.warnings.length !== 1 ? 's' : ''}
        </span>
        <span className="text-slate-500">
          {decision.evidence.systemCount} systems ({decision.evidence.activeSystemCount} active)
        </span>
        {decision.evidence.accessIssues > 0 && (
          <span className="text-red-600">{decision.evidence.accessIssues} access issues</span>
        )}
      </div>

      {/* Evidence items */}
      {decision.allItems.length > 0 && (
        <div className="space-y-1.5">
          {decision.allItems.slice(0, 8).map((item, i) => (
            <EvidenceRow key={i} item={item} />
          ))}
          {decision.allItems.length > 8 && (
            <p className="text-xs text-slate-400">
              +{decision.allItems.length - 8} more item(s)
            </p>
          )}
        </div>
      )}

      {/* Owners */}
      {decision.owners.length > 0 && (
        <div>
          <h4 className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-slate-400">
            Owners
          </h4>
          <div className="flex flex-wrap gap-2">
            {decision.owners.map((o) => (
              <span
                key={o.role}
                className="inline-flex items-center rounded-full bg-slate-100 px-2.5 py-1 text-[10px] font-medium text-slate-700"
              >
                {o.role} ({o.issues.length})
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Next actions */}
      {decision.nextActions.length > 0 && (
        <div>
          <h4 className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-slate-400">
            Next Actions
          </h4>
          <ol className="list-inside list-decimal space-y-1 text-xs text-slate-600">
            {decision.nextActions.map((action, i) => (
              <li key={i}>{action}</li>
            ))}
          </ol>
        </div>
      )}

      {/* Evidence counts */}
      <div className="grid grid-cols-3 gap-3 border-t border-slate-100 pt-3 text-center text-xs">
        <div>
          <p className={`font-bold text-lg ${decision.blockers.length > 0 ? 'text-red-600' : 'text-green-600'}`}>
            {decision.evidence.accessIssues}
          </p>
          <p className="text-slate-400">Access Issues</p>
        </div>
        <div>
          <p className={`font-bold text-lg ${decision.evidence.criticalRisks > 0 ? 'text-red-600' : 'text-green-600'}`}>
            {decision.evidence.criticalRisks}
          </p>
          <p className="text-slate-400">Critical Risks</p>
        </div>
        <div>
          <p className={`font-bold text-lg ${decision.evidence.enrollmentBlockers > 0 ? 'text-red-600' : 'text-green-600'}`}>
            {decision.evidence.enrollmentBlockers}
          </p>
          <p className="text-slate-400">Enrollment Blockers</p>
        </div>
      </div>
    </div>
  )
}

// ── Command Center Summary ────────────────────────────────────────────────────

export function ReadyToStartSummaryCard({
  decision,
}: {
  decision: ReadyToStartDecision
}) {
  return (
    <div className="rounded-md border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-slate-800">Start Decision</h3>
        <StatusBadge status={decision.status} />
      </div>
      <div className="mt-3 grid grid-cols-2 gap-3 text-xs">
        <div>
          <p className="text-slate-400">Score</p>
          <p className={`text-lg font-bold ${decision.score >= 80 ? 'text-green-600' : decision.score >= 50 ? 'text-amber-600' : 'text-red-600'}`}>
            {decision.score}%
          </p>
        </div>
        <div>
          <p className="text-slate-400">Blockers</p>
          <p className={`text-lg font-bold ${decision.blockers.length > 0 ? 'text-red-600' : 'text-green-600'}`}>
            {decision.blockers.length}
          </p>
        </div>
        <div>
          <p className="text-slate-400">Warnings</p>
          <p className="font-semibold text-amber-600">{decision.warnings.length}</p>
        </div>
        <div>
          <p className="text-slate-400">Owners</p>
          <p className="font-semibold text-slate-700">{decision.owners.length}</p>
        </div>
      </div>
      {decision.nextActions.length > 0 && (
        <p className="mt-2 text-[10px] text-slate-400">
          Next: {decision.nextActions[0]}
        </p>
      )}
    </div>
  )
}
