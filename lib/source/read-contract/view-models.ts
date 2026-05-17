/**
 * Phase 5.2B — Stable frontend read view-models (UI-facing only).
 */

import type { SeverityTone } from '@/lib/source/read-contract/format'

export type DisplayBadge = {
  label: string
  tone: 'muted' | 'warn' | 'info' | 'success'
}

export type MetadataRowViewModel = {
  label: string
  value: string
  mono?: boolean
}

export type FieldHistoryVersionViewModel = {
  id: string
  sequenceLabel: string
  displayValue: string
  capturedAtDisplay: string
  flags: string[]
}

export type FieldRowViewModel = {
  fieldId: string
  fieldKey: string
  displayValue: string
  isRequired: boolean
  badges: DisplayBadge[]
  captureMeta: string | null
  historyVersions: FieldHistoryVersionViewModel[]
  /** Current effective source_responses.id — required for post-submit correction. */
  currentResponseId: string | null
  widgetHint: string
  /** No current effective value — eligible for late-entry addendum (RPC requires source_field_id). */
  addendumEligible: boolean
}

export type CorrectionRowViewModel = {
  id: string
  typeLabel: string
  reason: string
  correctedAtDisplay: string
  actorDisplay: string
  priorValueDisplay: string
  correctedValueDisplay: string
}

export type AddendumRowViewModel = {
  id: string
  fieldLabel: string
  reason: string
  addedAtDisplay: string
  actorDisplay: string
  displayValue: string | null
}

export type AddendumEligibleFieldViewModel = {
  fieldId: string
  fieldKey: string
  widgetHint: string
  isRequired: boolean
}

export type ResponseSetDetailViewModel = {
  statusLabel: string
  sourceDefinitionVersionId: string | null
  metadataRows: MetadataRowViewModel[]
  fields: FieldRowViewModel[]
  addendumEligibleFields: AddendumEligibleFieldViewModel[]
  corrections: CorrectionRowViewModel[]
  addenda: AddendumRowViewModel[]
  fieldCount: number
}

export type ManifestStatViewModel = {
  label: string
  value: string
}

export type ManifestViewModel = {
  statusLabel: string
  completenessLabel: string
  isSubmitted: boolean
  headlineStats: ManifestStatViewModel[]
  countStats: ManifestStatViewModel[]
}

export type HistoryEventViewModel = {
  id: string
  occurredAtDisplay: string
  kindLabel: string
  actorDisplay: string | null
  payloadDisplay: string | null
}

export type HistoryTimelineViewModel = {
  eventCount: number
  events: HistoryEventViewModel[]
  emptyMessage: string
}

export type FindingTimelineEntryViewModel = {
  id: string
  line: string
}

export type FindingRowViewModel = {
  id: string
  severityLabel: string
  severityTone: SeverityTone
  statusLabel: string
  typeLabel: string
  message: string
  ruleMeta: string
  resolutionMeta: string | null
  timeline: FindingTimelineEntryViewModel[]
  canAcknowledge: boolean
  canResolve: boolean
  canWaive: boolean
}

export type FindingsFilterLinkViewModel = {
  label: string
  href: string
  active: boolean
}

export type FindingsFiltersViewModel = {
  statusLinks: FindingsFilterLinkViewModel[]
  severityLinks: FindingsFilterLinkViewModel[]
  clearSeverityHref: string | null
}

export type FindingsPanelViewModel = {
  summaryLabel: string
  filters: FindingsFiltersViewModel
  findings: FindingRowViewModel[]
  emptyMessage: string
}

export type ReadPanelError = {
  code: string
  title: string
  messages: string[]
  requestId: string | null
  isAuthError: boolean
  isForbidden: boolean
}

export type ReadPanelResult<T> =
  | { status: 'success'; data: T; requestId?: string }
  | { status: 'error'; error: ReadPanelError }

export type ResponseSetReviewBundleViewModel = {
  responseSetId: string
  organizationId: string
  detail: ReadPanelResult<ResponseSetDetailViewModel>
  manifest: ReadPanelResult<ManifestViewModel>
  history: ReadPanelResult<HistoryTimelineViewModel>
  findings: ReadPanelResult<FindingsPanelViewModel>
}
