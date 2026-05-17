/**
 * Phase 5.2C — Read contract validation helpers (envelope, view-model, determinism, render safety).
 */

import { assertApiEnvelope, stepRecord } from './source-api-e2e.mjs'

export { assertApiEnvelope, stepRecord }

const READ_RPC_BY_ROUTE = {
  detail: 'get_source_response_set',
  manifest: 'get_source_response_set_manifest',
  history: 'get_source_response_set_history',
  findings: 'list_source_response_set_findings',
}

export function readRoutePath(responseSetId, kind, organizationId, findingsQuery = {}) {
  const base = `/api/source/response-set/${responseSetId}`
  const params = new URLSearchParams({ organization_id: organizationId })
  if (kind === 'findings') {
    if (findingsQuery.active_only) params.set('active_only', 'true')
    if (findingsQuery.status) params.set('status', findingsQuery.status)
    if (findingsQuery.severity) params.set('severity', findingsQuery.severity)
  }
  const suffix =
    kind === 'detail' ? '' : kind === 'manifest' ? '/manifest' : kind === 'history' ? '/history' : '/findings'
  return `${base}${suffix}?${params.toString()}`
}

export function assertReadApiEnvelope(body, kind, options = {}) {
  return assertApiEnvelope(body, {
    expectedRpc: READ_RPC_BY_ROUTE[kind],
    requireOk: options.requireOk ?? false,
  })
}

export function stableFingerprint(value) {
  return JSON.stringify(value)
}

function collectStrings(value, path, out) {
  if (value === undefined) {
    out.push({ path, issue: 'undefined' })
    return
  }
  if (value === null) return
  if (typeof value === 'string') {
    if (value.includes('undefined')) out.push({ path, issue: 'string contains undefined token' })
    return
  }
  if (Array.isArray(value)) {
    value.forEach((item, i) => collectStrings(item, `${path}[${i}]`, out))
    return
  }
  if (typeof value === 'object') {
    for (const [k, v] of Object.entries(value)) {
      collectStrings(v, path ? `${path}.${k}` : k, out)
    }
  }
}

export function assertNoUndefinedDisplayValues(vm, label) {
  const issues = []
  collectStrings(vm, label, issues)
  return issues
}

export function assertDetailViewModel(vm) {
  const issues = []
  if (!vm || typeof vm !== 'object') return ['detail view-model missing']
  if (typeof vm.statusLabel !== 'string' || !vm.statusLabel) issues.push('statusLabel required')
  if (!Array.isArray(vm.metadataRows) || vm.metadataRows.length === 0) {
    issues.push('metadataRows must be non-empty')
  }
  if (!Array.isArray(vm.fields)) issues.push('fields must be array')
  for (const [i, field] of (vm.fields ?? []).entries()) {
    if (typeof field.displayValue !== 'string') issues.push(`fields[${i}].displayValue must be string`)
    if (!Array.isArray(field.historyVersions)) issues.push(`fields[${i}].historyVersions must be array`)
  }
  if (!Array.isArray(vm.corrections)) issues.push('corrections must be array')
  if (!Array.isArray(vm.addenda)) issues.push('addenda must be array')
  if (typeof vm.fieldCount !== 'number') issues.push('fieldCount must be number')
  issues.push(...assertNoUndefinedDisplayValues(vm, 'detail'))
  return issues
}

export function assertManifestViewModel(vm) {
  const issues = []
  if (!vm || typeof vm !== 'object') return ['manifest view-model missing']
  if (!Array.isArray(vm.headlineStats) || vm.headlineStats.length === 0) {
    issues.push('headlineStats must be non-empty')
  }
  if (!Array.isArray(vm.countStats) || vm.countStats.length === 0) {
    issues.push('countStats must be non-empty')
  }
  for (const stat of [...(vm.headlineStats ?? []), ...(vm.countStats ?? [])]) {
    if (typeof stat?.label !== 'string' || typeof stat?.value !== 'string') {
      issues.push('manifest stat label/value must be strings')
    }
  }
  issues.push(...assertNoUndefinedDisplayValues(vm, 'manifest'))
  return issues
}

