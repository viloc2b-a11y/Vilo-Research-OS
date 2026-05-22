import Link from 'next/link'
import type { ReactNode } from 'react'
import { Pencil } from 'lucide-react'
import { Button } from '@/components/ui/button'
import type {
  AdverseEventTimelineSection,
  SubjectAdverseEventTimelineItem,
} from '@/lib/subject/adverse-events/types'
import { cn } from '@/lib/utils'

type SubjectAdverseEventsTimelineProps = {
  sections: AdverseEventTimelineSection[]
  onEditRegistry?: (registryId: string) => void
}

function TimelineLink({ href, children }: { href: string; children: ReactNode }) {
  return (
    <Link href={href} className="text-xs font-medium text-primary hover:underline">
      {children}
    </Link>
  )
}

function formatDate(iso: string | null) {
  if (!iso) return '—'
  try {
    return new Date(iso).toLocaleDateString(undefined, { dateStyle: 'medium' })
  } catch {
    return iso
  }
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

function statusBadge(status: SubjectAdverseEventTimelineItem['lifecycleStatus']) {
  const labels: Record<SubjectAdverseEventTimelineItem['lifecycleStatus'], string> = {
    open: 'Open',
    follow_up: 'Follow-up',
    resolved: 'Resolved',
    closed: 'Closed',
  }
  const tones: Record<SubjectAdverseEventTimelineItem['lifecycleStatus'], string> = {
    open: 'border-amber-300 bg-amber-50 text-amber-900',
    follow_up: 'border-sky-300 bg-sky-50 text-sky-900',
    resolved: 'border-emerald-300 bg-emerald-50 text-emerald-900',
    closed: 'border-slate-300 bg-slate-50 text-slate-700',
  }
  return (
    <span className={cn('rounded border px-1.5 py-0.5 text-[10px]', tones[status])}>
      {labels[status]}
    </span>
  )
}

function AeCard({
  item,
  onEditRegistry,
}: {
  item: SubjectAdverseEventTimelineItem
  onEditRegistry?: (registryId: string) => void
}) {
  return (
    <article
      className={cn(
        'rounded-md border p-3 text-sm',
        item.isSeriousAdverseEvent && item.lifecycleStatus !== 'closed'
          ? 'border-rose-300 bg-rose-50/80'
          : 'border-slate-200 bg-background',
      )}
    >
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="font-medium" style={{ color: 'var(--foreground)' }}>
            {item.eventTerm}
          </p>
          {item.preferredTerm && item.preferredTerm !== item.eventTerm ? (
            <p className="text-xs mt-0.5" style={{ color: 'var(--muted-foreground)' }}>
              Preferred: {item.preferredTerm}
            </p>
          ) : null}
        </div>
        <div className="flex flex-wrap gap-1">
          {item.isEditable ? (
            <span className="rounded border border-violet-300 bg-violet-50 px-1.5 py-0.5 text-[10px] text-violet-900">
              Subject registry
            </span>
          ) : null}
          {statusBadge(item.lifecycleStatus)}
          {item.isSeriousAdverseEvent ? (
            <span className="rounded border border-rose-400 px-1.5 py-0.5 text-[10px] text-rose-900 bg-rose-50">
              SAE
            </span>
          ) : null}
        </div>
      </div>

      <dl className="mt-2 grid grid-cols-2 gap-x-4 gap-y-1 text-xs sm:grid-cols-3">
        <div>
          <dt className="text-muted-foreground">Severity</dt>
          <dd>{item.severity ?? '—'}</dd>
        </div>
        <div>
          <dt className="text-muted-foreground">Relationship</dt>
          <dd>{item.relationship ?? '—'}</dd>
        </div>
        <div>
          <dt className="text-muted-foreground">Onset</dt>
          <dd>{formatDate(item.onsetDate)}</dd>
        </div>
        <div>
          <dt className="text-muted-foreground">Resolution</dt>
          <dd>{formatDate(item.resolutionDate)}</dd>
        </div>
        <div>
          <dt className="text-muted-foreground">Visit</dt>
          <dd>{item.visitLabel ?? '—'}</dd>
        </div>
        <div>
          <dt className="text-muted-foreground">Source</dt>
          <dd>{item.sourceAttribution}</dd>
        </div>
      </dl>

      <p className="mt-2 text-[11px]" style={{ color: 'var(--muted-foreground)' }}>
        Updated {formatWhen(item.lastUpdatedAt)}
        {item.reporter ? ` · Reporter ${item.reporter}` : ''}
      </p>

      <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1">
        {item.isEditable && item.registryId && onEditRegistry ? (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-7 px-2 text-xs"
            onClick={() => onEditRegistry(item.registryId!)}
          >
            <Pencil className="mr-1 h-3 w-3" />
            Edit
          </Button>
        ) : null}
        {item.href ? <TimelineLink href={item.href}>Visit</TimelineLink> : null}
        {item.captureHref ? (
          <TimelineLink href={item.captureHref}>Source capture</TimelineLink>
        ) : null}
        {item.reviewHref ? (
          <TimelineLink href={item.reviewHref}>Source review</TimelineLink>
        ) : null}
      </div>
    </article>
  )
}

export function SubjectAdverseEventsTimeline({
  sections,
  onEditRegistry,
}: SubjectAdverseEventsTimelineProps) {
  const total = sections.reduce((n, s) => n + s.items.length, 0)

  if (total === 0) {
    return (
      <section
        className="rounded-lg border bg-card p-4"
        style={{ borderColor: 'var(--border)' }}
      >
        <h2 className="text-sm font-semibold" style={{ color: 'var(--foreground)' }}>
          AE / Safety timeline
        </h2>
        <p className="mt-2 text-sm" style={{ color: 'var(--muted-foreground)' }}>
          No AE-related operational items for this subject yet. Items appear from source capture
          (AE fields), validation findings, workflow actions, operational events, and documented
          allergies when present.
        </p>
      </section>
    )
  }

  return (
    <div className="space-y-4">
      {sections.map((section) => (
        <section
          key={section.key}
          className="rounded-lg border bg-card p-4"
          style={{ borderColor: 'var(--border)' }}
        >
          <div className="mb-3">
            <h2 className="text-sm font-semibold" style={{ color: 'var(--foreground)' }}>
              {section.title}
              <span className="ml-2 font-normal text-muted-foreground">({section.items.length})</span>
            </h2>
            <p className="text-xs" style={{ color: 'var(--muted-foreground)' }}>
              {section.description}
            </p>
          </div>

          {section.items.length === 0 ? (
            <p className="text-sm text-muted-foreground">None in this section.</p>
          ) : (
            <ol className="relative space-y-0 border-l pl-6" style={{ borderColor: 'var(--border)' }}>
              {section.items.map((item, index) => {
                const isLast = index === section.items.length - 1
                return (
                  <li key={item.id} className={cn('relative pb-5', isLast && 'pb-0')}>
                    <span
                      className="absolute -left-[1.4rem] top-1 h-3 w-3 rounded-full border-2 border-white"
                      style={{
                        backgroundColor:
                          item.lifecycleStatus === 'open' ? 'var(--destructive)' : 'var(--primary)',
                      }}
                      aria-hidden
                    />
                    <AeCard item={item} onEditRegistry={onEditRegistry} />
                  </li>
                )
              })}
            </ol>
          )}
        </section>
      ))}
    </div>
  )
}
