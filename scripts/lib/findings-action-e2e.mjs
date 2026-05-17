/**
 * Phase 5.5B — Findings action UI E2E helpers.
 */

import { assertReadApiEnvelope, readRoutePath, stableFingerprint } from './read-contract-e2e.mjs'
import { isChronological } from './source-api-e2e.mjs'
import { pickPrimaryField } from './capture-shell-e2e.mjs'
import {
  historyHasSubmitEvent,
  isPostSubmitResponseSet,
} from './correction-shell-e2e.mjs'

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
  const findingsPanel = modules.normalizeEnvelopeToPanelResult(
    envelopes.findings.body,
    (data) =>
      modules.normalizeFindingsPanel(
        data,
        data.source_response_set_id,
        data.organization_id,
        data.filters_applied ?? {},
      ),
    'Findings',
  )
  return { detailPanel, manifestPanel, historyPanel, findingsPanel }
}

export {
  assertReadApiEnvelope,
  readRoutePath,
  stableFingerprint,
  pickPrimaryField,
  isPostSubmitResponseSet,
  historyHasSubmitEvent,
}

export const CREATE_FINDING_RPC = 'create_source_validation_finding'
export const ACK_FINDING_RPC = 'acknowledge_source_validation_finding'
export const RESOLVE_FINDING_RPC = 'resolve_source_validation_finding'
export const WAIVE_FINDING_RPC = 'waive_source_validation_finding'

export function manifestFindingCounts(manifestBody) {
  const c = manifestBody?.data?.counts ?? {}
  return {
    total: Number(c.findings_total ?? 0),
    active: Number(c.findings_active ?? 0),
    open: Number(c.findings_open ?? 0),
  }
}

export function findFindingInList(findingsBody, findingId) {
  const rows = findingsBody?.data?.findings ?? []
  return rows.find((f) => f.finding_id === findingId) ?? null
}

export function findFindingVm(findingsPanel, findingId) {
  if (findingsPanel.status !== 'success') return null
  return findingsPanel.data.findings.find((f) => f.id === findingId) ?? null
}

export function findingHasLifecycleStatus(finding, status) {
  const target = status.toLowerCase()
  if (finding?.status?.toLowerCase() === target) return true
  const events = finding?.lifecycle_events ?? []
  return events.some((e) => String(e.new_status ?? '').toLowerCase() === target)
}

export function timelineHasStatus(findingVm, status) {
  const needle = status.toLowerCase()
  return (findingVm?.timeline ?? []).some((t) =>
    String(t.line ?? '').toLowerCase().includes(`→ ${needle}`),
  )
}

export function assertFindingEligibility(vm, expected) {
  const issues = []
  if (!vm) return ['finding view-model missing']
  if (vm.canAcknowledge !== expected.canAcknowledge) {
    issues.push(`canAcknowledge expected ${expected.canAcknowledge}, got ${vm.canAcknowledge}`)
  }
  if (vm.canResolve !== expected.canResolve) {
    issues.push(`canResolve expected ${expected.canResolve}, got ${vm.canResolve}`)
  }
  if (vm.canWaive !== expected.canWaive) {
    issues.push(`canWaive expected ${expected.canWaive}, got ${vm.canWaive}`)
  }
  return issues
}

export function historyHasFindingLifecycleEvent(historyData, statusHint = null) {
  const hint = statusHint ? statusHint.toLowerCase() : null
  return (historyData?.events ?? []).some((e) => {
    const kind = String(e.event_kind ?? '').toLowerCase()
    if (!kind.includes('finding') && !kind.includes('validation_finding')) return false
    if (!hint) return true
    return kind.includes(hint)
  })
}

