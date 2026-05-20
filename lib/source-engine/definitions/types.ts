/**
 * Phase 1 — clinical definition types (protocol-aware, study-configurable).
 * No runtime logic, no UI, no persistence. Consumed by rules/validators/calculators.
 */

import type { ClinicalDomain } from '@/lib/source-engine/definitions/domains'

// ---------------------------------------------------------------------------
// Field types
// ---------------------------------------------------------------------------

export const FIELD_TYPES = [
  'text',
  'textarea',
  'number',
  'integer',
  'decimal',
  'date',
  'datetime',
  'time',
  'boolean',
  'select',
  'multiselect',
  'radio',
  'checkbox',
  'calculated',
  'unit_value',
  'signature',
  'file_upload',
] as const

export type FieldType = (typeof FIELD_TYPES)[number]

export type SourceBlindingScope = 'blinded' | 'unblinded' | 'public_to_site'

export type SelectOption = {
  value: string
  label: string
}

export type FieldValidationDefinition = {
  required?: boolean
  min?: number
  max?: number
  minLength?: number
  maxLength?: number
  pattern?: string
  enumValues?: string[]
  /** Serializable validation rule id resolved by validation-engine */
  customRuleId?: string
  message?: string
  /** Calculated fields: allow coordinator override with reason */
  allowManualOverride?: boolean
}

/**
 * Static field metadata only — visibility/requiredness via RuleDefinition, not inline conditions.
 */
export type FieldDefinition = {
  id: string
  label: string
  type: FieldType
  domain: ClinicalDomain
  sourcePath: string
  unit?: string
  options?: SelectOption[]
  instructions?: string
  validation?: FieldValidationDefinition
  /** Reference to DerivedMetricDefinition.id when type === 'calculated' */
  derivedMetricId?: string
  /** Source capture blinding gate. Unset defaults to blinded. */
  blindingScope?: SourceBlindingScope
  blinding_scope?: SourceBlindingScope
  defaultValue?: unknown
  metadata?: Record<string, unknown>
}

// ---------------------------------------------------------------------------
// Sections
// ---------------------------------------------------------------------------

export type SectionDefinition = {
  id: string
  label: string
  domain: ClinicalDomain
  fieldIds: string[]
  instructions?: string
  signatureRequirements?: SignatureRequirement[]
  enabledByDefault?: boolean
  /** Source capture blinding gate. Unset defaults to blinded. */
  blindingScope?: SourceBlindingScope
  blinding_scope?: SourceBlindingScope
  metadata?: Record<string, unknown>
}

export type RepeatableSectionDefinition = {
  id: string
  label: string
  domain: ClinicalDomain
  entityType: string
  childFieldIds: string[]
  minRows: number
  maxRows: number
  addLabel: string
  allowAdd: boolean
  allowRemove: boolean
  allowDisable: boolean
  allowPartialCompletion: boolean
  /** Rule ids scoped to this repeatable entity */
  sectionRuleIds?: string[]
  signatureRequirements?: SignatureRequirement[]
  /** Source capture blinding gate. Unset defaults to blinded. */
  blindingScope?: SourceBlindingScope
  blinding_scope?: SourceBlindingScope
  metadata?: Record<string, unknown>
}

export type SourceTemplateDefinition = {
  id: string
  label: string
  version: string
  protocolRef?: string
  sections: SectionDefinition[]
  repeatableSections: RepeatableSectionDefinition[]
  /** All field definitions referenced by sections */
  fields: FieldDefinition[]
  ruleIds: string[]
  derivedMetricIds: string[]
  validationRuleIds?: string[]
  signaturePolicyId?: string
  auditPolicyId?: string
  config?: StudyTemplateConfig
}

export type StudyTemplateConfig = {
  cortisol?: {
    lowThresholdUgDl: number
    stimRangeMinUgDl: number
    stimRangeMaxUgDl: number
    acthPeakFailureUgDl: number
    steroidPanelCutoffUgDl: number
    usCanadaCountries: string[]
  }
  hit?: {
    plateletDropPercent: number
    plateletLowPerUl: number
  }
  pk?: {
    windowMinutesBefore: number
    windowMinutesAfter: number
  }
  visitWindow?: {
    warningDaysOutside: number
    errorDaysOutside: number
  }
}

