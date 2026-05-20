import Link from 'next/link'
import type { ReactNode } from 'react'
import { SignalListOverflow } from '@/components/subject/signal-density/SignalListOverflow'
import type {
  RegulatorySignalItem,
  RegulatorySignalSeverity,
  RegulatorySignalType,
} from '@/lib/subject/regulatory-signals/types'
import { cn } from '@/lib/utils'

const SIGNAL_TYPE_LABELS: Record<RegulatorySignalType, string> = {
  missed_visit: 'Missed visit',
  out_of_window_visit: 'Out of window',
  blocked_procedure: 'Blocked procedure',
  incomplete_procedure: 'Incomplete procedure',
  validation_finding: 'Validation finding',
  pending_source_review: 'Pending source',
  overdue_workflow: 'Overdue workflow',
  pending_signature: 'Pending signature',
}

function severityTone(severity: RegulatorySignalSeverity): string {
  switch (severity) {
    case 'critical':
      return 'border-rose-400 bg-rose-50/90'
    case 'high':
      return 'border-rose-300 bg-rose-50/80'
    case 'warning':
      return 'border-amber-300 bg-amber-50/80'
    default:
      return 'border-slate-200 bg-background'
  }
}

function TimelineLink({ href, children }: { href: string; children: ReactNode }) {
  return (
    <Link href={href} className="text-xs font-medium text-primary hover:underline">
      {children}
    </Link>
  )
}

function formatWhen(iso: string) {
  try {
    return new Date(iso).toLocaleString(undefined, {
      dateStyle: 'medium',
      timeStyle: 'short',
    })
  } catch {
    return iso
  }
}

type SubjectRegulatoryTimelineProps = {
  items: RegulatorySignalItem[]
  hiddenCount?: number
  moreHref?: string | null
}

export function SubjectRegulatoryTimeline({
  items,
  hiddenCount = 0,
  moreHref = null,
}: SubjectRegulatoryTimelineProps) {
  if (items.length === 0) {
    return (
      <section
        className="rounded-lg border bg-card p-4"
        style={{ borderColor: 'var(--border)' }}
      >
        <h2 className="text-sm font-semibold" style={{ color: 'var(--foreground)' }}>
          Regulatory signal chronology
        </h2>
        <p className="mt-2 text-sm" style={{ color: 'var(--muted-foreground)' }}>
          No open regulatory signals detected from visits, source validation, workflow, or
          signatures. Formal protocol deviation records are not available in this release.
        </p>
      </section>
    )
  }

  return (
    <section
      className="rounded-lg border bg-card p-4"
      style={{ borderColor: 'var(--border)' }}
    >
      <div className="mb-3">
        <h2 className="text-sm font-semibold" style={{ color: 'var(--foreground)' }}>
          Regulatory signal chronology
        </h2>
        <p className="text-xs" style={{ color: 'var(--muted-foreground)' }}>
          Source-backed execution risks sorted by severity — not final deviation adjudication.
        </p>
      </div>

      <ol className="relative space-y-0 border-l pl-6" style={{ borderColor: 'var(--border)' }}>
        {items.map((item, index) => {
          const isLast = index === items.length - 1
          return (
            <li key={item.id} className={cn('relative pb-5', isLast && 'pb-0')}>
              <span
                className="absolute -left-[1.4rem] top-1 h-3 w-3 rounded-full border-2 border-white"
                style={{
                  backgroundColor:
                    item.severity === 'critical' ? 'var(--destructive)' : '#d97706',
                }}
                aria-hidden
              />
              <article
                className={cn('rounded-md border p-3 text-sm', severityTone(item.severity))}
              >
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="font-medium" style={{ color: 'var(--foreground)' }}>
                      {item.title}
                    </p>
                    <p className="text-xs mt-0.5" style={{ color: 'var(--muted-foreground)' }}>
                      {formatWhen(item.occurredAt)}
                      {item.visitName ? ` · ${item.visitName}` : ''}
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-1 text-[10px]">
                    <span className="rounded border px-1.5 py-0.5 bg-card/80">
                      {SIGNAL_TYPE_LABELS[item.signalType]}
                    </span>
                    <span className="rounded border px-1.5 py-0.5 bg-card/80 uppercase">
                      {item.severity}
                    </span>
                    {item.priority ? (
                      <span className="rounded border px-1.5 py-0.5 bg-card/80">
                        {item.priority}
                      </span>
                    ) : null}
                    <span
                      className={cn(
                        'rounded border px-1.5 py-0.5',
                        item.isUnresolved
                          ? 'border-amber-300 bg-amber-50 text-amber-900'
                          : 'bg-card/80',
                      )}
                    >
                      {item.status}
                    </span>
                  </div>
                </div>

                {item.description ? (
                  <p className="mt-2 text-xs" style={{ color: '#64748b' }}>
                    {item.description}
                  </p>
                ) : null}

                <p className="mt-2 text-xs font-medium" style={{ color: '#2a8577' }}>
                  Recommended: {item.recommendedAction}
                </p>
                <p className="mt-1 text-[10px]" style={{ color: 'var(--muted-foreground)' }}>
                  Source: {item.sourceLabel}
                </p>

                <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1">
                  {item.href ? <TimelineLink href={item.href}>Open</TimelineLink> : null}
                  {item.captureHref ? (
                    <TimelineLink href={item.captureHref}>Source capture</TimelineLink>
                  ) : null}
                  {item.reviewHref ? (
                    <TimelineLink href={item.reviewHref}>Source review</TimelineLink>
                  ) : null}
                </div>
              </article>
            </li>
          )
        })}
      </ol>
      <SignalListOverflow
        hiddenCount={hiddenCount}
        moreHref={moreHref}
        label="Open visits grid"
      />
    </section>
  )
}