export function assertHistoryViewModel(vm, rawEvents = []) {
  const issues = []
  if (!vm || typeof vm !== 'object') return ['history view-model missing']
  if (!Array.isArray(vm.events)) issues.push('events must be array')
  if (typeof vm.eventCount !== 'number') issues.push('eventCount must be number')
  if (typeof vm.emptyMessage !== 'string') issues.push('emptyMessage must be string')

  for (const [i, evt] of (vm.events ?? []).entries()) {
    for (const key of ['occurredAtDisplay', 'kindLabel']) {
      if (typeof evt[key] !== 'string') issues.push(`events[${i}].${key} must be string`)
    }
    if (evt.actorDisplay !== null && typeof evt.actorDisplay !== 'string') {
      issues.push(`events[${i}].actorDisplay must be string or null`)
    }
    if (evt.payloadDisplay !== null && typeof evt.payloadDisplay !== 'string') {
      issues.push(`events[${i}].payloadDisplay must be string or null`)
    }
  }

  if (Array.isArray(rawEvents) && rawEvents.length > 0 && vm.events?.length === rawEvents.length) {
    const rawOrder = rawEvents.map((e) => `${e.occurred_at}|${e.event_kind}`)
    const normOrder = vm.events.map((e, i) => {
      const raw = rawEvents[i]
      return `${raw?.occurred_at}|${raw?.event_kind}`
    })
    if (rawOrder.join('>') !== normOrder.join('>')) {
      issues.push('history event order diverged from API payload')
    }
  }

  issues.push(...assertNoUndefinedDisplayValues(vm, 'history'))
  return issues
}

export function assertFindingsViewModel(vm, rawFindings = []) {
  const issues = []
  if (!vm || typeof vm !== 'object') return ['findings view-model missing']
  if (typeof vm.summaryLabel !== 'string') issues.push('summaryLabel required')
  if (!vm.filters || !Array.isArray(vm.filters.statusLinks) || !Array.isArray(vm.filters.severityLinks)) {
    issues.push('filters.statusLinks and filters.severityLinks required')
  }
  if (!Array.isArray(vm.findings)) issues.push('findings must be array')

  for (const [i, f] of (vm.findings ?? []).entries()) {
    if (!Array.isArray(f.timeline)) issues.push(`findings[${i}].timeline must be array`)
    const raw = rawFindings[i]
    if (raw?.lifecycle_events?.length && f.timeline?.length === raw.lifecycle_events.length) {
      const rawIds = raw.lifecycle_events.map((e) => e.event_id).join('>')
      const normIds = f.timeline.map((t) => t.id).join('>')
      if (rawIds !== normIds) issues.push(`findings[${i}] lifecycle order diverged`)
    }
    if (!['info', 'warning', 'error'].includes(f.severityTone)) {
      issues.push(`findings[${i}].severityTone invalid`)
    }
    if (typeof f.severityLabel !== 'string' || typeof f.statusLabel !== 'string') {
      issues.push(`findings[${i}] labels must be strings`)
    }
  }

  issues.push(...assertNoUndefinedDisplayValues(vm, 'findings'))
  return issues
}

export function assertBundleViewModel(bundle) {
  const issues = []
  if (!bundle?.responseSetId || !bundle?.organizationId) {
    issues.push('bundle responseSetId and organizationId required')
  }
  for (const panel of ['detail', 'manifest', 'history', 'findings']) {
    const result = bundle[panel]
    if (!result || (result.status !== 'success' && result.status !== 'error')) {
      issues.push(`bundle.${panel} must be ReadPanelResult`)
    }
  }
  return issues
}

export function assertReadPanelError(err) {
  const issues = []
  if (!err || typeof err !== 'object') return ['ReadPanelError missing']
  for (const key of ['code', 'title', 'messages', 'isAuthError', 'isForbidden']) {
    if (!(key in err)) issues.push(`ReadPanelError.${key} missing`)
  }
  if (!Array.isArray(err.messages) || err.messages.length === 0) issues.push('messages must be non-empty')
  if (err.requestId !== null && typeof err.requestId !== 'string') {
    issues.push('requestId must be string or null')
  }
  return issues
}

