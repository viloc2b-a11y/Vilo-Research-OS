import Link from 'next/link'
import type { CoordinatorVisitAlert } from '@/lib/visits/types'

const alertTone: Record<CoordinatorVisitAlert['alertType'], string> = {
  approaching: 'border-sky-200 bg-sky-50 dark:border-sky-900 dark:bg-sky-950/40',
  reminder_pending: 'border-amber-200 bg-amber-50 dark:border-amber-900 dark:bg-amber-950/40',
  overdue_scheduling: 'border-violet-200 bg-violet-50 dark:border-violet-900 dark:bg-violet-950/40',
  missed: 'border-rose-200 bg-rose-50 dark:border-rose-900 dark:bg-rose-950/40',
  out_of_window: 'border-orange-200 bg-orange-50 dark:border-orange-900 dark:bg-orange-950/40',
}

export function CoordinatorVisitAlertsPanel({ alerts }: { alerts: CoordinatorVisitAlert[] }) {
  if (alerts.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        No visit alerts right now. Upcoming visits, reminders, and window issues appear here.
      </p>
    )
  }

  return (
    <ul className="space-y-2">
      {alerts.map((alert) => (
        <li
          key={alert.id}
          className={`rounded-md border px-3 py-2.5 text-sm ${alertTone[alert.alertType]}`}
        >
          <p>{alert.message}</p>
          <p className="mt-1 text-xs text-muted-foreground">
            <Link href={alert.href} className="font-medium text-primary hover:underline">
              Open subject visits
            </Link>
            {alert.scheduledDate ? ` · ${alert.scheduledDate}` : null}
          </p>
        </li>
      ))}
    </ul>
  )
}