export function assertPostFindingActionRead({
  envelopes,
  modules,
  findingId,
  expectedStatus,
  expectedEligibility,
  expectHistoryEvent = true,
}) {
  const issues = []
  const { findingsPanel, manifestPanel, historyPanel } = buildReviewPanels(envelopes, modules)
  const detailData = envelopes.detail.body?.data

  if (!assertReadApiEnvelope(envelopes.findings.body, 'findings', { requireOk: true }).ok) {
    issues.push('findings envelope invalid')
  }
  if (!assertReadApiEnvelope(envelopes.manifest.body, 'manifest', { requireOk: true }).ok) {
    issues.push('manifest envelope invalid')
  }
  if (!assertReadApiEnvelope(envelopes.history.body, 'history', { requireOk: true }).ok) {
    issues.push('history envelope invalid')
  }

  if (!isPostSubmitResponseSet(detailData, envelopes.manifest.body)) {
    issues.push(`response set not post-submit (status=${detailData?.response_set?.status})`)
  }

  const raw = findFindingInList(envelopes.findings.body, findingId)
  if (!raw) {
    issues.push(`finding ${findingId} missing from findings read`)
  } else {
    if (raw.status?.toLowerCase() !== expectedStatus.toLowerCase()) {
      issues.push(`finding status expected ${expectedStatus}, got ${raw.status}`)
    }
    if (!findingHasLifecycleStatus(raw, expectedStatus)) {
      issues.push(`lifecycle_events missing transition to ${expectedStatus}`)
    }
    const last = raw.lifecycle_events?.[raw.lifecycle_events.length - 1]
    if (!last?.occurred_at || !last?.actor_user_id) {
      issues.push('latest lifecycle event missing attribution or timestamp')
    }
  }

  const vm = findFindingVm(findingsPanel, findingId)
  if (!vm) {
    issues.push('finding missing from normalized findings panel')
  } else {
    issues.push(...assertFindingEligibility(vm, expectedEligibility))
    if (!timelineHasStatus(vm, expectedStatus)) {
      issues.push(`timeline display missing ${expectedStatus}`)
    }
  }

  const counts = manifestFindingCounts(envelopes.manifest.body)
  if (counts.total < 1) issues.push('manifest findings_total too low')

  if (expectHistoryEvent && !historyHasFindingLifecycleEvent(envelopes.history.body?.data, expectedStatus)) {
    issues.push(`history missing finding lifecycle event for ${expectedStatus}`)
  }

  if (historyPanel.status === 'success') {
    const rawEvents = envelopes.history.body?.data?.events ?? []
    if (!isChronological(rawEvents)) issues.push('history events not chronological')
  }

  return { ok: issues.length === 0, issues, raw, vm, counts }
}

export function runFindingsActionUnitValidations(modules, findingActionEligibility) {
  const results = []

  function record(id, issues) {
    results.push({ id, ok: issues.length === 0, issues })
  }

  record('eligibility_open', [
    ...(findingActionEligibility('open').canAcknowledge ? [] : ['open canAcknowledge']),
    ...(findingActionEligibility('open').canResolve ? [] : ['open canResolve']),
    ...(findingActionEligibility('open').canWaive ? [] : ['open canWaive']),
  ])

  record('eligibility_acknowledged', [
    ...(!findingActionEligibility('acknowledged').canAcknowledge ? [] : ['ack no acknowledge']),
    ...(findingActionEligibility('acknowledged').canResolve ? [] : ['ack canResolve']),
    ...(findingActionEligibility('acknowledged').canWaive ? [] : ['ack canWaive']),
  ])

  record('eligibility_resolved', [
    ...(findingActionEligibility('resolved').canAcknowledge ? ['resolved no ack'] : []),
    ...(findingActionEligibility('resolved').canResolve ? ['resolved no resolve'] : []),
    ...(findingActionEligibility('resolved').canWaive ? ['resolved no waive'] : []),
  ])

  record('eligibility_waived', [
    ...(findingActionEligibility('waived').canAcknowledge ? ['waived no ack'] : []),
    ...(findingActionEligibility('waived').canResolve ? ['waived no resolve'] : []),
    ...(findingActionEligibility('waived').canWaive ? ['waived no waive'] : []),
  ])

  const syntheticFindings = {
    source_response_set_id: '00000000-0000-4000-8000-000000000001',
    organization_id: '00000000-0000-4000-8000-000000000010',
    filters_applied: { active_only: false, status: null, severity: null },
    findings: [
      {
        finding_id: '00000000-0000-4000-8000-0000000000a1',
        finding_type: 'required',
        severity: 'warning',
        rule_code: 'E2E',
        message: 'open finding',
        status: 'open',
        response_id: null,
        source_field_id: null,
        created_at: '2026-05-01T10:00:00Z',
        resolved_by_user_id: null,
        resolved_at: null,
        resolution_reason: null,
        lifecycle_events: [
          {
            event_id: 'e1',
            prior_status: null,
            new_status: 'open',
            actor_user_id: '00000000-0000-4000-8000-000000000070',
            reason: null,
            occurred_at: '2026-05-01T10:00:00Z',
            operational_event_id: null,
          },
        ],
      },
    ],
    counts: { returned: 1, total_in_set: 1 },
  }

  const vm = modules.normalizeFindingsPanel(
    syntheticFindings,
    '00000000-0000-4000-8000-000000000001',
    '00000000-0000-4000-8000-000000000010',
    {},
  )
  record('normalize_open_finding_actions', [
    ...(vm.findings[0]?.canAcknowledge ? [] : ['vm canAcknowledge']),
    ...(vm.findings[0]?.canResolve ? [] : ['vm canResolve']),
  ])

  return results
}