export function assertReadPanelErrorCardConsumable(err) {
  const issues = assertReadPanelError(err)
  for (const msg of err?.messages ?? []) {
    if (typeof msg !== 'string') issues.push('each message must be string for UI card')
  }
  return issues
}

export function assertInputUnchanged(beforeJson, afterJson) {
  return beforeJson === afterJson ? [] : ['normalizer mutated input payload']
}

export function assertFormatRenderSafety(format) {
  const issues = []
  const { EMPTY_DISPLAY, formatTimestamp, formatValuePayload, formatStructuredPayload, severityTone, severityTextClass } =
    format

  if (formatTimestamp(null) !== EMPTY_DISPLAY) issues.push('formatTimestamp(null) should be EMPTY_DISPLAY')
  if (formatValuePayload(null) !== EMPTY_DISPLAY) issues.push('formatValuePayload(null) should be EMPTY_DISPLAY')
  if (formatStructuredPayload(undefined) !== EMPTY_DISPLAY) {
    issues.push('formatStructuredPayload(undefined) should be EMPTY_DISPLAY')
  }

  const ts = formatTimestamp('2026-05-16T12:00:00Z')
  if (typeof ts !== 'string' || !ts) issues.push('formatTimestamp must return non-empty string')

  const structured = formatStructuredPayload({ a: 1, b: 2 })
  if (typeof structured !== 'string' || !structured.includes('"a"')) {
    issues.push('formatStructuredPayload must stringify objects')
  }

  for (const sev of ['info', 'warning', 'error', 'unknown']) {
    const tone = severityTone(sev)
    const cls = severityTextClass(tone)
    if (typeof cls !== 'string' || !cls) issues.push(`severityTextClass(${tone}) must be string`)
  }

  return issues
}

