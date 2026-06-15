import type { SupabaseClient } from '@supabase/supabase-js'
import type { ExportRole, ExportReportType, MaskLevel } from './field-mask-policy'

export type ExportAuditEntry = {
  organizationId: string
  studyId?: string | null
  actorId: string | null
  actorRole: ExportRole
  reportType: ExportReportType
  maskLevel: MaskLevel
  recordCount: number
  maskedFields: string[]
  exportFormat?: 'json' | 'csv' | 'pdf'
  metadata?: Record<string, unknown>
}

export async function recordExportAuditEntry(
  supabase: SupabaseClient,
  entry: ExportAuditEntry,
): Promise<void> {
  await supabase.from('export_audit_log').insert({
    organization_id: entry.organizationId,
    study_id: entry.studyId ?? null,
    actor_id: entry.actorId ?? null,
    actor_role: entry.actorRole,
    report_type: entry.reportType,
    mask_level: entry.maskLevel,
    record_count: entry.recordCount,
    masked_fields: entry.maskedFields,
    export_format: entry.exportFormat ?? 'json',
    metadata: entry.metadata ?? {},
  })
}

export type ExportAuditLogRow = {
  id: string
  organizationId: string
  studyId: string | null
  actorId: string | null
  actorRole: string
  reportType: string
  maskLevel: string
  recordCount: number
  maskedFields: string[]
  exportFormat: string
  exportedAt: string
}

export async function loadExportAuditLog(
  supabase: SupabaseClient,
  organizationId: string,
  studyId?: string | null,
  limit = 100,
): Promise<ExportAuditLogRow[]> {
  let query = supabase
    .from('export_audit_log')
    .select('id, organization_id, study_id, actor_id, actor_role, report_type, mask_level, record_count, masked_fields, export_format, exported_at')
    .eq('organization_id', organizationId)
    .order('exported_at', { ascending: false })
    .limit(limit)

  if (studyId) query = query.eq('study_id', studyId)

  const { data, error } = await query
  if (error) return []

  return (data ?? []).map((row) => ({
    id: String(row.id),
    organizationId: String(row.organization_id),
    studyId: row.study_id ? String(row.study_id) : null,
    actorId: row.actor_id ? String(row.actor_id) : null,
    actorRole: String(row.actor_role),
    reportType: String(row.report_type),
    maskLevel: String(row.mask_level),
    recordCount: Number(row.record_count ?? 0),
    maskedFields: Array.isArray(row.masked_fields) ? row.masked_fields.map(String) : [],
    exportFormat: String(row.export_format ?? 'json'),
    exportedAt: String(row.exported_at),
  }))
}
