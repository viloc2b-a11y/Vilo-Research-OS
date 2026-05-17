/**
 * Phase 5.3B — Post-submit correction shell E2E helpers.
 */

import { assertReadApiEnvelope, readRoutePath, stableFingerprint } from './read-contract-e2e.mjs'
import { isChronological } from './source-api-e2e.mjs'
import {
  detailFieldDisplayValue,
  expectedDisplayForSavedValue,
  pickPrimaryField,
} from './capture-shell-e2e.mjs'
import { correctionValueForWidget, responseValueSnapshot } from './source-api-e2e.mjs'

export {
  assertReadApiEnvelope,
  readRoutePath,
  stableFingerprint,
  detailFieldDisplayValue,
  pickPrimaryField,
}

export const CORRECT_RPC = 'correct_source_response'

/** Post-submit statuses where correction workflow applies (matches manifest completeness RPC). */
export const POST_SUBMIT_SET_STATUSES = new Set([
  'submitted',
  'pending_review',
  'reviewed',
  'signed',
  'locked',
  'corrected',
  'addended',
])

export function isPostSubmitResponseSet(detailData, manifestBody) {
  const status = detailData?.response_set?.status
  const completenessSubmitted = manifestBody?.data?.completeness?.is_submitted === true
  const hasSubmittedAt = Boolean(manifestBody?.data?.timestamps?.submitted_at)
  return (
    completenessSubmitted &&
    hasSubmittedAt &&
    (status == null || POST_SUBMIT_SET_STATUSES.has(status))
  )
}

export function manifestCorrectionCount(manifestBody) {
  const n = manifestBody?.data?.counts?.corrections
  return typeof n === 'number' ? n : Number(manifestBody?.data?.counts?.corrections ?? 0)
}

export function displayFromValuePayload(payload) {
  if (!payload || typeof payload !== 'object') return null
  if (payload.value_text != null) return String(payload.value_text)
  if (payload.value_number != null) return String(payload.value_number)
  if (payload.value_boolean != null) return payload.value_boolean ? 'true' : 'false'
  if (payload.value_date != null) return String(payload.value_date)
  if (payload.value_datetime != null) return String(payload.value_datetime)
  if (payload.value_json != null) return JSON.stringify(payload.value_json)
  return null
}

export function expectedDisplayForCorrection(widgetHint) {
  return displayFromValuePayload(correctionValueForWidget(widgetHint))
}

export function resolveAllowCorrections(manifestPanel) {
  return manifestPanel?.status === 'success' && manifestPanel.data?.isSubmitted === true
}

export function fieldCorrectionEligible(field, allowCorrections) {
  return Boolean(allowCorrections && field?.currentResponseId)
}

export function buildReviewPanels(envelopes, modules) {
  const detailPanel = modules.normalizeEnvelopeToPanelResult(
    envelopes.detail.body,
    modules.normalizeResponseSetDetail,
    'Detail',
  )
  const manifestPanel = modules.normalizeEnvelopeToPanelResult(
    envelopes.manifest.body,
    modules.normalizeManifest,
    'Manifest',
  )
  const historyPanel = modules.normalizeEnvelopeToPanelResult(
    envelopes.history.body,
    modules.normalizeHistoryTimeline,
    'History',
  )
  return { detailPanel, manifestPanel, historyPanel }
}

export function historyHasCorrectionEvent(historyData) {
  const kinds = (historyData?.events ?? []).map((e) => String(e.event_kind ?? ''))
  return kinds.some(
    (k) =>
      k === 'source_response_corrected' ||
      k === 'SOURCE_RESPONSE_CORRECTED' ||
      k.includes('corrected'),
  )
}

export function historyHasSubmitEvent(historyData) {
  const kinds = (historyData?.events ?? []).map((e) => String(e.event_kind ?? ''))
  return kinds.some(
    (k) =>
      k === 'response_set_submitted' ||
      k === 'SOURCE_RESPONSE_SET_SUBMITTED' ||
      k.includes('submitted'),
  )
}

/**
 * Mirrors review page allowCorrections + FieldCorrectionPanel gate.
 */
export function countCorrectionEligibleFields(detailPanel, allowCorrections) {
  if (!allowCorrections || detailPanel.status !== 'success') return 0
  return detailPanel.data.fields.filter((f) => fieldCorrectionEligible(f, allowCorrections)).length
}

