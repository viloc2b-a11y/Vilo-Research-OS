import { cn } from '@/lib/utils'
import type {
  EdcStatus,
  QcStatus,
  ReviewStatus,
  SourceStatus,
  SubjectPaymentStatus,
  VisitGridStatus,
} from '@/lib/subject/visits/types'

const visitTone: Record<VisitGridStatus, string> = {
  scheduled: 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-200',
  confirmed: 'bg-teal-100 text-teal-800 dark:bg-teal-950 dark:text-teal-200',
  in_progress: 'bg-sky-100 text-sky-800 dark:bg-sky-950 dark:text-sky-200',
  completed: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-200',
  missed: 'bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-200',
  cancelled: 'bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300',
  out_of_window: 'bg-amber-100 text-amber-900 dark:bg-amber-950 dark:text-amber-200',
}

const pipelineTone: Record<string, string> = {
  not_started: 'bg-muted text-muted-foreground',
  draft: 'bg-amber-50 text-amber-900 dark:bg-amber-950 dark:text-amber-200',
  submitted: 'bg-sky-50 text-sky-900 dark:bg-sky-950 dark:text-sky-200',
  corrected: 'bg-violet-50 text-violet-900 dark:bg-violet-950 dark:text-violet-200',
  signed: 'bg-emerald-50 text-emerald-900 dark:bg-emerald-950 dark:text-emerald-200',
  pending: 'bg-muted text-muted-foreground',
  entered: 'bg-sky-50 text-sky-900 dark:bg-sky-950 dark:text-sky-200',
  verified: 'bg-emerald-50 text-emerald-900 dark:bg-emerald-950 dark:text-emerald-200',
  in_review: 'bg-sky-50 text-sky-900 dark:bg-sky-950 dark:text-sky-200',
  complete: 'bg-emerald-50 text-emerald-900 dark:bg-emerald-950 dark:text-emerald-200',
  scheduled_pay: 'bg-slate-100 text-slate-700',
  paid: 'bg-emerald-50 text-emerald-900',
  waived: 'bg-zinc-100 text-zinc-600',
  'n/a': 'bg-muted text-muted-foreground',
}

function label(value: string) {
  return value.replace(/_/g, ' ')
}

type StatusBadgeProps = {
  value: string
  toneMap?: Record<string, string>
  className?: string
}

export function StatusBadge({ value, toneMap = pipelineTone, className }: StatusBadgeProps) {
  const tone = toneMap[value] ?? 'bg-muted text-muted-foreground'
  return (
    <span
      className={cn(
        'inline-flex items-center rounded px-2 py-0.5 text-xs font-medium capitalize',
        tone,
        className,
      )}
    >
      {label(value)}
    </span>
  )
}

export function VisitStatusBadge({ status }: { status: VisitGridStatus }) {
  return <StatusBadge value={status} toneMap={visitTone} />
}

export function SourceStatusBadge({ status }: { status: SourceStatus }) {
  return <StatusBadge value={status} />
}

export function EdcStatusBadge({ status }: { status: EdcStatus }) {
  return <StatusBadge value={status} />
}

export function QcStatusBadge({ status }: { status: QcStatus }) {
  return <StatusBadge value={status} />
}

export function ReviewStatusBadge({ status }: { status: ReviewStatus }) {
  return <StatusBadge value={status} />
}

export function SubjectPaymentBadge({ status }: { status: SubjectPaymentStatus }) {
  const map = {
    ...pipelineTone,
    scheduled: pipelineTone.scheduled_pay,
  }
  return <StatusBadge value={status} toneMap={map} />
}
