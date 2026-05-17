/**
 * Phase 5.2E — CRC capture shell E2E helpers.
 */

import { assertApiEnvelope, stableFingerprint } from './read-contract-e2e.mjs'
import { readRoutePath } from './read-contract-e2e.mjs'

export { assertApiEnvelope, stableFingerprint, readRoutePath }

const OPEN_RPC = 'open_source_response_set'
const SAVE_RPC = 'save_source_draft'
const SUBMIT_RPC = 'submit_source_response_set'

export function assertCaptureShellViewModel(model, expectations = {}) {
  const issues = []
  if (!model?.responseSetId) issues.push('responseSetId required')
  if (!model?.context?.procedureExecutionId) issues.push('context.procedureExecutionId required')
  if (!model?.context?.organizationId) issues.push('context.organizationId required')
  if (typeof model?.canEdit !== 'boolean') issues.push('canEdit must be boolean')
  if (typeof model?.isSubmitted !== 'boolean') issues.push('isSubmitted must be boolean')
  if (!Array.isArray(model?.fields)) issues.push('fields must be array')
  if (!model?.reviewHref?.includes('/source/response-set/')) {
    issues.push('reviewHref must point to source review route')
  }
  if (!model?.reviewHref?.includes('organization_id=')) {
    issues.push('reviewHref must include organization_id')
  }

  for (const [i, field] of (model?.fields ?? []).entries()) {
    if (!field.fieldId || !field.fieldKey) issues.push(`fields[${i}] missing id/key`)
    if (!['text', 'number', 'date', 'boolean', 'select', 'json'].includes(field.kind)) {
      issues.push(`fields[${i}].kind invalid`)
    }
  }

  if (expectations.canEdit === true && !model?.canEdit) issues.push('expected canEdit=true')
  if (expectations.canEdit === false && model?.canEdit) issues.push('expected canEdit=false')
  if (expectations.isSubmitted === true && !model?.isSubmitted) issues.push('expected isSubmitted=true')
  if (expectations.isSubmitted === false && model?.isSubmitted) issues.push('expected isSubmitted=false')
  if (expectations.minFields != null && (model?.fields?.length ?? 0) < expectations.minFields) {
    issues.push(`expected at least ${expectations.minFields} fields`)
  }

  return issues
}

/**
 * Mirror load-capture-shell view-model assembly from canonical read payloads (no Supabase).
 */
export function buildCaptureShellViewModel({
  procedureExecutionId,
  organizationId,
  responseSetId,
  detailData,
  manifestPanel,
  detailPanel,
  captureFields,
  contextExtras = {},
}) {
  const rs = detailData.response_set
  const manifest = manifestPanel?.status === 'success' ? manifestPanel.data : null
  const isSubmitted = manifest?.isSubmitted ?? rs.status === 'submitted'
  const canEdit = !isSubmitted && rs.status !== 'locked' && rs.status !== 'archived'

  return {
    context: {
      procedureExecutionId,
      organizationId,
      studyId: rs.study_id,
      studyVersionId: rs.study_version_id,
      studySubjectId: rs.study_subject_id,
      visitId: rs.visit_id,
      sourceDefinitionVersionId: rs.source_definition_version_id,
      procedureLabel: contextExtras.procedureLabel ?? 'Procedure',
      visitLabel: contextExtras.visitLabel ?? 'Visit',
      subjectLabel: contextExtras.subjectLabel ?? 'Subject',
      studyName: contextExtras.studyName ?? 'Study',
      visitPath: `/visits/${rs.visit_id}`,
      studyPath: `/studies/${rs.study_id}`,
      subjectPath: `/subjects/${rs.study_subject_id}`,
    },
    responseSetId,
    statusLabel: detailPanel?.status === 'success' ? detailPanel.data.statusLabel : rs.status,
    canEdit,
    isSubmitted,
    openedAtDisplay: null,
    submittedAtDisplay: null,
    manifest,
    fields: captureFields,
    reviewHref: `/source/response-set/${responseSetId}?organization_id=${organizationId}`,
  }
}

export function detailFieldDisplayValue(detailData, fieldId) {
  const row = detailData.fields.find((f) => f.source_field_id === fieldId)
  const v = row?.current_effective?.value
  if (!v) return null
  if (v.value_text != null) return String(v.value_text)
  if (v.value_number != null) return String(v.value_number)
  if (v.value_boolean != null) return v.value_boolean ? 'true' : 'false'
  if (v.value_date != null) return String(v.value_date)
  if (v.value_datetime != null) return String(v.value_datetime)
  if (v.value_json != null) return JSON.stringify(v.value_json)
  return null
}

