import Link from 'next/link'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { CheckCircle, AlertTriangle, Clock, FileCheck } from 'lucide-react'
import type { SubjectConsentVersionRow, SubjectReconsentRequirementRow } from '@/lib/consent-runtime/consent-types'
import { subjectChartPath } from '@/lib/ops/paths'

type Props = {
  consents: SubjectConsentVersionRow[]
  reconsentRequirements: SubjectReconsentRequirementRow[]
  studyId: string | null
  subjectId: string
}

function daysUntil(dateStr: string): number {
  const now = Date.UTC(new Date().getUTCFullYear(), new Date().getUTCMonth(), new Date().getUTCDate())
  const target = new Date(dateStr)
  const t = Date.UTC(target.getUTCFullYear(), target.getUTCMonth(), target.getUTCDate())
  return Math.floor((t - now) / 86_400_000)
}

const RECONSENT_STATUS_CLASSES: Record<string, string> = {
  not_required: 'bg-slate-50 text-slate-400 border-slate-200',
  pending: 'bg-orange-50 text-orange-700 border-orange-200',
  overdue: 'bg-red-50 text-red-700 border-red-200',
  completed: 'bg-green-50 text-green-700 border-green-200',
  waived: 'bg-slate-50 text-slate-500 border-slate-200',
}

export function SubjectConsentPanel({ consents, reconsentRequirements, studyId, subjectId }: Props) {
  const activeConsent = consents.find((c) => c.status === 'active')
  const pendingReconsent = reconsentRequirements.filter(
    (r) => r.reconsentStatus === 'pending' || r.reconsentStatus === 'overdue',
  )
  const overdueCount = reconsentRequirements.filter((r) => r.reconsentStatus === 'overdue').length

  // Overall status indicator
  const headerStatus = overdueCount > 0
    ? 'overdue'
    : pendingReconsent.length > 0
    ? 'pending'
    : activeConsent
    ? 'ok'
    : 'none'

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <FileCheck className="size-4 text-emerald-500" />
          Consent Status
          {headerStatus === 'overdue' && (
            <span className="inline-flex items-center gap-1 rounded-full border border-red-200 bg-red-50 px-2 py-0.5 text-xs font-semibold text-red-700">
              <AlertTriangle className="size-3" />
              {overdueCount} overdue
            </span>
          )}
          {headerStatus === 'pending' && (
            <span className="inline-flex items-center gap-1 rounded-full border border-orange-200 bg-orange-50 px-2 py-0.5 text-xs font-semibold text-orange-700">
              <AlertTriangle className="size-3" />
              {pendingReconsent.length} pending
            </span>
          )}
          {headerStatus === 'ok' && (
            <span className="inline-flex items-center gap-1 rounded-full border border-green-200 bg-green-50 px-2 py-0.5 text-xs font-semibold text-green-700">
              <CheckCircle className="size-3" />
              Consented
            </span>
          )}
          {studyId && (
            <Link
              href={`${subjectChartPath(studyId, subjectId)}?tab=consent`}
              className="ml-auto text-xs font-medium text-primary hover:underline"
            >
              Manage
            </Link>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {consents.length === 0 ? (
          <p className="text-sm text-muted-foreground">No consent on record.</p>
        ) : (
          <>
            {/* Active consent summary */}
            {activeConsent && (
              <div className="rounded-md border px-3 py-2 text-sm">
                <div className="flex items-center gap-2">
                  <CheckCircle className="size-3.5 text-green-500 shrink-0" />
                  <span className="font-medium">{activeConsent.consentVersionLabel}</span>
                  <span className="text-xs text-muted-foreground">
                    {activeConsent.consentType.replace(/_/g, ' ')}
                  </span>
                </div>
                {activeConsent.activeAt && (
                  <p className="mt-1 text-xs text-muted-foreground">
                    Active since{' '}
                    {new Date(activeConsent.activeAt).toLocaleDateString(undefined, { dateStyle: 'medium' })}
                  </p>
                )}
              </div>
            )}

            {/* Reconsent requirements */}
            {reconsentRequirements.length > 0 && (
              <ul className="space-y-2">
                {reconsentRequirements.map((req) => {
                  const days = req.reconsentDueDate ? daysUntil(req.reconsentDueDate) : null
                  const isOverdue = days !== null && days < 0
                  const isUrgent = days !== null && days >= 0 && days <= 7
                  const cls = RECONSENT_STATUS_CLASSES[req.reconsentStatus] ?? 'bg-slate-50 text-slate-500 border-slate-200'
                  const statusLabel = req.reconsentStatus.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())

                  return (
                    <li key={req.id} className="rounded-md border px-3 py-2 text-sm">
                      <div className="flex items-center gap-1.5">
                        <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-semibold ${cls}`}>
                          {statusLabel}
                        </span>
                        {req.reason && (
                          <span className="text-xs text-muted-foreground">{req.reason}</span>
                        )}
                      </div>
                      {req.reconsentDueDate && (
                        <div
                          className={`mt-1 flex items-center gap-1 text-xs font-medium ${
                            isOverdue ? 'text-red-600' : isUrgent ? 'text-orange-600' : 'text-slate-500'
                          }`}
                        >
                          <Clock className="size-3" />
                          {isOverdue
                            ? `OVERDUE (${Math.abs(days ?? 0)}d ago)`
                            : days === 0
                            ? 'Due TODAY'
                            : `Due in ${days}d`}
                        </div>
                      )}
                    </li>
                  )
                })}
              </ul>
            )}
          </>
        )}
      </CardContent>
    </Card>
  )
}
