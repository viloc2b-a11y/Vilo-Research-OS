import type { CoordinatorWorkload, CoordinatorWorkloadTier } from '@/lib/performance/portfolio/compute-coordinator-workload'
import type { CoordinatorRecruitmentStats } from '@/lib/crm/coordinator-recruitment-stats'
import { cn } from '@/lib/utils'

type CoordinatorRow = CoordinatorWorkload & {
  displayName: string | null
  email: string | null
  recruitment?: CoordinatorRecruitmentStats
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
      <table className="w-full min-w-[960px] text-sm">
        <thead>
          {/* Section group headers */}
          <tr className="border-b text-xs text-muted-foreground">
            <th className="px-4 py-2" />
            <th
              colSpan={7}
              className="px-4 py-2 text-center font-semibold text-foreground border-r"
            >
              Clinical Workload
            </th>
            <th
              colSpan={5}
              className="px-4 py-2 text-center font-semibold text-foreground"
            >
              Recruitment (30d)
            </th>
          </tr>
          {/* Column headers */}
          <tr className="border-b text-left text-xs text-muted-foreground">
            <th className="px-4 py-3 font-medium">Coordinator</th>
            <th className="px-4 py-3 font-medium text-right">Subjects</th>
            <th className="px-4 py-3 font-medium text-right">Active Visits</th>
            <th className="px-4 py-3 font-medium text-right">Overdue Source</th>
            <th className="px-4 py-3 font-medium text-right">Findings</th>
            <th className="px-4 py-3 font-medium text-right">Queries</th>
            <th className="px-4 py-3 font-medium text-right">Workload Score</th>
            <th className="px-4 py-3 font-medium border-r">Tier</th>
            {/* Recruitment columns */}
            <th className="px-4 py-3 font-medium text-right">Assigned Leads</th>
            <th className="px-4 py-3 font-medium text-right">Leads Advanced</th>
            <th className="px-4 py-3 font-medium text-right">Contact Attempts</th>
            <th className="px-4 py-3 font-medium text-right">Qualified</th>
            <th className="px-4 py-3 font-medium text-right">Conversion %</th>
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
              <td className="px-4 py-3 text-muted-foreground border-r">
                {tierLabel(row.tier)}
              </td>
              {/* Recruitment columns */}
              <td className="px-4 py-3 text-right text-muted-foreground">
                {row.recruitment?.leads_assigned ?? '—'}
              </td>
              <td className="px-4 py-3 text-right text-muted-foreground">
                {row.recruitment?.leads_advanced_in_period ?? '—'}
              </td>
              <td className="px-4 py-3 text-right text-muted-foreground">
                {row.recruitment?.contact_attempts_in_period ?? '—'}
              </td>
              <td className="px-4 py-3 text-right text-muted-foreground">
                {row.recruitment?.qualified_in_period ?? '—'}
              </td>
              <td className="px-4 py-3 text-right text-muted-foreground">
                {row.recruitment != null && row.recruitment.leads_assigned > 0
                  ? `${(row.recruitment.conversion_rate * 100).toFixed(1)}%`
                  : '—'}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
