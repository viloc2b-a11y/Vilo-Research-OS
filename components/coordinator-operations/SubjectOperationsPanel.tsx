import Link from 'next/link'
import type { SubjectOperationsSurface } from '@/lib/coordinator-operations/types'
import { OperationalWorkQueuePanel } from '@/components/coordinator-operations/OperationalWorkQueuePanel'
import { Calendar, FileText, Heart, UserRound } from 'lucide-react'

export function SubjectOperationsPanel({
  surface,
}: {
  surface: SubjectOperationsSurface
}) {
  return (
    <div className="space-y-4">
      <section className="grid gap-3 sm:grid-cols-2">
        <div className="rounded-lg border bg-card p-4">
          <h3 className="flex items-center gap-2 text-sm font-semibold">
            <Calendar className="size-4 text-primary" />
            Current visit
          </h3>
          {surface.currentVisit ? (
            <Link href={surface.currentVisit.href} className="mt-2 block text-sm hover:underline">
              <span className="font-medium">{surface.currentVisit.label}</span>
              <span className="mt-1 block text-xs text-muted-foreground">
                Status: {surface.currentVisit.status}
              </span>
            </Link>
          ) : (
            <p className="mt-2 text-sm text-muted-foreground">
              No active visit. Check the schedule for the next appointment.
            </p>
          )}
        </div>
        <div className="rounded-lg border bg-card p-4">
          <h3 className="flex items-center gap-2 text-sm font-semibold">
            <Calendar className="size-4 text-primary" />
            Next scheduled
          </h3>
          {surface.nextScheduledVisit ? (
            <Link href={surface.nextScheduledVisit.href} className="mt-2 block text-sm hover:underline">
              <span className="font-medium">{surface.nextScheduledVisit.label}</span>
              <span className="mt-1 block text-xs text-muted-foreground">
                {surface.nextScheduledVisit.scheduledDate}
              </span>
            </Link>
          ) : (
            <p className="mt-2 text-sm text-muted-foreground">No upcoming scheduled visit on record.</p>
          )}
        </div>
      </section>

      <section className="rounded-lg border bg-card p-4">
        <h3 className="flex items-center gap-2 text-sm font-semibold">
          <FileText className="size-4 text-primary" />
          Open source items
        </h3>
        {surface.openSourceItems.length === 0 ? (
          <p className="mt-2 text-sm text-muted-foreground">No incomplete source sets for this subject.</p>
        ) : (
          <ul className="mt-2 space-y-2">
            {surface.openSourceItems.map((item) => (
              <li key={item.id}>
                <Link href={item.href} className="block rounded border px-3 py-2 text-sm hover:bg-muted">
                  <span className="font-medium">{item.title}</span>
                  <span className="block text-xs text-muted-foreground">{item.detail}</span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="rounded-lg border bg-card p-4">
        <h3 className="flex items-center gap-2 text-sm font-semibold">
          <Heart className="size-4 text-primary" />
          Safety indicators
        </h3>
        {surface.safetyIndicators.length === 0 ? (
          <p className="mt-2 text-sm text-muted-foreground">No open safety items flagged.</p>
        ) : (
          <ul className="mt-2 space-y-2">
            {surface.safetyIndicators.map((item) => (
              <li key={item.id}>
                {item.href ? (
                  <Link href={item.href} className="block rounded border px-3 py-2 text-sm hover:bg-muted">
                    <span className="font-medium">{item.label}</span>
                    <span className="block text-xs text-muted-foreground">{item.detail}</span>
                  </Link>
                ) : (
                  <div className="rounded border px-3 py-2 text-sm">
                    <span className="font-medium">{item.label}</span>
                    <span className="block text-xs text-muted-foreground">{item.detail}</span>
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="rounded-lg border bg-card p-4">
        <h3 className="flex items-center gap-2 text-sm font-semibold">
          <UserRound className="size-4 text-primary" />
          Clinical profile links
        </h3>
        <ul className="mt-2 flex flex-wrap gap-2">
          {surface.clinicalLinks.map((link) => (
            <li key={link.href}>
              <Link
                href={link.href}
                className="inline-flex rounded-full border px-3 py-1 text-xs font-medium text-primary hover:bg-accent/30"
              >
                {link.label}
              </Link>
            </li>
          ))}
        </ul>
      </section>

      <OperationalWorkQueuePanel buckets={surface.workQueueBuckets} compact />
    </div>
  )
}
