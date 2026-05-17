/**
 * Phase 5.2B — Pure normalizers: canonical API payloads → view-models.
 * Preserves API ordering; no chronology rewriting.
 */

import { findingActionEligibility } from '@/lib/source/findings/eligibility'
import type {
  FindingsListData,
  FindingsListFilters,
  HistoryData,
  ManifestData,
  ResponseSetDetailData,
} from '@/lib/api/source/read-types'
import {
  EMPTY_DISPLAY,
  formatActor,
  formatEventKind,
  formatStatusLabel,
  formatStructuredPayload,
  formatTimestamp,
  formatValuePayload,
  severityTone,
} from '@/lib/source/read-contract/format'
import type {
  AddendumRowViewModel,
  CorrectionRowViewModel,
  DisplayBadge,
  FieldHistoryVersionViewModel,
  FieldRowViewModel,
  FindingRowViewModel,
  FindingsFilterLinkViewModel,
  FindingsPanelViewModel,
  HistoryEventViewModel,
  HistoryTimelineViewModel,
  ManifestStatViewModel,
  ManifestViewModel,
  MetadataRowViewModel,
  ResponseSetDetailViewModel,
} from '@/lib/source/read-contract/view-models'

function filterHref(
  responseSetId: string,
  organizationId: string,
  patch: Record<string, string | undefined>,
): string {
  const params = new URLSearchParams({ organization_id: organizationId })
  for (const [k, v] of Object.entries(patch)) {
    if (v !== undefined && v !== '') params.set(k, v)
  }
  return `/source/response-set/${responseSetId}?${params.toString()}`
}

export function normalizeResponseSetDetail(data: ResponseSetDetailData): ResponseSetDetailViewModel {
  const rs = data.response_set
  const correctionsByField = new Map(
    data.corrections.map((c) => [c.source_field_id, c]),
  )
  const addendaByField = new Map(
    data.addenda.map((a) => [a.introduced_source_field_id, a]),
  )

  const metadataRows: MetadataRowViewModel[] = [
    { label: 'Status', value: formatStatusLabel(rs.status) },
    {
      label: 'Submitted',
      value: rs.submitted_at
        ? `${formatTimestamp(rs.submitted_at)}${rs.submitted_by_user_id ? ` · ${formatActor(rs.submitted_by_user_id)}` : ''}`
        : EMPTY_DISPLAY,
    },
    { label: 'Opened', value: formatTimestamp(rs.opened_at) },
    { label: 'Procedure execution', value: rs.procedure_execution_id, mono: true },
    { label: 'Source definition version', value: rs.source_definition_version_id, mono: true },
    {
      label: 'Visit / subject',
      value: `${formatActor(rs.visit_id)} / ${formatActor(rs.study_subject_id)}`,
      mono: true,
    },
  ]

  const fields: FieldRowViewModel[] = data.fields.map((field) => {
    const current = field.current_effective
    const badges: DisplayBadge[] = []
    if (field.is_required) badges.push({ label: 'Required', tone: 'muted' })
    if (correctionsByField.has(field.source_field_id)) {
      badges.push({ label: 'Corrected', tone: 'warn' })
    }
    if (addendaByField.has(field.source_field_id)) {
      badges.push({ label: 'Addendum', tone: 'info' })
    }
    badges.push({
      label: current?.is_submitted ? 'Submitted' : 'Draft',
      tone: current?.is_submitted ? 'success' : 'muted',
    })

    const historyVersions: FieldHistoryVersionViewModel[] = field.history.map((h) => {
      const flags: string[] = []
      if (h.is_current) flags.push('current')
      flags.push(h.is_submitted ? 'submitted' : 'draft')
      return {
        id: h.response_id,
        sequenceLabel: `#${h.response_sequence}`,
        displayValue: formatValuePayload(h.raw_value),
        capturedAtDisplay: formatTimestamp(h.captured_at),
        flags,
      }
    })

    const captureMeta = current
      ? `Seq ${current.response_sequence} · captured ${formatTimestamp(current.captured_at)}${current.originator_user_id ? ` · ${formatActor(current.originator_user_id)}` : ''}`
      : null

    return {
      fieldId: field.source_field_id,
      fieldKey: field.field_key,
      displayValue: current ? formatValuePayload(current.value) : EMPTY_DISPLAY,
      isRequired: field.is_required,
      badges,
      captureMeta,
      historyVersions,
      currentResponseId: current?.response_id ?? null,
      widgetHint: field.widget_hint ?? 'text',
      addendumEligible: !current,
    }
  })

  const addendumEligibleFields = fields
    .filter((f) => f.addendumEligible)
    .map((f) => ({
      fieldId: f.fieldId,
      fieldKey: f.fieldKey,
      widgetHint: f.widgetHint,
      isRequired: f.isRequired,
    }))

  const corrections: CorrectionRowViewModel[] = data.corrections.map((c) => ({
    id: c.correction_id,
    typeLabel: c.correction_type,
    reason: c.correction_reason,
    correctedAtDisplay: formatTimestamp(c.corrected_at),
    actorDisplay: formatActor(c.corrected_by_user_id),
    priorValueDisplay: formatValuePayload(c.prior_value),
    correctedValueDisplay: formatValuePayload(c.corrected_value),
  }))

  const addenda: AddendumRowViewModel[] = data.addenda.map((a) => ({
    id: a.addendum_id,
    fieldLabel: a.field_key ?? a.introduced_source_field_id,
    reason: a.late_entry_reason,
    addedAtDisplay: formatTimestamp(a.added_at),
    actorDisplay: formatActor(a.added_by_user_id),
    displayValue: a.structured_payload ? formatValuePayload(a.structured_payload) : null,
  }))

  return {
    statusLabel: formatStatusLabel(rs.status),
    sourceDefinitionVersionId: rs.source_definition_version_id ?? null,
    metadataRows,
    fields,
    addendumEligibleFields,
    corrections,
    addenda,
    fieldCount: fields.length,
  }
}

