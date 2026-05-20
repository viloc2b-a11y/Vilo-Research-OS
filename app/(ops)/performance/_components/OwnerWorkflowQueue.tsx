'use client'

import { useMemo, useState } from 'react'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { performanceScopeDescription } from '@/app/(ops)/performance/_lib/performance-risk'
import type {
  CoordinatorLoadItem,
  PerformanceLoadStatus,
} from '@/app/(ops)/performance/_lib/performance-types'
import {
  formatOwnerLabel,
  recommendedNextStepForLoad,
  summarizeBlockedBy,
} from '@/lib/performance/portfolio'

type OwnerWorkflowQueueProps = {
  coordinatorLoad: CoordinatorLoadItem[]
  currentUserId: string | null
  status: PerformanceLoadStatus
  loadFailed: boolean
  selectedStudyName: string | null
}

type OwnerFilter = 'me' | 'all'

export function OwnerWorkflowQueue({
  coordinatorLoad,
  currentUserId,
  status,
  loadFailed,
  selectedStudyName,
}: OwnerWorkflowQueueProps) {
  const [ownerFilter, setOwnerFilter] = useState<OwnerFilter>('me')
  const [expandedUserId, setExpandedUserId] = useState<string | null>(null)

  const rows = useMemo(() => {
    const sorted = [...coordinatorLoad].sort(
      (a, b) => b.overdueItems + b.blockedItems - (a.overdueItems + a.blockedItems),
    )
    if (ownerFilter === 'me' && currentUserId) {
      return sorted.filter((r) => r.userId === currentUserId || r.userId === 'unassigned')
    }
    return sorted
  }, [coordinatorLoad, ownerFilter, currentUserId])

  return (
    <Card>
      <CardHeader>
        <CardTitle>Workflow queue</CardTitle>
        <CardDescription>
          Owner-centric workload — what each person needs to resolve.{' '}
          {performanceScopeDescription(selectedStudyName)}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-wrap gap-2 text-xs">
          <FilterButton
            active={ownerFilter === 'me'}
            onClick={() => setOwnerFilter('me')}
            label="My queue"
          />
          <FilterButton
            active={ownerFilter === 'all'}
            onClick={() => setOwnerFilter('all')}
            label="All owners"
          />
        </div>

        {loadFailed ? (
          <p className="text-sm text-destructive">Workflow queue data is unavailable.</p>
        ) : rows.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            {status === 'empty'
              ? 'No workflow items in scope.'
              : 'No coordinator workload rows match the current filter.'}
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[560px] text-sm">
              <thead>
                <tr className="border-b text-left text-xs text-muted-foreground">
                  <th className="pb-2 pr-4 font-medium">Owner</th>
                  <th className="pb-2 pr-4 font-medium">Due today</th>
                  <th className="pb-2 pr-4 font-medium">Blocked by</th>
                  <th className="pb-2 font-medium">Recommended next step</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <OwnerRow
                    key={row.userId}
                    row={row}
                    expanded={expandedUserId === row.userId}
                    onToggle={() =>
                      setExpandedUserId((id) => (id === row.userId ? null : row.userId))
                    }
                  />
                ))}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

function FilterButton({
  active,
  onClick,
  label,
}: {
  active: boolean
  onClick: () => void
  label: string
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={
        active
          ? 'rounded-md bg-primary px-2.5 py-1 font-medium text-primary-foreground'
          : 'rounded-md border px-2.5 py-1 font-medium text-muted-foreground hover:bg-muted'
      }
    >
      {label}
    </button>
  )
}

function OwnerRow({
  row,
  expanded,
  onToggle,
}: {
  row: CoordinatorLoadItem
  expanded: boolean
  onToggle: () => void
}) {
  return (
    <>
      <tr className="border-b align-top">
        <td className="py-3 pr-4">
          <button
            type="button"
            onClick={onToggle}
            className="font-medium text-left text-primary hover:underline"
          >
            {formatOwnerLabel(row.userId)}
          </button>
          <p className="text-xs text-muted-foreground">{row.assignedItems} assigned</p>
        </td>
        <td className="py-3 pr-4">{row.dueToday}</td>
        <td className="py-3 pr-4 text-muted-foreground">{summarizeBlockedBy(row)}</td>
        <td className="py-3 text-muted-foreground">
          {recommendedNextStepForLoad(row)}
        </td>
      </tr>
      {expanded ? (
        <tr className="border-b bg-muted/30">
          <td colSpan={4} className="px-4 py-3 text-xs text-muted-foreground">
            <ul className="space-y-1">
              <li>Overdue: {row.overdueItems}</li>
              <li>Blocked validations: {row.blockedItems}</li>
              <li>Unassigned queue (org): {row.unassignedQueue}</li>
              <li>
                Last active: {row.lastActiveAt?.slice(0, 10) ?? '—'}
              </li>
            </ul>
          </td>
        </tr>
      ) : null}
    </>
  )
}
