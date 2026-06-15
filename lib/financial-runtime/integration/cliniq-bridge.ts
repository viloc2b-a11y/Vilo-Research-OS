import type { SupabaseClient } from '@supabase/supabase-js'
import type { RevenueLeakageItem } from '@/lib/financial-runtime/types'

export type SoaBillableRow = {
  id: string
  studyId: string
  visitName: string
  activityId: string
  activityType: string
  quantity: number
  unitCost: number
  billableTo: string
  status: string
  triggeredAt: string | null
  createdAt: string
}

export type SoaBillableSummary = {
  pendingCount: number
  pendingAmount: number
  triggeredCount: number
}

function mapRow(row: Record<string, unknown>): SoaBillableRow {
  return {
    id: String(row.id),
    studyId: String(row.study_id),
    visitName: String(row.visit_name),
    activityId: String(row.activity_id),
    activityType: String(row.activity_type),
    quantity: Number(row.quantity ?? 0),
    unitCost: Number(row.unit_cost ?? 0),
    billableTo: String(row.billable_to),
    status: String(row.status ?? 'pending'),
    triggeredAt: row.triggered_at ? String(row.triggered_at) : null,
    createdAt: String(row.created_at),
  }
}

export async function loadPendingSoaBillables(
  supabase: SupabaseClient,
  studyId: string,
): Promise<SoaBillableRow[]> {
  const { data, error } = await supabase
    .from('expected_billables')
    .select('id, study_id, visit_name, activity_id, activity_type, quantity, unit_cost, billable_to, status, triggered_at, created_at')
    .eq('study_id', studyId)
    .eq('status', 'pending')
    .order('created_at', { ascending: true })
    .limit(200)

  if (error) return []
  return (data ?? []).map((row) => mapRow(row as Record<string, unknown>))
}

export async function triggerSoaBillable(
  supabase: SupabaseClient,
  billableId: string,
): Promise<void> {
  await supabase
    .from('expected_billables')
    .update({ status: 'triggered', triggered_at: new Date().toISOString() })
    .eq('id', billableId)
}

export function summarizeSoaBillables(rows: SoaBillableRow[]): SoaBillableSummary {
  let pendingCount = 0
  let pendingAmount = 0
  let triggeredCount = 0

  for (const row of rows) {
    if (row.status === 'pending') {
      pendingCount++
      pendingAmount += row.quantity * row.unitCost
    } else if (row.status === 'triggered') {
      triggeredCount++
    }
  }

  return { pendingCount, pendingAmount, triggeredCount }
}

export function soaBillablesToLeakageItems(rows: SoaBillableRow[]): RevenueLeakageItem[] {
  return rows.map((row) => ({
    id: `soa:${row.id}`,
    kind: 'soa_billable_pending' as const,
    severity: 'warning' as const,
    label: 'SoA billable pending trigger',
    detail: `${row.visitName} / ${row.activityType} (${row.activityId}) — ${row.quantity} × $${row.unitCost.toFixed(2)} billable to ${row.billableTo}`,
    estimatedBillableUnits: Math.round(row.quantity),
  }))
}
