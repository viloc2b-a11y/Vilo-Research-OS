import type { SupabaseClient } from '@supabase/supabase-js'

export type IpCaptureStatus = 'not_required' | 'required' | 'documented' | 'incomplete'

export type VisitIpCaptureSummary = {
  status: IpCaptureStatus
  requiredFieldCount: number
  documentedFieldCount: number
  procedureCount: number
}

type ProcedureRow = {
  id: string
  visit_id: string
  source_definition_version_id: string | null
}

type SourceFieldRow = {
  id: string
  source_definition_version_id: string
  field_key: string | null
  label: string | null
  is_required: boolean | null
}

type SourceResponseRow = {
  procedure_execution_id: string
  source_field_id: string
  value_text: string | null
  value_number: number | null
  value_boolean: boolean | null
  value_date: string | null
  value_datetime: string | null
  value_json: unknown
}

const EMPTY_SUMMARY: VisitIpCaptureSummary = {
  status: 'not_required',
  requiredFieldCount: 0,
  documentedFieldCount: 0,
  procedureCount: 0,
}

function isIpField(field: Pick<SourceFieldRow, 'field_key' | 'label'>) {
  const key = field.field_key?.toLowerCase() ?? ''
  const label = field.label?.toLowerCase() ?? ''
  return (
    key.startsWith('ip_') ||
    key.includes('_ip_') ||
    key.endsWith('_ip') ||
    key.includes('investigational_product') ||
    key.includes('kit_number') ||
    key.includes('kit_id') ||
    /\bip\b/.test(label) ||
    label.includes('investigational product')
  )
}

function hasCapturedValue(response: SourceResponseRow) {
  return (
    (typeof response.value_text === 'string' && response.value_text.trim().length > 0) ||
    response.value_number !== null ||
    response.value_boolean !== null ||
    response.value_date !== null ||
    response.value_datetime !== null ||
    response.value_json !== null
  )
}

export async function loadIpCaptureStatusByVisit(
  supabase: SupabaseClient,
  visitIds: string[],
  organizationId: string,
): Promise<Map<string, VisitIpCaptureSummary>> {
  const summaries = new Map<string, VisitIpCaptureSummary>()
  const uniqueVisitIds = [...new Set(visitIds.filter(Boolean))]
  for (const visitId of uniqueVisitIds) {
    summaries.set(visitId, EMPTY_SUMMARY)
  }
  if (uniqueVisitIds.length === 0) return summaries

  const { data: procedureData } = await supabase
    .from('procedure_executions')
    .select('id, visit_id, source_definition_version_id')
    .eq('organization_id', organizationId)
    .in('visit_id', uniqueVisitIds)

  const procedures = (procedureData ?? []) as ProcedureRow[]
  const sdvIds = [
    ...new Set(
      procedures
        .map((procedure) => procedure.source_definition_version_id)
        .filter((value): value is string => Boolean(value)),
    ),
  ]

  if (sdvIds.length === 0) return summaries

  const { data: fieldData } = await supabase
    .from('source_fields')
    .select('id, source_definition_version_id, field_key, label, is_required')
    .eq('organization_id', organizationId)
    .in('source_definition_version_id', sdvIds)

  const ipFields = ((fieldData ?? []) as SourceFieldRow[]).filter(isIpField)
  if (ipFields.length === 0) return summaries

  const ipFieldsBySdv = new Map<string, SourceFieldRow[]>()
  for (const field of ipFields) {
    const rows = ipFieldsBySdv.get(field.source_definition_version_id) ?? []
    rows.push(field)
    ipFieldsBySdv.set(field.source_definition_version_id, rows)
  }

  const ipFieldIds = ipFields.map((field) => field.id)
  const procedureIds = procedures.map((procedure) => procedure.id)
  const documented = new Set<string>()

  if (procedureIds.length > 0 && ipFieldIds.length > 0) {
    const { data: responseData } = await supabase
      .from('source_responses')
      .select(`
        procedure_execution_id,
        source_field_id,
        value_text,
        value_number,
        value_boolean,
        value_date,
        value_datetime,
        value_json
      `)
      .eq('organization_id', organizationId)
      .eq('is_current', true)
      .in('procedure_execution_id', procedureIds)
      .in('source_field_id', ipFieldIds)

    for (const response of (responseData ?? []) as SourceResponseRow[]) {
      if (hasCapturedValue(response)) {
        documented.add(`${response.procedure_execution_id}:${response.source_field_id}`)
      }
    }
  }

  for (const visitId of uniqueVisitIds) {
    const visitProcedures = procedures.filter((procedure) => procedure.visit_id === visitId)
    let requiredFieldCount = 0
    let documentedFieldCount = 0
    let ipProcedureCount = 0
    let ipFieldCount = 0

    for (const procedure of visitProcedures) {
      const fields = procedure.source_definition_version_id
        ? ipFieldsBySdv.get(procedure.source_definition_version_id) ?? []
        : []
      if (fields.length === 0) continue
      ipProcedureCount += 1
      ipFieldCount += fields.length
      const requiredFields = fields.filter((field) => field.is_required)
      const fieldsToCheck = requiredFields.length > 0 ? requiredFields : fields
      requiredFieldCount += fieldsToCheck.length
      documentedFieldCount += fieldsToCheck.filter((field) =>
        documented.has(`${procedure.id}:${field.id}`),
      ).length
    }

    if (ipFieldCount === 0) {
      summaries.set(visitId, EMPTY_SUMMARY)
      continue
    }

    const status: IpCaptureStatus =
      requiredFieldCount > 0 && documentedFieldCount >= requiredFieldCount
        ? 'documented'
        : documentedFieldCount > 0
          ? 'incomplete'
          : 'required'

    summaries.set(visitId, {
      status,
      requiredFieldCount,
      documentedFieldCount,
      procedureCount: ipProcedureCount,
    })
  }

  return summaries
}
