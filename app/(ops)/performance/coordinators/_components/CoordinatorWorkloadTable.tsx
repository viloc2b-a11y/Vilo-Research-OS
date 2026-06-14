import type { CoordinatorWorkload, CoordinatorWorkloadTier } from '@/lib/performance/portfolio/compute-coordinator-workload'
import { cn } from '@/lib/utils'

type CoordinatorRow = CoordinatorWorkload & {
  displayName: string | null
  email: string | null
}

type CoordinatorWorkloadTableProps = {
  rows: CoordinatorRow[]
}

function scoreCellClass(tier: CoordinatorWorkloadTier): string {
  switch (tier) {
    case 'overloaded':
      return 'bg-destructive/10 text-destructive font-semibold'
    case 'busy':
      return 'bg-orange-100 text-orange-700 font-semibold dark:bg-orange-950 dark:text-orange-400'
    case 'normal':
      return 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-400'
    case 'light':
      return 'text-muted-foreground'
  }
}

function tierLabel(tier: CoordinatorWorkloadTier): string {
  switch (tier) {
    case 'overloaded':
      return 'Overloaded'
    case 'busy':
      return 'Busy'
    case 'normal':
      return 'Normal'
    case 'light':
      return 'Light'
  }
}

function coordinatorLabel(row: CoordinatorRow): string {
  if (row.displayName) return row.displayName
  if (row.email) return row.email
  return row.coordinatorId.replace(/-/g, '').slice(0, 8)
}

export function CoordinatorWorkloadTable({ rows }: CoordinatorWorkloadTableProps) {
  if (rows.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        No coordinators found for this organization.
      </p>
    )
  }

  return (
    <div className="overflow-x-auto rounded-lg border bg-card">
      <table className="w-full min-w-[640px] text-sm">
        <thead>
          <tr className="border-b text-left text-xs text-muted-foreground">
            <th className="px-4 py-3 font-medium">Coordinator</th>
            <th className="px-4 py-3 font-medium text-right">Subjects</th>
            <th className="px-4 py-3 font-medium text-right">Active Visits</th>
            <th className="px-4 py-3 font-medium text-right">Overdue Source</th>
            <th className="px-4 py-3 font-medium text-right">Findings</th>
            <th className="px-4 py-3 font-medium text-right">Queries</th>
            <th className="px-4 py-3 font-medium text-right">Workload Score</th>
            <th className="px-4 py-3 font-medium">Tier</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.coordinatorId} className="border-b last:border-0">
              <td className="px-4 py-3 font-medium text-foreground">
                {coordinatorLabel(row)}
              </td>
              <td className="px-4 py-3 text-right text-muted-foreground">
                {row.assignedSubjectCount}
              </td>
              <td className="px-4 py-3 text-right text-muted-foreground">
                {row.activeVisitCount}
              </td>
              <td className="px-4 py-3 text-right text-muted-foreground">
                {row.overdueSourceCount}
              </td>
              <td className="px-4 py-3 text-right text-muted-foreground">
                {row.openFindingsCount}
              </td>
              <td className="px-4 py-3 text-right text-muted-foreground">
                {row.openQueriesCount}
              </td>
              <td className="px-4 py-3 text-right">
                <span
                  className={cn(
                    'inline-block rounded px-2 py-0.5 tabular-nums',
                    scoreCellClass(row.tier),
                  )}
                >
                  {row.workloadScore}
                </span>
              </td>
              <td className="px-4 py-3 text-muted-foreground">
                {tierLabel(row.tier)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