export function historyHasSubmitEvent(historyData) {
  const kinds = (historyData.events ?? []).map((e) => String(e.event_kind ?? ''))
  return kinds.some(
    (k) =>
      k === 'response_set_submitted' ||
      k === 'SOURCE_RESPONSE_SET_SUBMITTED' ||
      k.includes('submitted'),
  )
}

export function pickPrimaryField(detailData) {
  const fields = detailData.fields ?? []
  const score = (f) => {
    const hint = String(f.widget_hint ?? 'text').toLowerCase()
    let s = 0
    if (f.is_required) s += 10
    if (hint === 'text' || hint.includes('string')) s += 5
    if (hint.includes('number') || hint === 'integer') s += 4
    if (hint === 'date') s += 3
    if (hint === 'boolean' || hint === 'checkbox') s -= 5
    return s
  }
  const sorted = [...fields].sort((a, b) => score(b) - score(a))
  return sorted[0] ?? null
}

export function expectedDisplayForSavedValue(widgetHint, savedValue) {
  const hint = String(widgetHint ?? 'text').toLowerCase()
  if (hint === 'boolean' || hint === 'checkbox') return 'true'
  if (hint.includes('number') || hint === 'integer') return '42'
  if (hint === 'date') return '2026-05-16'
  return savedValue
}

export async function createFreshCaptureProcedure(sql, organizationId) {
  const study = await sql`
    select id from public.studies
    where organization_id = ${organizationId}::uuid
    order by created_at desc
    limit 1
  `
  if (!study[0]?.id) return null

  const sv = await sql`
    select id from public.study_versions
    where study_id = ${study[0].id}::uuid
    order by created_at desc
    limit 1
  `
  const subj = await sql`
    select id from public.study_subjects
    where study_id = ${study[0].id}::uuid
    limit 1
  `
  const vd = await sql`
    select id from public.visit_definitions
    where study_id = ${study[0].id}::uuid
    limit 1
  `
  const pd = await sql`
    select id from public.procedure_definitions
    where study_id = ${study[0].id}::uuid
    limit 1
  `
  const sdv = await sql`
    select id from public.source_definition_versions
    where study_id = ${study[0].id}::uuid and lifecycle_status = 'published'
    order by created_at desc
    limit 1
  `
  if (!sv[0]?.id || !subj[0]?.id || !vd[0]?.id || !pd[0]?.id || !sdv[0]?.id) return null

  const visit = await sql`
    insert into public.visits (
      organization_id, study_id, study_subject_id, visit_definition_id,
      scheduled_date, visit_status
    ) values (
      ${organizationId}::uuid, ${study[0].id}::uuid, ${subj[0].id}::uuid, ${vd[0].id}::uuid,
      current_date + 14, 'scheduled'
    )
    returning id
  `
  const pe = await sql`
    insert into public.procedure_executions (
      organization_id, study_id, visit_id, procedure_definition_id,
      execution_status, source_definition_version_id
    ) values (
      ${organizationId}::uuid, ${study[0].id}::uuid, ${visit[0].id}::uuid, ${pd[0].id}::uuid,
      'pending', ${sdv[0].id}::uuid
    )
    returning id
  `

  return {
    procedureExecutionId: pe[0].id,
    studyId: study[0].id,
    studyVersionId: sv[0].id,
    studySubjectId: subj[0].id,
    visitId: visit[0].id,
    sourceDefinitionVersionId: sdv[0].id,
    existingResponseSetId: null,
    existingSetStatus: null,
    fresh: true,
  }
}

