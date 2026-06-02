import Link from 'next/link'
import { AlertTriangle, Clock, Activity, FileCheck, CheckCircle2, FileText, ChevronRight } from 'lucide-react'
import type { StudyWorkspaceRuntimeLinks } from '@/lib/study-workspace/study-workspace-links'
import type { StudyCommandCenterMetrics } from '@/lib/study-workspace/load-study-command-center-metrics'

type StudyCommandCenterViewProps = {
  studyName: string
  studyStatus: string | null
  links: StudyWorkspaceRuntimeLinks
  metrics: StudyCommandCenterMetrics
}

export function StudyCommandCenterView({
  studyName,
  studyStatus,
  links,
  metrics,
}: StudyCommandCenterViewProps) {
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="rounded-md border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="text-sm font-semibold text-slate-800">Study Command Center</h2>
        <p className="mt-2 text-sm text-slate-600">
          Operational overview for <span className="font-medium text-slate-900">{studyName}</span>
          {studyStatus ? (
            <span className="text-slate-500"> · {studyStatus}</span>
          ) : null}
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        
        {/* Action Required */}
        <div className="flex flex-col gap-4 rounded-md border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-amber-600" />
            <h3 className="font-semibold text-slate-900">Action Required</h3>
          </div>
          
          <div className="space-y-3">
            <div className="flex items-center justify-between rounded border border-slate-100 bg-slate-50 p-3">
              <span className="text-sm font-medium text-slate-700">Pending Signatures</span>
              {metrics.actionRequired.pendingSignatures > 0 ? (
                <span className="inline-flex rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-semibold text-amber-800">
                  {metrics.actionRequired.pendingSignatures}
                </span>
              ) : (
                <span className="text-sm text-slate-400">0</span>
              )}
            </div>
            
            <div className="flex items-center justify-between rounded border border-slate-100 bg-slate-50 p-3">
              <span className="text-sm font-medium text-slate-700">Regulatory Expirations</span>
              {metrics.actionRequired.regulatoryExpirations > 0 ? (
                <span className="inline-flex rounded-full bg-rose-100 px-2.5 py-0.5 text-xs font-semibold text-rose-800">
                  {metrics.actionRequired.regulatoryExpirations}
                </span>
              ) : (
                <span className="text-sm text-slate-400">0</span>
              )}
            </div>
            
            <div className="flex items-center justify-between rounded border border-slate-100 bg-slate-50 p-3">
              <span className="text-sm font-medium text-slate-700">Open Obligations</span>
              {metrics.actionRequired.pendingSignatures > 0 ? (
                <span className="inline-flex rounded-full bg-blue-100 px-2.5 py-0.5 text-xs font-semibold text-blue-800">
                  {metrics.actionRequired.pendingSignatures}
                </span>
              ) : (
                <span className="text-sm text-slate-400">0</span>
              )}
            </div>
          </div>
        </div>

        {/* Visit Horizon */}
        <div className="flex flex-col gap-4 rounded-md border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center gap-2">
            <Clock className="h-5 w-5 text-teal-600" />
            <h3 className="font-semibold text-slate-900">Visit Horizon</h3>
          </div>
          
          <div className="space-y-3">
            <div className="flex items-center justify-between rounded border border-slate-100 bg-slate-50 p-3">
              <span className="text-sm font-medium text-slate-700">Visits next 7 days</span>
              <span className="text-sm font-semibold text-slate-900">{metrics.visitHorizon.next7Days}</span>
            </div>
            
            <div className="flex items-center justify-between rounded border border-slate-100 bg-slate-50 p-3">
              <span className="text-sm font-medium text-slate-700">Visits next 14 days</span>
              <span className="text-sm font-semibold text-slate-900">{metrics.visitHorizon.next14Days}</span>
            </div>
            
            <div className="flex items-center justify-between rounded border border-slate-100 bg-slate-50 p-3">
              <span className="text-sm font-medium text-slate-700">Overdue Visits</span>
              {metrics.visitHorizon.overdue > 0 ? (
                <span className="inline-flex rounded-full bg-rose-100 px-2.5 py-0.5 text-xs font-semibold text-rose-800">
                  {metrics.visitHorizon.overdue}
                </span>
              ) : (
                <span className="text-sm font-semibold text-slate-900">0</span>
              )}
            </div>
          </div>
          
          <div className="mt-auto pt-2">
            <Link 
              href={links.visitRuntime} 
              className="inline-flex w-full items-center justify-center gap-1 rounded-md bg-slate-900 px-3 py-2 text-sm font-medium text-white hover:bg-slate-800"
            >
              Open Visit Matrix <ChevronRight className="h-4 w-4" />
            </Link>
          </div>
        </div>

        {/* Subject Attention */}
        <div className="flex flex-col gap-4 rounded-md border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center gap-2">
            <Activity className="h-5 w-5 text-blue-600" />
            <h3 className="font-semibold text-slate-900">Subject Attention</h3>
          </div>
          
          <div className="space-y-3">
            <div className="flex items-center justify-between rounded border border-slate-100 bg-slate-50 p-3">
              <span className="text-sm font-medium text-slate-700">Subjects with Active AEs</span>
              {metrics.subjectAttention.withActiveAEs > 0 ? (
                <span className="inline-flex rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-semibold text-amber-800">
                  {metrics.subjectAttention.withActiveAEs}
                </span>
              ) : (
                <span className="text-sm font-semibold text-slate-900">0</span>
              )}
            </div>
            
            <div className="flex items-center justify-between rounded border border-slate-100 bg-slate-50 p-3">
              <span className="text-sm font-medium text-slate-700">Subjects with Overdue Visits</span>
              {metrics.subjectAttention.withOverdueVisits > 0 ? (
                <span className="inline-flex rounded-full bg-rose-100 px-2.5 py-0.5 text-xs font-semibold text-rose-800">
                  {metrics.subjectAttention.withOverdueVisits}
                </span>
              ) : (
                <span className="text-sm font-semibold text-slate-900">0</span>
              )}
            </div>
            
            <div className="flex items-center justify-between rounded border border-slate-100 bg-slate-50 p-3">
              <span className="text-sm font-medium text-slate-700">Subjects requiring review</span>
              {metrics.subjectAttention.requiringReview > 0 ? (
                <span className="inline-flex rounded-full bg-blue-100 px-2.5 py-0.5 text-xs font-semibold text-blue-800">
                  {metrics.subjectAttention.requiringReview}
                </span>
              ) : (
                <span className="text-sm font-semibold text-slate-900">0</span>
              )}
            </div>
          </div>
          
          <div className="mt-auto pt-2">
            <Link 
              href={links.studySubjects} 
              className="inline-flex w-full items-center justify-center gap-1 rounded-md border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-900 hover:bg-slate-50"
            >
              Open Subject Roster <ChevronRight className="h-4 w-4 text-slate-500" />
            </Link>
          </div>
        </div>
      </div>

      {/* Recent Activity */}
      <div className="rounded-md border border-slate-200 bg-white p-5 shadow-sm">
        <h3 className="font-semibold text-slate-900">Recent Activity</h3>
        <div className="mt-4 space-y-4">
          {metrics.recentActivity.length > 0 ? (
            metrics.recentActivity.map((activity, idx) => (
              <div key={`${activity.id}-${idx}`} className="flex items-start gap-3">
                <div className="mt-0.5 rounded-full bg-slate-100 p-1.5">
                  {activity.type === 'visit_completed' && <CheckCircle2 className="h-4 w-4 text-teal-600" />}
                  {activity.type === 'document_uploaded' && <FileText className="h-4 w-4 text-slate-600" />}
                  {activity.type === 'signature_completed' && <FileCheck className="h-4 w-4 text-blue-600" />}
                </div>
                <div>
                  <p className="text-sm font-medium text-slate-900">{activity.description}</p>
                  <p className="text-xs text-slate-500">
                    {new Date(activity.date).toLocaleDateString()} at {new Date(activity.date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </p>
                </div>
              </div>
            ))
          ) : (
            <div className="py-4 text-center text-sm text-slate-500">
              No recent activity recorded for this study.
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