// ---------------------------------------------------------------------------
// Rules (declarative — not embedded in fields)
// ---------------------------------------------------------------------------

export type RuleConditionOperator =
  | 'eq'
  | 'neq'
  | 'gt'
  | 'gte'
  | 'lt'
  | 'lte'
  | 'between'
  | 'exists'
  | 'not_exists'
  | 'includes'
  | 'changed'

export type RuleConditionLeaf = {
  op: RuleConditionOperator
  /** Flat field id or `sectionId.rowFieldId` for repeatable rows */
  fieldId?: string
  /** RuntimeContext dot path, e.g. `country`, `signatureState` */
  contextKey?: string
  value?: unknown
  /** For `between` operator */
  range?: [number, number]
}

export type RuleConditionGroup = {
  op: 'and' | 'or'
  conditions: RuleCondition[]
}

export type RuleCondition = RuleConditionLeaf | RuleConditionGroup

export type RuleActionType =
  | 'SHOW'
  | 'HIDE'
  | 'REQUIRE'
  | 'UNREQUIRE'
  | 'ENABLE'
  | 'DISABLE'
  | 'CALCULATE'
  | 'FLAG'
  | 'CREATE_TASK'
  | 'BLOCK_SIGNING'
  | 'REQUIRE_REASON'

export type RuleAction = {
  type: RuleActionType
  fieldId?: string
  sectionId?: string
  repeatableSectionId?: string
  /** CALCULATE → derived metric id */
  metricId?: string
  flagCode?: string
  message?: string
  taskKind?: string
}

export type RuleDefinition = {
  id: string
  label: string
  when: RuleCondition
  actions: RuleAction[]
  priority?: number
  enabled?: boolean
}

// ---------------------------------------------------------------------------
// Derived metrics (isolated from field definitions)
// ---------------------------------------------------------------------------

export type DerivedMetricId =
  | 'bmi'
  | 'pack_years'
  | 'platelet_drop_percent'
  | 'blood_pressure_display'
  | 'visit_window_status'
  | 'pk_window_status'
  | 'cas_score'
  | 'transit_time'
  | 'womac_score'
  | 'mayo_score'

export type DerivedMetricDefinition = {
  id: DerivedMetricId
  label: string
  targetFieldId: string
  inputFieldIds: string[]
  /** Pure function id resolved by calculation-engine */
  formula: DerivedMetricId
  allowManualOverride?: boolean
}

// ---------------------------------------------------------------------------
// Runtime-facing definition types (resolved shapes)
// ---------------------------------------------------------------------------

export type SignatureRole = 'coordinator' | 'principal_investigator' | 'sub_investigator'

export type SignatureRequirement = {
  role: SignatureRole
  label: string
  required: boolean
  lockAfterSign?: boolean
}

export type AuditPolicy = {
  id: string
  immutableAfterSign: boolean
  requireReasonOnCorrection: boolean
  requireReasonOnAddendum: boolean
  brokenSignatureOnPostSignEdit: boolean
  eventTypes: AuditEventAction[]
}

export type AuditEventAction =
  | 'field_captured'
  | 'field_corrected'
  | 'field_addendum'
  | 'section_row_added'
  | 'section_row_removed'
  | 'section_disabled'
  | 'signature_applied'
  | 'signature_broken'
  | 'validation_executed'
  | 'source_locked'
  | 'source_submitted'

export type AuditEvent = {
  eventId: string
  sourceResponseSetId: string
  subjectId: string
  visitId?: string
  procedureExecutionId?: string
  userId: string
  userRole: string
  action: AuditEventAction
  fieldId?: string
  sectionId?: string
  previousValue?: unknown
  newValue?: unknown
  reason?: string
  timestampUtc: string
  signatureImpact?: 'none' | 'broken' | 'locked'
}

export type ValidationSeverity = 'info' | 'warning' | 'error' | 'critical'

export type ValidationResult = {
  fieldId?: string
  sectionId?: string
  repeatableSectionId?: string
  rowInstanceId?: string
  severity: ValidationSeverity
  code: string
  message: string
  blocksSubmission: boolean
  blocksSignature: boolean
  /** When true, coordinators may receive a workflow task even if severity is warning. */
  taskEligible?: boolean
}

// Re-export domain for convenience
export type { ClinicalDomain } from '@/lib/source-engine/definitions/domains'
