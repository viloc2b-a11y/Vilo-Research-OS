'use client'

import { useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import type { StudySystemAccessWithSystem, AccessReadinessSummary } from '@/lib/study-workspace/study-system-access'
import { getAccessStatusColor } from '@/lib/study-workspace/study-system-access'
import { updateAccessRecord } from '@/lib/study-workspace/study-system-access-actions'

// ── Types ─────────────────────────────────────────────────────────────────────

type StudyAccessReadinessPanelProps = {
  studyId: string
  accessRecords: StudySystemAccessWithSystem[]
  readinessSummary: AccessReadinessSummary
}

// ── Status badge ──────────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: string }) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium ${getAccessStatusColor(status)}`}
    >
      {status}
    </span>
  )
}

// ── Status select dropdown ────────────────────────────────────────────────────

function StatusSelect({
  current,
  onChange,
}: {
  current: string
  onChange: (status: string) => void
}) {
  const statuses = ['Not Requested', 'Requested', 'Active', 'Issue', 'Not Needed']
  return (
    <select
      value={current}
      onChange={(e) => onChange(e.target.value)}
      className="rounded border border-slate-200 px-2 py-1 text-[11px] text-slate-700 focus:border-teal-500 focus:outline-none focus:ring-1 focus:ring-teal-500"
    >
      {statuses.map((s) => (
        <option key={s} value={s}>
          {s}
        </option>
      ))}
    </select>
  )
}

// ── Readiness Score bar ───────────────────────────────────────────────────────

function ReadinessScoreBar({ summary }: { summary: AccessReadinessSummary }) {
  const { completed, totalRequired, blocked, pending, notNeeded, score } = summary

  const color =
    score === 100 ? 'bg-green-500'
    : blocked > 0 ? 'bg-red-500'
    : score >= 50 ? 'bg-amber-500'
    : 'bg-slate-400'

  return (
    <div className="rounded-md border border-slate-200 bg-white p-4">
      <div className="flex items-center justify-between">
        <div>
          <h4 className="text-sm font-semibold text-slate-800">Access Readiness</h4>
          <p className="mt-0.5 text-xs text-slate-500">
            {completed}/{totalRequired} required accesses completed
          </p>
        </div>
        <div className="text-right">
          <span className={`text-2xl font-bold ${score === 100 ? 'text-green-600' : blocked > 0 ? 'text-red-600' : 'text-amber-600'}`}>
            {score}%
          </span>
        </div>
      </div>

      {/* Progress bar */}
      <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-slate-100">
        <div
          className={`h-full rounded-full transition-all duration-500 ${color}`}
          style={{ width: `${score}%` }}
        />
      </div>

      {/* Legend stats */}
      <div className="mt-3 flex flex-wrap gap-3 text-[11px] text-slate-500">
        <span className="flex items-center gap-1">
          <span className="inline-block h-2 w-2 rounded-full bg-green-500" /> {completed} Active
        </span>
        <span className="flex items-center gap-1">
          <span className="inline-block h-2 w-2 rounded-full bg-amber-400" /> {pending} Pending
        </span>
        {blocked > 0 && (
          <span className="flex items-center gap-1">
            <span className="inline-block h-2 w-2 rounded-full bg-red-500" /> {blocked} Issues
          </span>
        )}
        {notNeeded > 0 && (
          <span className="flex items-center gap-1">
            <span className="inline-block h-2 w-2 rounded-full bg-blue-400" /> {notNeeded} Not Needed
          </span>
        )}
      </div>
    </div>
  )
}

// ── Access records table ──────────────────────────────────────────────────────

function AccessRecordsTable({
  records,
  onStatusChange,
}: {
  records: StudySystemAccessWithSystem[]
  onStatusChange: (accessId: string, newStatus: string) => void
}) {
  if (records.length === 0) {
    return (
      <div className="rounded-md border border-dashed border-slate-300 p-6 text-center">
        <p className="text-sm text-slate-500">
          No access records yet. Initialize access tracking for each role.
        </p>
      </div>
    )
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-left text-xs">
        <thead>
          <tr className="border-b border-slate-200 text-[10px] font-semibold uppercase tracking-wide text-slate-400">
            <th className="py-2 pr-3">System</th>
            <th className="py-2 pr-3">Vendor</th>
            <th className="py-2 pr-3">Type</th>
            <th className="py-2 pr-3">Role</th>
            <th className="py-2 pr-3">Status</th>
            <th className="py-2 pr-3">Requested</th>
            <th className="py-2 pr-3">Granted</th>
            <th className="py-2 pr-3">Notes</th>
            <th className="py-2" />
          </tr>
        </thead>
        <tbody>
          {records.map((record) => (
            <tr
              key={record.access_id}
              className="border-b border-slate-100 hover:bg-slate-50"
            >
              <td className="py-2 pr-3 font-medium text-slate-800">
                {record.system_name}
              </td>
              <td className="py-2 pr-3 text-slate-500">
                {record.vendor_name ?? '—'}
              </td>
              <td className="py-2 pr-3 text-slate-500">
                {record.system_type}
              </td>
              <td className="py-2 pr-3 text-slate-700">{record.role}</td>
              <td className="py-2 pr-3">
                <StatusSelect
                  current={record.access_status}
                  onChange={(newStatus) => onStatusChange(record.access_id, newStatus)}
                />
              </td>
              <td className="py-2 pr-3 text-slate-500">
                {record.requested_at
                  ? new Date(record.requested_at).toLocaleDateString()
                  : '—'}
              </td>
              <td className="py-2 pr-3 text-slate-500">
                {record.granted_at
                  ? new Date(record.granted_at).toLocaleDateString()
                  : '—'}
              </td>
              <td className="py-2 pr-3 text-slate-500">
                {record.notes ?? '—'}
              </td>
              <td className="py-2">
                <StatusBadge status={record.access_status} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

// ── Blockers summary ──────────────────────────────────────────────────────────

function AccessBlockersList({ summary }: { summary: AccessReadinessSummary }) {
  if (summary.blockers.length === 0) return null

  return (
    <div className="rounded-md border border-red-200 bg-red-50 p-4">
      <h4 className="text-sm font-semibold text-red-800">
        Access Blockers ({summary.blocked})
      </h4>
      <ul className="mt-2 space-y-1">
        {summary.blockers.map((b, i) => (
          <li key={i} className="flex items-center gap-2 text-xs text-red-700">
            <span className="text-red-500">✗</span>
            <span className="font-medium">{b.systemName}</span>
            <span className="text-red-400">({b.role})</span>
            {b.notes && <span className="text-red-400">— {b.notes}</span>}
          </li>
        ))}
      </ul>
    </div>
  )
}

// ── Main Panel ────────────────────────────────────────────────────────────────

export function StudyAccessReadinessPanel({
  studyId,
  accessRecords,
  readinessSummary,
}: StudyAccessReadinessPanelProps) {
  const [updating, setUpdating] = useState<string | null>(null)
  const router = useRouter()

  const handleStatusChange = useCallback(
    async (accessId: string, newStatus: string) => {
      setUpdating(accessId)
      await updateAccessRecord({ accessId, accessStatus: newStatus as any })
      setUpdating(null)
      router.refresh()
    },
    [router],
  )

  return (
    <div className="space-y-4">
      <ReadinessScoreBar summary={readinessSummary} />
      <AccessBlockersList summary={readinessSummary} />
      <AccessRecordsTable records={accessRecords} onStatusChange={handleStatusChange} />
    </div>
  )
}
