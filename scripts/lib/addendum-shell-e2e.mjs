/**
 * Phase 5.4B — Post-submit addendum shell E2E helpers.
 */

import { assertReadApiEnvelope, readRoutePath, stableFingerprint } from './read-contract-e2e.mjs'
import { isChronological, valueForWidget } from './source-api-e2e.mjs'
import { detailFieldDisplayValue } from './capture-shell-e2e.mjs'
import {
  buildReviewPanels,
  displayFromValuePayload,
  isPostSubmitResponseSet,
} from './correction-shell-e2e.mjs'

export {
  assertReadApiEnvelope,
  readRoutePath,
  stableFingerprint,
  detailFieldDisplayValue,
  isPostSubmitResponseSet,
  displayFromValuePayload,
}

export const ADDENDUM_RPC = 'add_source_addendum'

export function manifestAddendaCount(manifestBody) {
  const n = manifestBody?.data?.counts?.addenda
  return typeof n === 'number' ? n : Number(manifestBody?.data?.counts?.addenda ?? 0)
}

export function resolveAllowAddenda(manifestPanel) {
  return manifestPanel?.status === 'success' && manifestPanel.data?.isSubmitted === true
}

export function pickAddendumEligibleField(detailData) {
  const fields = detailData?.fields ?? []
  const eligible = fields.filter((f) => !f.current_effective)
  const score = (f) => {
    let s = 0
    if (!f.is_required) s += 10
    const hint = String(f.widget_hint ?? 'text').toLowerCase()
    if (hint === 'text' || hint.includes('string')) s += 5
    return s
  }
  return [...eligible].sort((a, b) => score(b) - score(a))[0] ?? null
}

export function countAddendumEligibleFields(detailPanel, allowAddenda) {
  if (!allowAddenda || detailPanel.status !== 'success') return 0
  return detailPanel.data.addendumEligibleFields?.length ?? 0
}

export function addendumValueForWidget(widgetHint, textOverride = 'e2e-54b-addendum-value') {
  const base = valueForWidget(widgetHint)
  if (base.value_text !== undefined) return { value_text: textOverride }
  if (base.value_number !== undefined) return { value_number: 99 }
  if (base.value_boolean !== undefined) return { value_boolean: true }
  if (base.value_date !== undefined) return { value_date: '2026-06-20' }
  if (base.value_datetime !== undefined) return { value_datetime: '2026-06-20T10:00:00Z' }
  return { value_text: textOverride }
}

export function expectedDisplayForAddendum(widgetHint, textOverride) {
  return displayFromValuePayload(addendumValueForWidget(widgetHint, textOverride))
}