export function assertPostCorrectionReadState({
  beforeManifestCount,
  afterEnvelopes,
  modules,
  ctx,
  correctionReason,
}) {
  const issues = []
  const { detailPanel, manifestPanel, historyPanel } = buildReviewPanels(afterEnvelopes, modules)
  const detailData = afterEnvelopes.detail.body?.data
  const allowCorrections = resolveAllowCorrections(manifestPanel)

  if (!assertReadApiEnvelope(afterEnvelopes.detail.body, 'detail', { requireOk: true }).ok) {
    issues.push('detail envelope invalid')
  }
  if (!assertReadApiEnvelope(afterEnvelopes.manifest.body, 'manifest', { requireOk: true }).ok) {
    issues.push('manifest envelope invalid')
  }
  if (!assertReadApiEnvelope(afterEnvelopes.history.body, 'history', { requireOk: true }).ok) {
    issues.push('history envelope invalid')
  }

  const afterCount = manifestCorrectionCount(afterEnvelopes.manifest.body)
  if (afterCount < beforeManifestCount + 1) {
    issues.push(`manifest corrections ${beforeManifestCount} -> ${afterCount} (expected +1)`)
  }

  if (!isPostSubmitResponseSet(detailData, afterEnvelopes.manifest.body)) {
    issues.push(
      `response set not in post-submit lane after correction (status=${detailData?.response_set?.status})`,
    )
  }

  if (!allowCorrections) issues.push('manifest isSubmitted false after correction')

  const expectedDisplay = expectedDisplayForCorrection(ctx.widgetHint)
  const actualDisplay = ctx.fieldId ? detailFieldDisplayValue(detailData, ctx.fieldId) : null
  if (actualDisplay !== expectedDisplay) {
    issues.push(`effective display expected ${expectedDisplay}, got ${actualDisplay}`)
  }

  const correctionRows = detailData?.corrections ?? []
  const match = correctionRows.find(
    (c) =>
      c.correction_reason === correctionReason &&
      c.superseded_response_id === ctx.priorResponseId,
  )
  if (!match) {
    issues.push('detail.corrections missing row for this correction_reason + prior response')
  } else {
    const priorDisp = displayFromValuePayload(match.prior_value)
    const correctedDisp = displayFromValuePayload(match.corrected_value)
    if (priorDisp !== ctx.submittedDisplay) {
      issues.push(`correction prior_value display expected ${ctx.submittedDisplay}, got ${priorDisp}`)
    }
    if (correctedDisp !== expectedDisplay) {
      issues.push(`correction corrected_value display expected ${expectedDisplay}, got ${correctedDisp}`)
    }
    if (!match.corrected_at || !match.corrected_by_user_id) {
      issues.push('correction row missing attribution or timestamp')
    }
  }

  const fieldRow = detailData?.fields?.find((f) => f.source_field_id === ctx.fieldId)
  const history = fieldRow?.history ?? []
  const originalStillPresent = history.some((h) => {
    if (h.response_id !== ctx.priorResponseId) return false
    return displayFromValuePayload(h.raw_value) === ctx.submittedDisplay
  })
  if (!originalStillPresent) {
    issues.push('field.history missing original submitted raw value')
  }

  if (!historyHasCorrectionEvent(afterEnvelopes.history.body?.data)) {
    issues.push('history timeline missing source_response_corrected event')
  }

  if (historyPanel.status === 'success') {
    const rawEvents = afterEnvelopes.history.body?.data?.events ?? []
    if (!isChronological(rawEvents)) issues.push('history events not chronological')
  }

  const eligible = countCorrectionEligibleFields(detailPanel, allowCorrections)
  if (eligible < 1) issues.push('no correction-eligible fields after submit')

  return { ok: issues.length === 0, issues, afterCount, expectedDisplay, actualDisplay, eligible }
}

export function runCorrectionUnitValidations(modules, correctionModules) {
  const results = []
  const { parseCorrectedValueInput } = correctionModules

  function record(id, issues) {
    results.push({ id, ok: issues.length === 0, issues })
  }

  record('parse_corrected_empty', [
    ...(parseCorrectedValueInput('', 'text').ok ? ['expected failure for empty'] : []),
  ])

  record('parse_corrected_text', [
    ...(parseCorrectedValueInput('corrected-x', 'text').ok ? [] : ['text parse failed']),
  ])

  const draftDetail = {
    response_set: { status: 'draft' },
    fields: [
      {
        source_field_id: '00000000-0000-4000-8000-000000000081',
        field_key: 'vitals.bp',
        widget_hint: 'text',
        is_required: true,
        current_effective: {
          response_id: '00000000-0000-4000-8000-000000000091',
          value: { value_text: '120/80' },
        },
        history: [],
      },
    ],
    corrections: [],
    addenda: [],
    findings_summary: { active: [], counts: {} },
    placeholders: {},
    lineage: {},
  }

  const submittedDetail = structuredClone(draftDetail)
  submittedDetail.response_set.status = 'submitted'

  const draftVm = modules.normalizeResponseSetDetail(draftDetail)
  const submittedVm = modules.normalizeResponseSetDetail(submittedDetail)
  const draftManifest = {
    status: 'success',
    data: { isSubmitted: false, statusLabel: 'draft', headlineStats: [], countStats: [] },
  }
  const submittedManifest = {
    status: 'success',
    data: { isSubmitted: true, statusLabel: 'submitted', headlineStats: [], countStats: [] },
  }

  const allowDraft = resolveAllowCorrections(draftManifest)
  const allowSubmitted = resolveAllowCorrections(submittedManifest)
  const eligibleDraft = draftVm.fields.filter((f) => fieldCorrectionEligible(f, allowDraft)).length
  const eligibleSubmitted = submittedVm.fields.filter((f) =>
    fieldCorrectionEligible(f, allowSubmitted),
  ).length

  record('ui_contract_draft_no_correction', [
    ...(allowDraft ? ['draft must not allow corrections'] : []),
    ...(eligibleDraft > 0 ? ['draft must have zero eligible fields'] : []),
  ])

  record('ui_contract_submitted_correction', [
    ...(!allowSubmitted ? ['submitted must allow corrections'] : []),
    ...(eligibleSubmitted !== 1 ? [`expected 1 eligible field, got ${eligibleSubmitted}`] : []),
    ...(submittedVm.fields[0]?.currentResponseId ? [] : ['currentResponseId required']),
  ])

  record('expected_display_helpers', [
    ...(expectedDisplayForSavedValue('text', 'my-val') === 'my-val' ? [] : ['saved display']),
    ...(expectedDisplayForCorrection('text') === 'e2e-corrected-value' ? [] : ['correction display']),
  ])

  return results
}
