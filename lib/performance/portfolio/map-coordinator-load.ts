import type { VpiCoordinatorLoadRow } from '@/lib/performance/read-layer/rpc-dashboard'
import type { CoordinatorLoadItem } from '@/app/(ops)/performance/_lib/performance-types'

export function mapCoordinatorLoadRows(rows: VpiCoordinatorLoadRow[]): CoordinatorLoadItem[] {
  return rows.map((row) => ({
    userId: row.user_id,
    assignedItems: row.assigned_items,
    overdueItems: row.overdue_items,
    blockedItems: row.blocked_items,
    dueToday: row.due_today,
    unassignedQueue: row.unassigned_queue,
    lastActiveAt: row.last_active_at,
  }))
}

export function formatOwnerLabel(userId: string): string {
  if (userId === 'unassigned') return 'Unassigned'
  const short = userId.replace(/-/g, '').slice(0, 8)
  return `Owner ${short}`
}

export function summarizeBlockedBy(item: CoordinatorLoadItem): string {
  const parts: string[] = []
  if (item.blockedItems > 0) parts.push(`${item.blockedItems} blocked validation`)
  if (item.overdueItems > 0) parts.push(`${item.overdueItems} overdue`)
  if (item.dueToday > 0 && parts.length < 2) {
    parts.push(`${item.dueToday} due today`)
  }
  return parts.length > 0 ? parts.slice(0, 2).join(' · ') : '—'
}

export function recommendedNextStepForLoad(item: CoordinatorLoadItem): string {
  if (item.blockedItems > 0) return 'Resolve blocked validation'
  if (item.overdueItems > 0) return 'Review open query'
  if (item.dueToday > 0) return 'Contact subject today'
  if (item.unassignedQueue > 0) return 'Triage assignment'
  return 'Triage assignment'
}