export function historyHasAddendumEvent(historyData) {
  const kinds = (historyData?.events ?? []).map((e) => String(e.event_kind ?? ''))
  return kinds.some(
    (k) =>
      k === 'source_addendum_added' ||
      k === 'SOURCE_ADDENDUM_ADDED' ||
      k.includes('addendum'),
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

export function assertPostAddendumReadState({
  beforeManifestCount,
  afterEnvelopes,
  modules,
  ctx,
}) {
  const issues = []
  const { detailPanel, manifestPanel, historyPanel } = buildReviewPanels(afterEnvelopes, modules)
  const detailData = afterEnvelopes.detail.body?.data
  const allowAddenda = resolveAllowAddenda(manifestPanel)

  if (!assertReadApiEnvelope(afterEnvelopes.detail.body, 'detail', { requireOk: true }).ok) {
    issues.push('detail envelope invalid')
  }
  if (!assertReadApiEnvelope(afterEnvelopes.manifest.body, 'manifest', { requireOk: true }).ok) {
    issues.push('manifest envelope invalid')
  }
  if (!assertReadApiEnvelope(afterEnvelopes.history.body, 'history', { requireOk: true }).ok) {
    issues.push('history envelope invalid')
  }

  const afterCount = manifestAddendaCount(afterEnvelopes.manifest.body)
  if (afterCount < beforeManifestCount + 1) {
    issues.push(`manifest addenda ${beforeManifestCount} -> ${afterCount} (expected +1)`)
  }

  if (!isPostSubmitResponseSet(detailData, afterEnvelopes.manifest.body)) {
    issues.push(
      `response set not in post-submit lane after addendum (status=${detailData?.response_set?.status})`,
    )
  }

  if (!allowAddenda) issues.push('manifest isSubmitted false after addendum')

  const expectedDisplay = ctx.expectedAddendumDisplay
  const actualDisplay = ctx.addendumFieldId
    ? detailFieldDisplayValue(detailData, ctx.addendumFieldId)
    : null
  if (actualDisplay !== expectedDisplay) {
    issues.push(`field effective display expected ${expectedDisplay}, got ${actualDisplay}`)
  }

  const fieldRow = detailData?.fields?.find((f) => f.source_field_id === ctx.addendumFieldId)
  if (!fieldRow?.current_effective?.response_id) {
    issues.push('addendum field missing current_effective after addendum')
  }

  const addendumRows = detailData?.addenda ?? []
  const match = addendumRows.find(
    (a) =>
      a.introduced_source_field_id === ctx.addendumFieldId &&
      a.late_entry_reason === ctx.addendumReason,
  )
  if (!match) {
    issues.push('detail.addenda missing row for field + reason')
  } else {
    const valueDisp = displayFromValuePayload(match.structured_payload)
    if (valueDisp !== expectedDisplay) {
      issues.push(`addendum structured_payload expected ${expectedDisplay}, got ${valueDisp}`)
    }
    if (!match.added_at || !match.added_by_user_id) {
      issues.push('addendum row missing attribution or timestamp')
    }
    if (!match.addendum_id) issues.push('addendum row missing addendum_id')
  }

  if (!historyHasAddendumEvent(afterEnvelopes.history.body?.data)) {
    issues.push('history timeline missing source_addendum_added event')
  }

  if (historyPanel.status === 'success') {
    const rawEvents = afterEnvelopes.history.body?.data?.events ?? []
    if (!isChronological(rawEvents)) issues.push('history events not chronological')
  }

  const eligibleAfter = countAddendumEligibleFields(detailPanel, allowAddenda)
  if (eligibleAfter > 0 && eligibleAfter >= (ctx.eligibleBefore ?? 1)) {
    issues.push(
      `addendum field still eligible after addendum (eligibleBefore=${ctx.eligibleBefore} eligibleAfter=${eligibleAfter})`,
    )
  }

  return {
    ok: issues.length === 0,
    issues,
    afterCount,
    expectedDisplay,
    actualDisplay,
    eligibleAfter,
  }
}

export function runAddendumUnitValidations(modules, addendumModules) {
  const results = []
  const { parseAddendumValueInput } = addendumModules

  function record(id, issues) {
    results.push({ id, ok: issues.length === 0, issues })
  }

  record('parse_addendum_empty', [
    ...(parseAddendumValueInput('', 'text').ok ? ['expected failure for empty'] : []),
  ])

  record('parse_addendum_text', [
    ...(parseAddendumValueInput('late-entry-x', 'text').ok ? [] : ['text parse failed']),
  ])

  const draftDetail = {
    response_set: { status: 'draft', source_definition_version_id: '00000000-0000-4000-8000-000000000060' },
    fields: [
      {
        source_field_id: '00000000-0000-4000-8000-000000000081',
        field_key: 'required.field',
        widget_hint: 'text',
        is_required: true,
        current_effective: {
          response_id: '00000000-0000-4000-8000-000000000091',
          value: { value_text: 'captured' },
        },
        history: [],
      },
      {
        source_field_id: '00000000-0000-4000-8000-000000000082',
        field_key: 'optional.late',
        widget_hint: 'text',
        is_required: false,
        current_effective: null,
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

  const allowDraft = resolveAllowAddenda(draftManifest)
  const allowSubmitted = resolveAllowAddenda(submittedManifest)

  record('ui_contract_draft_no_addendum', [
    ...(allowDraft ? ['draft must not allow addenda'] : []),
    ...(draftVm.addendumEligibleFields.length > 0 && allowDraft
      ? ['draft must not expose addendum panel when not submitted']
      : []),
  ])

  record('ui_contract_submitted_addendum', [
    ...(!allowSubmitted ? ['submitted must allow addenda'] : []),
    ...(submittedVm.addendumEligibleFields.length !== 1
      ? [`expected 1 addendum-eligible field, got ${submittedVm.addendumEligibleFields.length}`]
      : []),
    ...(submittedVm.addendumEligibleFields[0]?.fieldId === '00000000-0000-4000-8000-000000000082'
      ? []
      : ['expected optional field eligible']),
  ])

  record('pick_addendum_field', [
    ...(pickAddendumEligibleField(submittedDetail)?.source_field_id ===
    '00000000-0000-4000-8000-000000000082'
      ? []
      : ['pickAddendumEligibleField should prefer optional empty field']),
  ])

  return results
}
