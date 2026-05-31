'use client'

import { useState } from 'react'
import Link from 'next/link'
import {
  Users,
  ChevronRight,
  AlertTriangle,
  FileText,
  CalendarDays,
  CheckCircle2,
  Filter
} from 'lucide-react'
import { OperationalTableScroll } from '@/components/runtime-ui/OperationalTableScroll'
import type { StudySubjectCommandCenterModel, SubjectCommandCenterRow } from '@/lib/studies/load-study-subject-command-center'

export function StudySubjectCommandCenter({
  model,
  studyId
}: {
  model: StudySubjectCommandCenterModel
  studyId: string
}) {
  const [showInactive, setShowInactive] = useState(false)

  if (model.error) {
    return <div className="p-6 text-sm text-destructive">{model.error}</div>
  }

  const isInactive = (status: string) => {
    return ['screen_failed', 'early_terminated', 'withdrawn', 'completed'].includes(status)
  }

  const filteredRows = model.rows.filter(r => showInactive || !isInactive(r.enrollmentStatus))

  const { counters } = model
  const actionStats = {
    actionRequired: filteredRows.filter((row) => row.actionRequired !== 'None').length,
    overdue: filteredRows.filter((row) =>
      ['Visit Overdue', 'Review Overdue', 'Waiver Requires Approval'].includes(row.actionRequired)
      || row.reconsentStatus === 'Overdue',
    ).length,
    dueToday: filteredRows.filter((row) =>
      ['Review Due Today', 'Review Dispensation', 'Upload Consent Document'].includes(row.actionRequired),
    ).length,
  }

  return (
    <div className="flex flex-col h-full space-y-6">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Counter label="Action Required" value={actionStats.actionRequired} color="text-red-500" />
        <Counter label="Overdue" value={actionStats.overdue} color="text-red-500" />
        <Counter label="Due Today" value={actionStats.dueToday} color="text-amber-500" />
        <Counter label="Active Subjects" value={counters.activeSubjects} color="text-primary" />
      </div>

      <div className="flex flex-wrap gap-x-5 gap-y-1 rounded-md border border-border/60 bg-card px-4 py-2 text-xs text-muted-foreground">
        <span>Screening: {counters.screening}</span>
        <span>Randomized: {counters.randomized}</span>
        <span>Need consent: {counters.needConsent}</span>
        <span>Need reconsent: {counters.needReconsent}</span>
        <span>Pending upload: {counters.pendingUpload}</span>
        <span>Upcoming visits: {counters.upcomingVisits}</span>
      </div>

      {/* Grid */}
      <div className="vilo-card flex flex-col min-h-0 flex-1">
        <div className="flex items-center justify-between px-5 py-4 border-b border-border/60">
          <h2 className="text-sm font-semibold text-foreground flex items-center gap-2">
            <Users className="w-4 h-4 text-primary" />
            Subject Command Center
            <span className="text-[10px] font-normal text-muted-foreground ml-1">{filteredRows.length} shown</span>
          </h2>
          <label className="flex items-center gap-2 text-xs text-muted-foreground cursor-pointer">
            <Filter className="w-3.5 h-3.5" />
            <input 
              type="checkbox" 
              checked={showInactive} 
              onChange={e => setShowInactive(e.target.checked)}
              className="rounded border-border/60 bg-accent text-primary focus:ring-primary/20"
            />
            Show Inactive Subjects
          </label>
        </div>

        {filteredRows.length === 0 ? (
          <div className="p-10 text-center">
            <Users className="w-8 h-8 text-muted-foreground mx-auto mb-3" />
            <p className="text-sm text-muted-foreground">No coordinator action required for this filter.</p>
          </div>
        ) : (
          <OperationalTableScroll>
            <table className="w-full text-left border-collapse text-xs">
              <thead className="bg-accent/40 sticky top-0 z-10 backdrop-blur-sm border-b border-border/60">
                <tr>
                  <th className="px-4 py-3 font-medium text-muted-foreground whitespace-nowrap">Subject</th>
                  <th className="px-4 py-3 font-medium text-muted-foreground whitespace-nowrap">Demographics</th>
                  <th className="px-4 py-3 font-medium text-muted-foreground whitespace-nowrap">Enrollment</th>
                  <th className="px-4 py-3 font-medium text-muted-foreground whitespace-nowrap">Consent / Reconsent</th>
                  <th className="px-4 py-3 font-medium text-muted-foreground whitespace-nowrap">Visits</th>
                  <th className="px-4 py-3 font-medium text-muted-foreground whitespace-nowrap">Action Required</th>
                  <th className="px-4 py-3 font-medium text-muted-foreground whitespace-nowrap text-right">Quick Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/60 bg-card">
                {filteredRows.map(row => (
                  <CommandCenterRow key={row.subjectId} row={row} studyId={studyId} />
                ))}
              </tbody>
            </table>
          </OperationalTableScroll>
        )}
      </div>
    </div>
  )
}

