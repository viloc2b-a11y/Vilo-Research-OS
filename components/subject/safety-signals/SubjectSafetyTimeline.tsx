import Link from 'next/link'
import type { ReactNode } from 'react'
import { SignalListOverflow } from '@/components/subject/signal-density/SignalListOverflow'
import type { SafetySignalItem, SafetySignalSeverity } from '@/lib/subject/safety-signals/types'
import { cn } from '@/lib/utils'

type SubjectSafetyTimelineProps = {
  items: SafetySignalItem[]
  hiddenCount?: number
  moreHref?: string | null
}

function severityTone(severity: SafetySignalSeverity): string {
  switch (severity) {
    case 'error':
    case 'high':
      return 'border-rose-400 bg-rose-50/90'
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

export function SubjectSafetyTimeline({
  items,
  hiddenCount = 0,
  moreHref = null,
}: SubjectSafetyTimelineProps) {
  if (items.length === 0) {
    return (
      <section
        className="rounded-lg border bg-card p-4"
        style={{ borderColor: 'var(--border)' }}
      >
        <h2 className="text-sm font-semibold" style={{ color: 'var(--foreground)' }}>
          Safety / AE signal chronology
        </h2>
        <p className="mt-2 text-sm" style={{ color: 'var(--muted-foreground)' }}>
          No source-backed safety signals for this subject yet. Structured AE case reporting is
          not wired — items will appear from validation findings, workflow, operational events, and
          documented allergies when present.
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
          Safety / AE signal chronology
        </h2>
        <p className="text-xs" style={{ color: 'var(--muted-foreground)' }}>
          Longitudinal operational signals — not inferred clinical AE facts.
        </p>
      </div>

      <ol className="relative space-y-0 border-l pl-6" style={{ borderColor: 'var(--border)' }}>
        {items.map((item, index) => {
          const isLast = index === items.length - 1
          return (
            <li key={item.id} className={cn('relative pb-5', isLast && 'pb-0')}>
              <span
                className="absolute -left-[1.4rem] top-1 h-3 w-3 rounded-full border-2 border-white"
                style={{ backgroundColor: item.actionNeeded ? 'var(--destructive)' : 'var(--primary)' }}
                aria-hidden
              />
              <article className={cn('rounded-md border p-3 text-sm', severityTone(item.severity))}>
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
                      {item.sourceLabel}
                    </span>
                    {item.severity !== 'unknown' ? (
                      <span className="rounded border px-1.5 py-0.5 bg-card/80 uppercase">
                        {item.severity}
                      </span>
                    ) : null}
                    {item.status ? (
                      <span className="rounded border px-1.5 py-0.5 bg-card/80">
                        {item.status.replace(/_/g, ' ')}
                      </span>
                    ) : null}
                    {item.isUnresolved ? (
                      <span className="rounded border border-amber-300 px-1.5 py-0.5 text-amber-900 bg-amber-50">
                        Open
                      </span>
                    ) : null}
                    {item.actionNeeded ? (
                      <span className="rounded border border-rose-300 px-1.5 py-0.5 text-rose-900 bg-rose-50">
                        Action needed
                      </span>
                    ) : null}
                  </div>
                </div>

                {item.description ? (
                  <p className="mt-2 text-xs" style={{ color: '#64748b' }}>
                    {item.description}
                  </p>
                ) : null}

                <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1">
                  {item.href ? <TimelineLink href={item.href}>Open</TimelineLink> : null}
                  {item.captureHref ? (
                    <TimelineLink href={item.captureHref}>Source capture</TimelineLink>
                  ) : null}
                  {item.reviewHref ? (
                    <TimelineLink href={item.reviewHref}>Source review</TimelineLink>
                  ) : null}
                  {item.missingFollowUp ? (
                    <span className="text-xs text-amber-800">Follow-up incomplete</span>
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