/** Minimal synthetic API payloads for planning-mode unit validation. */
export const SYNTHETIC_READ_PAYLOADS = {
  detail: {
    response_set: {
      id: '00000000-0000-4000-8000-000000000001',
      organization_id: '00000000-0000-4000-8000-000000000010',
      study_id: '00000000-0000-4000-8000-000000000020',
      study_version_id: null,
      study_subject_id: '00000000-0000-4000-8000-000000000030',
      visit_id: '00000000-0000-4000-8000-000000000040',
      procedure_execution_id: '00000000-0000-4000-8000-000000000050',
      source_definition_version_id: '00000000-0000-4000-8000-000000000060',
      status: 'submitted',
      source_origin: 'e2e',
      opened_by_user_id: '00000000-0000-4000-8000-000000000070',
      opened_at: '2026-05-01T10:00:00Z',
      submitted_by_user_id: '00000000-0000-4000-8000-000000000070',
      submitted_at: '2026-05-01T11:00:00Z',
      reviewed_by_user_id: null,
      reviewed_at: null,
      signed_by_user_id: null,
      signed_at: null,
      locked_by_user_id: null,
      locked_at: null,
      created_at: '2026-05-01T10:00:00Z',
      updated_at: '2026-05-01T11:00:00Z',
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
          is_submitted: true,
          captured_at: '2026-05-01T10:30:00Z',
          submitted_at: '2026-05-01T11:00:00Z',
          originator_user_id: '00000000-0000-4000-8000-000000000070',
          originator_role: 'CRC',
          supersedes_response_id: null,
          value: { value_text: '120/80' },
        },
        history: [
          {
            response_id: '00000000-0000-4000-8000-000000000091',
            response_sequence: 1,
            is_current: true,
            is_submitted: true,
            captured_at: '2026-05-01T10:30:00Z',
            submitted_at: '2026-05-01T11:00:00Z',
            originator_user_id: '00000000-0000-4000-8000-000000000070',
            originator_role: 'CRC',
            supersedes_response_id: null,
            correction_chain_root_id: null,
            raw_value: { value_text: '120/80' },
          },
        ],
      },
    ],
    corrections: [],
    addenda: [],
    findings_summary: { active: [], counts: { total: 0, open: 0, acknowledged: 0, resolved: 0, waived: 0, severity: { info: 0, warning: 0, error: 0 } } },
    placeholders: {},
    lineage: {
      immutable_append_only: true,
      history_rpc: 'get_source_response_set_history',
      chronology_ref: {
        organization_id: '00000000-0000-4000-8000-000000000010',
        source_response_set_id: '00000000-0000-4000-8000-000000000001',
      },
    },
  },
  manifest: {
    source_response_set_id: '00000000-0000-4000-8000-000000000001',
    organization_id: '00000000-0000-4000-8000-000000000010',
    study_id: '00000000-0000-4000-8000-000000000020',
    status: 'submitted',
    timestamps: { opened_at: '2026-05-01T10:00:00Z', submitted_at: '2026-05-01T11:00:00Z' },
    completeness: { required_fields_total: 1, required_fields_captured_current: 1, is_submitted: true },
    counts: {
      responses_current: 1,
      responses_total: 1,
      corrections: 0,
      addenda: 0,
      findings_active: 0,
      findings_open: 0,
      findings_total: 0,
    },
    latest_activity: { occurred_at: '2026-05-01T11:00:00Z', event_kind: 'response_set_submitted' },
    lineage_refs: {},
    chronology_checksum: null,
  },
  history: {
    source_response_set_id: '00000000-0000-4000-8000-000000000001',
    organization_id: '00000000-0000-4000-8000-000000000010',
    study_id: '00000000-0000-4000-8000-000000000020',
    study_subject_id: '00000000-0000-4000-8000-000000000030',
    visit_id: '00000000-0000-4000-8000-000000000040',
    procedure_execution_id: '00000000-0000-4000-8000-000000000050',
    current_status: 'submitted',
    event_count: 2,
    events: [
      { occurred_at: '2026-05-01T10:00:00Z', event_kind: 'response_set_opened', actor_user_id: '00000000-0000-4000-8000-000000000070', payload: {} },
      { occurred_at: '2026-05-01T11:00:00Z', event_kind: 'response_set_submitted', actor_user_id: '00000000-0000-4000-8000-000000000070', payload: { note: 'e2e' } },
    ],
  },
  findings: {
    source_response_set_id: '00000000-0000-4000-8000-000000000001',
    organization_id: '00000000-0000-4000-8000-000000000010',
    filters_applied: { active_only: false, status: null, severity: null },
    findings: [
      {
        finding_id: '00000000-0000-4000-8000-0000000000a1',
        finding_type: 'validation',
        severity: 'warning',
        rule_code: 'REQ_FIELD',
        message: 'Synthetic finding',
        status: 'open',
        response_id: null,
        source_field_id: null,
        created_at: '2026-05-01T10:45:00Z',
        resolved_by_user_id: null,
        resolved_at: null,
        resolution_reason: null,
        lifecycle_events: [
          {
            event_id: '00000000-0000-4000-8000-0000000000e1',
            prior_status: null,
            new_status: 'open',
            actor_user_id: '00000000-0000-4000-8000-000000000070',
            reason: null,
            occurred_at: '2026-05-01T10:45:00Z',
            operational_event_id: null,
          },
        ],
      },
    ],
    counts: { returned: 1, total_in_set: 1 },
  },
}

export function buildSyntheticBundle(rc, responseSetId, organizationId) {
  const { normalize, errors } = rc
  const filters = {}
  return {
    responseSetId,
    organizationId,
    detail: errors.normalizeEnvelopeToPanelResult(
      { ok: true, code: 'OK', data: SYNTHETIC_READ_PAYLOADS.detail, errors: [], warnings: [], meta: { requestId: 'synthetic', source: 'api', rpc: 'get_source_response_set' } },
      normalize.normalizeResponseSetDetail,
      'Response set detail',
    ),
    manifest: errors.normalizeEnvelopeToPanelResult(
      { ok: true, code: 'OK', data: SYNTHETIC_READ_PAYLOADS.manifest, errors: [], warnings: [], meta: { requestId: 'synthetic', source: 'api', rpc: 'get_source_response_set_manifest' } },
      normalize.normalizeManifest,
      'Manifest',
    ),
    history: errors.normalizeEnvelopeToPanelResult(
      { ok: true, code: 'OK', data: SYNTHETIC_READ_PAYLOADS.history, errors: [], warnings: [], meta: { requestId: 'synthetic', source: 'api', rpc: 'get_source_response_set_history' } },
      normalize.normalizeHistoryTimeline,
      'History',
    ),
    findings: errors.normalizeEnvelopeToPanelResult(
      { ok: true, code: 'OK', data: SYNTHETIC_READ_PAYLOADS.findings, errors: [], warnings: [], meta: { requestId: 'synthetic', source: 'api', rpc: 'list_source_response_set_findings' } },
      (data) => normalize.normalizeFindingsPanel(data, responseSetId, organizationId, filters),
      'Findings',
    ),
  }
}