function Counter({ label, value, color }: { label: string, value: number, color: string }) {
  return (
    <div className="vilo-card p-3 text-center flex flex-col justify-center items-center h-full">
      <span className={`text-xl font-bold ${color}`}>{value}</span>
      <span className="text-[10px] text-muted-foreground leading-tight mt-1">{label}</span>
    </div>
  )
}

function CommandCenterRow({ row, studyId }: { row: SubjectCommandCenterRow, studyId: string }) {
  const getActionColor = (action: string) => {
    switch (action) {
      case 'None': return 'text-muted-foreground'
      case 'Visit Overdue':
      case 'Obtain Reconsent':
      case 'Review Overdue':
      case 'Waiver Requires Approval': return 'text-red-500 font-medium'
      case 'Obtain Initial Consent': 
      case 'Upload Consent Document':
      case 'Review Due Today': return 'text-amber-500 font-medium'
      case 'Schedule Visit':
      case 'Review Dispensation': return 'text-blue-500 font-medium'
      default: return 'text-foreground'
    }
  }

  const consentStatusColor = {
    Missing: 'text-amber-500',
    Active: 'text-primary',
    Expired: 'text-red-500',
    Withdrawn: 'text-red-500'
  }[row.consentStatus]

  const reconsentStatusColor = {
    'Not Required': 'text-muted-foreground',
    Pending: 'text-amber-500',
    Overdue: 'text-red-500',
    Completed: 'text-primary',
    Waived: 'text-muted-foreground'
  }[row.reconsentStatus]

  return (
    <tr className="hover:bg-accent/30 transition-colors group">
      <td className="px-4 py-3 align-top">
        <Link href={`/studies/${studyId}/subjects/${row.subjectId}`} className="font-medium text-primary hover:underline flex items-center gap-1">
          {row.subjectNumber}
          <ChevronRight className="w-3 h-3 opacity-0 group-hover:opacity-100 transition-opacity" />
        </Link>
        <div className="text-[10px] text-muted-foreground mt-0.5">{row.subjectName}</div>
      </td>
      <td className="px-4 py-3 align-top whitespace-nowrap">
        <div className="text-foreground">DOB: {row.dob} ({row.age})</div>
        <div className="text-[10px] text-muted-foreground mt-0.5">P: {row.phone} / E: {row.email}</div>
      </td>
      <td className="px-4 py-3 align-top capitalize">
        <div className="flex flex-col gap-1">
          <span>{row.enrollmentStatus}</span>
          <span className="text-[10px] text-muted-foreground">Coord: {row.assignedCoordinator}</span>
        </div>
      </td>
      <td className="px-4 py-3 align-top">
        <div className="flex flex-col gap-1">
          <span className={consentStatusColor}>Consent: {row.consentStatus}</span>
          <span className={`text-[10px] ${reconsentStatusColor}`}>Reconsent: {row.reconsentStatus}</span>
        </div>
      </td>
      <td className="px-4 py-3 align-top">
        <div className="flex flex-col gap-1">
          <span className="text-foreground">Next: {row.nextVisit ?? 'None'}</span>
          <span className="text-[10px] text-muted-foreground">Prog: {row.visitProgress} (Last: {row.lastVisit ?? 'None'})</span>
        </div>
      </td>
      <td className="px-4 py-3 align-top">
        <span className={getActionColor(row.actionRequired)}>
          {row.actionRequired !== 'None' && <AlertTriangle className="w-3 h-3 inline mr-1 mb-0.5" />}
          {row.actionRequired}
        </span>
      </td>
      <td className="px-4 py-3 align-top text-right space-x-2 whitespace-nowrap">
        <Link 
          href={`/studies/${studyId}/subjects/${row.subjectId}`}
          className="inline-flex items-center gap-1 px-2 py-1 rounded bg-accent text-foreground hover:bg-border/60 transition-colors"
        >
          <FileText className="w-3 h-3" /> Chart
        </Link>
        <Link 
          href={`/studies/${studyId}/subjects/${row.subjectId}#consent${row.actionRequired === 'Obtain Reconsent' ? '?mode=reconsent' : ''}`}
          className="inline-flex items-center gap-1 px-2 py-1 rounded bg-accent text-foreground hover:bg-border/60 transition-colors"
        >
          <CheckCircle2 className="w-3 h-3" /> Consent
        </Link>
        {row.nextVisitId && (
          <Link 
            href={`/studies/${studyId}/subjects/${row.subjectId}/visits/${row.nextVisitId}`}
            className="inline-flex items-center gap-1 px-2 py-1 rounded bg-primary/10 text-primary hover:bg-primary/20 transition-colors"
          >
            <CalendarDays className="w-3 h-3" /> Visit
          </Link>
        )}
      </td>
    </tr>
  )
}