export function normalizeManifest(data: ManifestData): ManifestViewModel {
  const c = data.counts
  const completeness = data.completeness

  const headlineStats: ManifestStatViewModel[] = [
    { label: 'Status', value: formatStatusLabel(data.status) },
    {
      label: 'Completeness',
      value: `${completeness.required_fields_captured_current} / ${completeness.required_fields_total} required`,
    },
    {
      label: 'Latest activity',
      value: `${data.latest_activity.event_kind ? formatEventKind(data.latest_activity.event_kind) : EMPTY_DISPLAY} · ${formatTimestamp(data.latest_activity.occurred_at)}`,
    },
    {
      label: 'Findings',
      value: `${c.findings_active ?? 0} active · ${c.findings_open ?? 0} open · ${c.findings_total ?? 0} total`,
    },
  ]

  const countStats: ManifestStatViewModel[] = [
    { label: 'Responses (current)', value: String(c.responses_current ?? EMPTY_DISPLAY) },
    { label: 'Responses (total)', value: String(c.responses_total ?? EMPTY_DISPLAY) },
    { label: 'Corrections', value: String(c.corrections ?? EMPTY_DISPLAY) },
    { label: 'Addenda', value: String(c.addenda ?? EMPTY_DISPLAY) },
    { label: 'Submitted', value: data.timestamps.submitted_at ? 'yes' : 'no' },
    { label: 'Opened', value: formatTimestamp(data.timestamps.opened_at) },
  ]

  return {
    statusLabel: formatStatusLabel(data.status),
    completenessLabel: `${completeness.required_fields_captured_current} / ${completeness.required_fields_total} required fields`,
    isSubmitted: completeness.is_submitted,
    headlineStats,
    countStats,
  }
}

