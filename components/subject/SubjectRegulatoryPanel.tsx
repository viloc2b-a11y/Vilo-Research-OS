import { CheckCircle, Clock, FileText } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type SubjectReconsentReq = {
  id: string
  reconsentRequired: boolean
  reconsentStatus: string
  reconsentDueDate: string | null
  amendmentId: string | null
}

type Props = {
  studyId: string | null
  subjectId: string
  reconsentRequirements: SubjectReconsentReq[]
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function daysUntil(dateStr: string): number {
  const now = Date.UTC(
    new Date().getUTCFullYear(),
    new Date().getUTCMonth(),
    new Date().getUTCDate(),
  )
  const target = new Date(dateStr)
  const t = Date.UTC(target.getUTCFullYear(), target.getUTCMonth(), target.getUTCDate())
  return Math.floor((t - now) / 86_400_000)
}

const STATUS_CLASSES: Record<string, string> = {
  pending: 'bg-orange-50 text-orange-700 border-orange-200',
  completed: 'bg-green-50 text-green-700 border-green-200',
  waived: 'bg-slate-50 text-slate-500 border-slate-200',
}

function StatusBadge({ status }: { status: string }) {
  const cls = STATUS_CLASSES[status] ?? 'bg-slate-50 text-slate-500 border-slate-200'
  const label = status
    .split('_')
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ')

  return (
    <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-semibold ${cls}`}>
      {label}
    </span>
  )
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function SubjectRegulatoryPanel({ reconsentRequirements }: Props) {
  const pendingCount = reconsentRequirements.filter(
    (r) => r.reconsentRequired && r.reconsentStatus === 'pending',
  ).length

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <FileText className="size-4 text-blue-500" />
          Regulatory / Consent
          {pendingCount > 0 && (
            <span className="inline-flex items-center rounded-full border border-orange-200 bg-orange-50 px-2 py-0.5 text-xs font-semibold text-orange-700">
              {pendingCount} pending
            </span>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent>
        {reconsentRequirements.length === 0 ? (
          <div className="flex items-center gap-2 text-sm text-green-700">
            <CheckCircle className="size-4 text-green-500 flex-shrink-0" />
            No consent actions pending.
          </div>
        ) : (
          <ul className="space-y-2">
            {reconsentRequirements.map((req) => {
              const days = req.reconsentDueDate ? daysUntil(req.reconsentDueDate) : null
              const isOverdue = days !== null && days < 0
              const isUrgent = days !== null && days >= 0 && days <= 7

              return (
                <li key={req.id} className="rounded-md border px-3 py-2 text-sm">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <StatusBadge status={req.reconsentStatus} />
                    {req.amendmentId && (
                      <span className="text-xs text-muted-foreground font-mono">
                        Amendment {req.amendmentId.slice(0, 8)}…
                      </span>
                    )}
                  </div>
                  {req.reconsentDueDate && (
                    <div
                      className={`mt-1 flex items-center gap-1 text-xs font-medium ${
                        isOverdue
                          ? 'text-red-600'
                          : isUrgent
                          ? 'text-orange-600'
                          : 'text-slate-500'
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
      </CardContent>
    </Card>
  )
}