export async function prepareCaptureFixture(sql, organizationId, { fresh = false } = {}) {
  if (fresh) {
    return createFreshCaptureProcedure(sql, organizationId)
  }

  const discovered = await discoverCaptureFixture(sql, organizationId)
  if (discovered?.procedureExecutionId && discovered.studyVersionId) {
    if (discovered.existingSetStatus !== 'submitted' && discovered.existingSetStatus !== 'locked') {
      return discovered
    }
  }

  const pe = await sql`
    select
      pe.id as procedure_execution_id,
      pe.study_id,
      pe.visit_id,
      pe.source_definition_version_id,
      v.study_subject_id
    from public.procedure_executions pe
    join public.visits v on v.id = pe.visit_id
    where pe.organization_id = ${organizationId}::uuid
      and v.visit_status in ('scheduled', 'checked_in', 'in_progress')
      and not exists (
        select 1 from public.source_response_sets srs
        where srs.procedure_execution_id = pe.id
          and srs.status <> 'archived'
      )
    order by pe.created_at desc
    limit 1
  `
  if (!pe[0]) return null

  let sdvId = pe[0].source_definition_version_id
  if (!sdvId) {
    const sdv = await sql`
      select id from public.source_definition_versions
      where study_id = ${pe[0].study_id}::uuid and lifecycle_status = 'published'
      order by created_at desc
      limit 1
    `
    sdvId = sdv[0]?.id
    if (sdvId) {
      await sql`
        update public.procedure_executions
        set source_definition_version_id = ${sdvId}::uuid
        where id = ${pe[0].procedure_execution_id}::uuid
      `
    }
  }

  if (!sdvId) return null

  const sv = await sql`
    select id from public.study_versions
    where study_id = ${pe[0].study_id}::uuid
    order by created_at desc
    limit 1
  `

  const existing = await sql`
    select id, status from public.source_response_sets
    where procedure_execution_id = ${pe[0].procedure_execution_id}::uuid
      and source_definition_version_id = ${sdvId}::uuid
      and status <> 'archived'
    limit 1
  `

  if (
    existing[0]?.status === 'submitted' ||
    existing[0]?.status === 'locked' ||
    existing[0]?.status === 'pending_review'
  ) {
    return null
  }

  return {
    procedureExecutionId: pe[0].procedure_execution_id,
    studyId: pe[0].study_id,
    studyVersionId: sv[0]?.id ?? null,
    studySubjectId: pe[0].study_subject_id,
    visitId: pe[0].visit_id,
    sourceDefinitionVersionId: sdvId,
    existingResponseSetId: existing[0]?.id ?? null,
    existingSetStatus: existing[0]?.status ?? null,
  }
}

export async function discoverCaptureFixture(sql, organizationId) {
  const rows = await sql`
    select
      pe.id as procedure_execution_id,
      pe.study_id,
      pe.visit_id,
      pe.source_definition_version_id,
      v.study_subject_id,
      srs.id as existing_set_id,
      srs.status as existing_set_status
    from public.procedure_executions pe
    join public.visits v on v.id = pe.visit_id
    left join public.source_response_sets srs
      on srs.procedure_execution_id = pe.id
      and srs.source_definition_version_id = pe.source_definition_version_id
      and srs.status <> 'archived'
    where pe.organization_id = ${organizationId}::uuid
      and pe.source_definition_version_id is not null
      and (srs.id is null or srs.status in ('draft', 'in_progress', 'opened'))
    order by srs.id nulls first, pe.created_at desc
    limit 1
  `
  if (!rows[0]) return null

  const sv = await sql`
    select id from public.study_versions
    where study_id = ${rows[0].study_id}::uuid
    order by created_at desc
    limit 1
  `

  return {
    procedureExecutionId: rows[0].procedure_execution_id,
    studyId: rows[0].study_id,
    studyVersionId: sv[0]?.id ?? null,
    studySubjectId: rows[0].study_subject_id,
    visitId: rows[0].visit_id,
    sourceDefinitionVersionId: rows[0].source_definition_version_id,
    existingResponseSetId: rows[0].existing_set_id ?? null,
    existingSetStatus: rows[0].existing_set_status ?? null,
  }
}