export function runUnitValidations(rc) {
  const { normalize, errors, format } = rc
  const results = []
  const rsId = SYNTHETIC_READ_PAYLOADS.detail.response_set.id
  const orgId = SYNTHETIC_READ_PAYLOADS.detail.response_set.organization_id

  function record(id, issues) {
    results.push({ id, ok: issues.length === 0, issues })
  }

  let detailVm
  let manifestVm
  let historyVm
  let findingsVm

  try {
    const before = stableFingerprint(SYNTHETIC_READ_PAYLOADS.detail)
    detailVm = normalize.normalizeResponseSetDetail(structuredClone(SYNTHETIC_READ_PAYLOADS.detail))
    const after = stableFingerprint(SYNTHETIC_READ_PAYLOADS.detail)
    record('normalizer_detail', [...assertInputUnchanged(before, after), ...assertDetailViewModel(detailVm)])
  } catch (e) {
    record('normalizer_detail', [`threw: ${e.message}`])
  }

  try {
    const before = stableFingerprint(SYNTHETIC_READ_PAYLOADS.manifest)
    manifestVm = normalize.normalizeManifest(structuredClone(SYNTHETIC_READ_PAYLOADS.manifest))
    record('normalizer_manifest', [...assertInputUnchanged(before, stableFingerprint(SYNTHETIC_READ_PAYLOADS.manifest)), ...assertManifestViewModel(manifestVm)])
  } catch (e) {
    record('normalizer_manifest', [`threw: ${e.message}`])
  }

  try {
    const before = stableFingerprint(SYNTHETIC_READ_PAYLOADS.history)
    historyVm = normalize.normalizeHistoryTimeline(structuredClone(SYNTHETIC_READ_PAYLOADS.history))
    record('normalizer_history', [
      ...assertInputUnchanged(before, stableFingerprint(SYNTHETIC_READ_PAYLOADS.history)),
      ...assertHistoryViewModel(historyVm, SYNTHETIC_READ_PAYLOADS.history.events),
    ])
  } catch (e) {
    record('normalizer_history', [`threw: ${e.message}`])
  }

  try {
    const before = stableFingerprint(SYNTHETIC_READ_PAYLOADS.findings)
    findingsVm = normalize.normalizeFindingsPanel(
      structuredClone(SYNTHETIC_READ_PAYLOADS.findings),
      rsId,
      orgId,
      {},
    )
    record('normalizer_findings', [
      ...assertInputUnchanged(before, stableFingerprint(SYNTHETIC_READ_PAYLOADS.findings)),
      ...assertFindingsViewModel(findingsVm, SYNTHETIC_READ_PAYLOADS.findings.findings),
    ])
  } catch (e) {
    record('normalizer_findings', [`threw: ${e.message}`])
  }

  if (detailVm) {
    const fp1 = stableFingerprint(normalize.normalizeResponseSetDetail(structuredClone(SYNTHETIC_READ_PAYLOADS.detail)))
    const fp2 = stableFingerprint(normalize.normalizeResponseSetDetail(structuredClone(SYNTHETIC_READ_PAYLOADS.detail)))
    record('determinism_detail', fp1 === fp2 ? [] : ['double normalize fingerprint mismatch'])
  }

  if (historyVm) {
    const fp1 = stableFingerprint(normalize.normalizeHistoryTimeline(structuredClone(SYNTHETIC_READ_PAYLOADS.history)))
    const fp2 = stableFingerprint(normalize.normalizeHistoryTimeline(structuredClone(SYNTHETIC_READ_PAYLOADS.history)))
    record('determinism_history', fp1 === fp2 ? [] : ['history fingerprint mismatch'])
  }

  const bundle = buildSyntheticBundle(rc, rsId, orgId)
  record('bundle_shape', assertBundleViewModel(bundle))

  const forbiddenEnv = {
    ok: false,
    code: 'FORBIDDEN',
    data: null,
    errors: [{ code: 'FORBIDDEN', message: 'Organization scope denied' }],
    warnings: [],
    meta: { requestId: 'unit-forbidden', source: 'api', rpc: 'get_source_response_set' },
  }
  const forbiddenPanel = errors.normalizeEnvelopeToPanelResult(
    forbiddenEnv,
    () => {
      throw new Error('should not run')
    },
    'Response set detail',
  )
  record('error_forbidden_panel', [
    ...(forbiddenPanel.status === 'error' ? [] : ['expected error status']),
    ...assertReadPanelErrorCardConsumable(forbiddenPanel.error),
    ...(forbiddenPanel.error?.isForbidden ? [] : ['expected isForbidden']),
  ])

  const networkPanel = errors.networkPanelError('History', 'Connection refused')
  record('error_network_panel', [
    ...(networkPanel.status === 'error' ? [] : ['expected error status']),
    ...(networkPanel.error?.code === 'NETWORK_ERROR' ? [] : ['expected NETWORK_ERROR code']),
    ...assertReadPanelError(networkPanel.error),
  ])

  record('render_format_safety', assertFormatRenderSafety(format))

  return results
}

