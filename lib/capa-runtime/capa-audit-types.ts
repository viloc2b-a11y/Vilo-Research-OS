export type CapaAuditEvent = {
  id: string
  organizationId: string
  capaId: string
  fromStatus: string
  toStatus: string
  changedBy: string
  changedAt: string
  note: string | null
}

export function mapCapaAuditEventRow(row: Record<string, unknown>): CapaAuditEvent {
  return {
    id: String(row.id),
    organizationId: String(row.organization_id),
    capaId: String(row.capa_id),
    fromStatus: String(row.from_status),
    toStatus: String(row.to_status),
    changedBy: String(row.changed_by),
    changedAt: String(row.changed_at),
    note: row.note != null ? String(row.note) : null,
  }
}