export function normalizeHistoryTimeline(data: HistoryData): HistoryTimelineViewModel {
  const events: HistoryEventViewModel[] = (data.events ?? []).map((evt, index) => {
    const payload =
      evt.payload && typeof evt.payload === 'object' && Object.keys(evt.payload).length > 0
        ? formatStructuredPayload(evt.payload)
        : null

    return {
      id: `${evt.occurred_at}-${evt.event_kind}-${index}`,
      occurredAtDisplay: formatTimestamp(evt.occurred_at),
      kindLabel: formatEventKind(evt.event_kind),
      actorDisplay: evt.actor_user_id ? formatActor(evt.actor_user_id) : null,
      payloadDisplay: payload,
    }
  })

  return {
    eventCount: data.event_count ?? events.length,
    events,
    emptyMessage: 'No chronology events returned.',
  }
}

export function normalizeFindingsPanel(
  data: FindingsListData,
  responseSetId: string,
  organizationId: string,
  filters: FindingsListFilters,
): FindingsPanelViewModel {
  const base = { organization_id: organizationId }

  const statusLinks: FindingsFilterLinkViewModel[] = [
    {
      label: 'All',
      href: filterHref(responseSetId, organizationId, base),
      active: !filters.active_only && !filters.status && !filters.severity,
    },
    {
      label: 'Active only',
      href: filterHref(responseSetId, organizationId, { ...base, active_only: 'true' }),
      active: Boolean(filters.active_only),
    },
    {
      label: 'Open',
      href: filterHref(responseSetId, organizationId, { ...base, status: 'open' }),
      active: filters.status === 'open',
    },
    {
      label: 'Acknowledged',
      href: filterHref(responseSetId, organizationId, { ...base, status: 'acknowledged' }),
      active: filters.status === 'acknowledged',
    },
    {
      label: 'Resolved',
      href: filterHref(responseSetId, organizationId, { ...base, status: 'resolved' }),
      active: filters.status === 'resolved',
    },
    {
      label: 'Waived',
      href: filterHref(responseSetId, organizationId, { ...base, status: 'waived' }),
      active: filters.status === 'waived',
    },
  ]

  const severityLinks: FindingsFilterLinkViewModel[] = [
    { label: 'Info', value: 'info' },
    { label: 'Warning', value: 'warning' },
    { label: 'Error', value: 'error' },
  ].map((s) => ({
    label: s.label,
    href: filterHref(responseSetId, organizationId, {
      ...base,
      active_only: filters.active_only ? 'true' : undefined,
      status: filters.status ?? undefined,
      severity: s.value,
    }),
    active: filters.severity === s.value,
  }))

  const clearSeverityHref = filters.severity
    ? filterHref(responseSetId, organizationId, {
        ...base,
        active_only: filters.active_only ? 'true' : undefined,
        status: filters.status ?? undefined,
      })
    : null

  const findings: FindingRowViewModel[] = data.findings.map((f) => {
    const tone = severityTone(f.severity)
    const ruleMeta = `Rule ${f.rule_code} · ${formatTimestamp(f.created_at)}${f.source_field_id ? ` · field ${formatActor(f.source_field_id)}` : ''}`
    const resolutionMeta = f.resolved_at
      ? `Resolved ${formatTimestamp(f.resolved_at)} · ${f.resolution_reason ?? EMPTY_DISPLAY}`
      : null

    const timeline = f.lifecycle_events.map((e) => ({
      id: e.event_id,
      line: `${formatTimestamp(e.occurred_at)}: ${e.prior_status ?? EMPTY_DISPLAY} → ${e.new_status}${e.actor_user_id ? ` · ${formatActor(e.actor_user_id)}` : ''}${e.reason ? ` — ${e.reason}` : ''}`,
    }))

    const actions = findingActionEligibility(f.status)

    return {
      id: f.finding_id,
      severityLabel: f.severity,
      severityTone: tone,
      statusLabel: f.status,
      typeLabel: f.finding_type,
      message: f.message,
      ruleMeta,
      resolutionMeta,
      timeline,
      ...actions,
    }
  })

  return {
    summaryLabel: `${data.counts.returned} shown · ${data.counts.total_in_set} in set`,
    filters: {
      statusLinks,
      severityLinks,
      clearSeverityHref,
    },
    findings,
    emptyMessage: 'No findings match the current filters.',
  }
}