export function runCaptureUnitValidations(modules) {
  const results = []
  const { parseCaptureFormToResponses, normalizeCaptureFields, resolveCaptureFieldKind } =
    modules

  function record(id, issues) {
    results.push({ id, ok: issues.length === 0, issues })
  }

  const badJsonField = {
    fieldId: '00000000-0000-4000-8000-000000000099',
    fieldKey: 'test.json',
    label: 'test.json',
    kind: 'json',
    isRequired: true,
    options: [],
    value: {},
  }
  const fdBad = new FormData()
  fdBad.set('field_00000000-0000-4000-8000-000000000099', '{not-json')
  const badParse = parseCaptureFormToResponses(fdBad, [badJsonField])
  record('parse_form_invalid_json', badParse.ok ? ['expected parse failure'] : [])

  const textField = {
    fieldId: '00000000-0000-4000-8000-000000000088',
    fieldKey: 'test.text',
    label: 'test.text',
    kind: 'text',
    isRequired: true,
    options: [],
    value: {},
  }
  const fdOk = new FormData()
  fdOk.set('field_00000000-0000-4000-8000-000000000088', 'e2e-value')
  const okParse = parseCaptureFormToResponses(fdOk, [textField])
  record('parse_form_valid_text', okParse.ok ? [] : ['expected parse success'])

  record('resolve_widget_kinds', [
    ...(resolveCaptureFieldKind('integer', []) === 'number' ? [] : ['integer→number']),
    ...(resolveCaptureFieldKind('boolean', []) === 'boolean' ? [] : ['boolean']),
    ...(resolveCaptureFieldKind('unknown', ['a']) === 'select' ? [] : ['options→select']),
  ])

  const syntheticDetail = {
    response_set: {
      id: '00000000-0000-4000-8000-000000000001',
      organization_id: '00000000-0000-4000-8000-000000000010',
      study_id: '00000000-0000-4000-8000-000000000020',
      study_version_id: null,
      study_subject_id: '00000000-0000-4000-8000-000000000030',
      visit_id: '00000000-0000-4000-8000-000000000040',
      procedure_execution_id: '00000000-0000-4000-8000-000000000050',
      source_definition_version_id: '00000000-0000-4000-8000-000000000060',
      status: 'draft',
      source_origin: 'e2e',
      opened_by_user_id: '00000000-0000-4000-8000-000000000070',
      opened_at: '2026-05-01T10:00:00Z',
      submitted_by_user_id: null,
      submitted_at: null,
      reviewed_by_user_id: null,
      reviewed_at: null,
      signed_by_user_id: null,
      signed_at: null,
      locked_by_user_id: null,
      locked_at: null,
      created_at: '2026-05-01T10:00:00Z',
      updated_at: '2026-05-01T10:00:00Z',
    },
    fields: [
      {
        source_field_id: '00000000-0000-4000-8000-000000000081',
        field_key: 'vitals.bp',
        widget_hint: 'text',
        is_required: true,
        current_effective: {
          response_id: '00000000-0000-4000-8000-000000000091',
          response_sequence: 1,
          is_submitted: false,
          captured_at: '2026-05-01T10:30:00Z',
          submitted_at: null,
          originator_user_id: '00000000-0000-4000-8000-000000000070',
          originator_role: 'CRC',
          supersedes_response_id: null,
          value: { value_text: '120/80' },
        },
        history: [],
      },
    ],
    corrections: [],
    addenda: [],
    findings_summary: {
      active: [],
      counts: { total: 0, open: 0, acknowledged: 0, resolved: 0, waived: 0, severity: { info: 0, warning: 0, error: 0 } },
    },
    placeholders: {},
    lineage: {
      immutable_append_only: true,
      history_rpc: 'get_source_response_set_history',
      chronology_ref: {
        organization_id: '00000000-0000-4000-8000-000000000010',
        source_response_set_id: '00000000-0000-4000-8000-000000000001',
      },
    },
  }

  const fields = normalizeCaptureFields(syntheticDetail, {})
  const shell = buildCaptureShellViewModel({
    procedureExecutionId: '00000000-0000-4000-8000-000000000050',
    organizationId: '00000000-0000-4000-8000-000000000010',
    responseSetId: '00000000-0000-4000-8000-000000000001',
    detailData: syntheticDetail,
    manifestPanel: {
      status: 'success',
      data: {
        statusLabel: 'draft',
        completenessLabel: '0 / 1',
        isSubmitted: false,
        headlineStats: [],
        countStats: [],
      },
    },
    detailPanel: {
      status: 'success',
      data: {
        statusLabel: 'draft',
        metadataRows: [],
        fields: [],
        corrections: [],
        addenda: [],
        fieldCount: 1,
      },
    },
    captureFields: fields,
  })
  record('shell_before_submit', [
    ...assertCaptureShellViewModel(shell, { canEdit: true, isSubmitted: false, minFields: 1 }),
  ])

  const submittedDetail = structuredClone(syntheticDetail)
  submittedDetail.response_set.status = 'submitted'
  const shellAfter = buildCaptureShellViewModel({
    procedureExecutionId: '00000000-0000-4000-8000-000000000050',
    organizationId: '00000000-0000-4000-8000-000000000010',
    responseSetId: '00000000-0000-4000-8000-000000000001',
    detailData: submittedDetail,
    manifestPanel: {
      status: 'success',
      data: {
        statusLabel: 'submitted',
        completenessLabel: '1 / 1',
        isSubmitted: true,
        headlineStats: [],
        countStats: [],
      },
    },
    detailPanel: { status: 'success', data: { statusLabel: 'submitted', metadataRows: [], fields: [], corrections: [], addenda: [], fieldCount: 1 } },
    captureFields: fields,
  })
  record('shell_after_submit', [
    ...assertCaptureShellViewModel(shellAfter, { canEdit: false, isSubmitted: true }),
  ])

  return results
}

export const WRITE_RPC = { OPEN_RPC, SAVE_RPC, SUBMIT_RPC }