export function validateLivePayloads(rc, envelopes, responseSetId, organizationId) {
  const { normalize, errors } = rc
  const results = []

  function record(id, issues) {
    results.push({ id, ok: issues.length === 0, issues })
  }

  for (const kind of ['detail', 'manifest', 'history', 'findings']) {
    const env = envelopes[kind]
    const envIssues = assertReadApiEnvelope(env.body, kind, { requireOk: true })
    record(`envelope_${kind}`, envIssues.ok ? [] : envIssues.issues)
  }

  const detailData = envelopes.detail.body.data
  const manifestData = envelopes.manifest.body.data
  const historyData = envelopes.history.body.data
  const findingsData = envelopes.findings.body.data

  const detailBefore = stableFingerprint(detailData)
  const detailVm = normalize.normalizeResponseSetDetail(structuredClone(detailData))
  record('live_normalizer_detail', [
    ...assertInputUnchanged(detailBefore, stableFingerprint(detailData)),
    ...assertDetailViewModel(detailVm),
  ])

  const manifestVm = normalize.normalizeManifest(structuredClone(manifestData))
  record('live_normalizer_manifest', assertManifestViewModel(manifestVm))

  const historyVm = normalize.normalizeHistoryTimeline(structuredClone(historyData))
  record('live_normalizer_history', assertHistoryViewModel(historyVm, historyData.events ?? []))

  const findingsVm = normalize.normalizeFindingsPanel(
    structuredClone(findingsData),
    responseSetId,
    organizationId,
    {},
  )
  record('live_normalizer_findings', assertFindingsViewModel(findingsVm, findingsData.findings ?? []))

  const fpA = stableFingerprint(normalize.normalizeResponseSetDetail(structuredClone(detailData)))
  const fpB = stableFingerprint(normalize.normalizeResponseSetDetail(structuredClone(detailData)))
  record('live_determinism_detail', fpA === fpB ? [] : ['live detail fingerprint mismatch'])

  const bundle = {
    responseSetId,
    organizationId,
    detail: errors.normalizeEnvelopeToPanelResult(envelopes.detail.body, normalize.normalizeResponseSetDetail, 'Response set detail'),
    manifest: errors.normalizeEnvelopeToPanelResult(envelopes.manifest.body, normalize.normalizeManifest, 'Manifest'),
    history: errors.normalizeEnvelopeToPanelResult(envelopes.history.body, normalize.normalizeHistoryTimeline, 'History'),
    findings: errors.normalizeEnvelopeToPanelResult(
      envelopes.findings.body,
      (data) => normalize.normalizeFindingsPanel(data, responseSetId, organizationId, {}),
      'Findings',
    ),
  }
  record('live_bundle_shape', assertBundleViewModel(bundle))

  return results
}
