/**
 * Vilo OS Source Engine — configurable clinical source / CRF types.
 * Pure configuration + rule evaluation. Persistence lives in Supabase / existing runtime.
 *
 * Canonical contract (FieldType enum, Domain, FieldSpec): `./canonical.ts`
 */

export type {
  BusinessRule,
  BusinessRuleResult,
  Domain,
  FieldSpec,
  FieldSpecValidation,
  QuerySeverity,
  SignatureState,
  TriggerActionType,
  TriggerRule,
} from '@/lib/source-engine/canonical'

// ---------------------------------------------------------------------------
// Widget / capture-layer field types (maps to canonical FieldType via adapters)
// ---------------------------------------------------------------------------

export type SourceWidgetType =
  | 'text'
  | 'textarea'
  | 'number'
  | 'integer'
  | 'decimal'
  | 'date'
  | 'datetime'
  | 'time'
  | 'boolean'
  | 'select'
  | 'multiselect'
  | 'radio'
  | 'checkbox'
  | 'calculated'
  | 'unit_value'
  | 'signature'
  | 'file_upload'

export type ClinicalDomain =
  | 'demographics'
  | 'informed_consent'
  | 'medical_history'
  | 'concomitant_medications'
  | 'vital_signs'
  | 'physical_exam'
  | 'pregnancy_testing'
  | 'labs'
  | 'urinalysis'
  | 'ecg'
  | 'adverse_events'
  | 'rescue_medication'
  | 'questionnaires'
  | 'respiratory_samples'
  | 'biospecimens'
  | 'investigational_product'
  | 'injection_site'
  | 'ophthalmology'
  | 'adrenal_testing'
  | 'hit_monitoring'
  | 'pk_sampling'
  | 'ediary'

export type SelectOption = {
  value: string
  label: string
}

/** Zod-compatible validation metadata (consumers map to Zod schemas). */
export type FieldValidationRule =
  | { kind: 'required'; message: string }
  | { kind: 'min'; value: number; message: string }
  | { kind: 'max'; value: number; message: string }
  | { kind: 'minLength'; value: number; message: string }
  | { kind: 'maxLength'; value: number; message: string }
  | { kind: 'regex'; pattern: string; message: string }
  | { kind: 'enum'; values: string[]; message: string }
  | { kind: 'custom'; ruleId: string; message: string; params?: Record<string, unknown> }

export type ConditionOperator =
  | 'eq'
  | 'neq'
  | 'gt'
  | 'gte'
  | 'lt'
  | 'lte'
  | 'in'
  | 'not_in'
  | 'exists'
  | 'not_exists'
  | 'and'
  | 'or'

/** Reads from flat field responses and/or runtime context keys. */
export type FieldCondition =
  | {
      op: Exclude<ConditionOperator, 'and' | 'or'>
      /** Field key in flat responses map */
      fieldKey?: string
      /** Dot-path into SourceRuntimeContext (e.g. "sex", "config.cortisol.lowThresholdUgDl") */
      contextKey?: string
      value?: unknown
    }
  | { op: 'and' | 'or'; conditions: FieldCondition[] }

export type DerivedFormulaId =
  | 'bmi'
  | 'pack_years'
  | 'cas_score'
  | 'transit_time'
  | 'blood_pressure_display'
  | 'visit_window_status'

export type DerivedCalculation = {
  targetFieldKey: string
  formula: DerivedFormulaId
  /** Source field keys required for calculation */
  inputs: string[]
}

export type FieldDefinition = {
  key: string
  label: string
  type: SourceWidgetType
  domain: ClinicalDomain
  /** Canonical dot-path, e.g. `vitals.systolic_bp` */
  sourcePath?: string
  unit?: string
  options?: SelectOption[]
  instructions?: string
  validation?: FieldValidationRule[]
  visibleWhen?: FieldCondition
  requiredWhen?: FieldCondition
  disabledWhen?: FieldCondition
  derivedFrom?: DerivedCalculation
  /** Hint for downstream Zod builder: z.string(), z.number(), etc. */
  zodSchemaHint?: string
  defaultValue?: unknown
}

export type TriggerAction =
  | { type: 'show_section'; sectionKey: string }
  | { type: 'hide_section'; sectionKey: string }
  | { type: 'require_section'; sectionKey: string }
  | { type: 'show_field'; fieldKey: string }
  | { type: 'hide_field'; fieldKey: string }
  | { type: 'require_field'; fieldKey: string }
  | { type: 'workflow'; workflowKind: string; title: string }
  | { type: 'finding'; severity: 'info' | 'warning' | 'error'; message: string; fieldKey?: string }

export type ConditionalTrigger = {
  id: string
  label: string
  when: FieldCondition
  actions: TriggerAction[]
}

export type SignatureRole = 'coordinator' | 'principal_investigator' | 'sub_investigator'

export type SignatureRequirement = {
  role: SignatureRole
  label: string
  requiredWhen?: FieldCondition
  lockSectionOnSign?: boolean
}

export type SourceSectionDefinition = {
  key: string
  label: string
  domain?: ClinicalDomain
  instructions?: string
  fields: FieldDefinition[]
  /** Coordinator may add/remove this section when partial */
  partial?: boolean
  /** Section supports multiple instances (e.g. repeated AE rows) */
  repeatable?: boolean
  minInstances?: number
  maxInstances?: number
  enabledByDefault?: boolean
  visibleWhen?: FieldCondition
  signatures?: SignatureRequirement[]
  lockAfterSignature?: boolean
}

export type CortisolEngineConfig = {
  /** Morning cortisol < this (µg/dL) → ACTH stimulation required */
  lowThresholdUgDl: number
  /** US/Canada: optional stim if cortisol in (low, stimRangeMax) */
  stimRangeMinUgDl: number
  stimRangeMaxUgDl: number
  /** Peak cortisol after stim < this → failed stim */
  acthPeakFailureUgDl: number
  /** Peak < this → synthetic steroid panel */
  steroidPanelCutoffUgDl: number
  usCanadaRegions: string[]
}

export type HitEngineConfig = {
  plateletDropPercent: number
  plateletLowPerUl: number
}

export type StudyEngineConfig = {
  cortisol?: CortisolEngineConfig
  hit?: HitEngineConfig
}

export type SourceTemplateDefinition = {
  id: string
  label: string
  version: string
  protocolRef?: string
  sections: SourceSectionDefinition[]
  triggers: ConditionalTrigger[]
  config?: StudyEngineConfig
}

export type VisitTypeKind = 'onsite' | 'phone' | 'off_site' | 'unscheduled'

export type SubjectRoleKind = 'index_patient' | 'household_contact'

export type AgeGroupKind = 'pediatric' | 'adult' | 'geriatric'

export type VisitWindowStatusKind = 'in_window' | 'out_of_window' | 'missed'

export type SectionSignatureState = {
  coordinator?: boolean
  principal_investigator?: boolean
  sub_investigator?: boolean
}

export type SourceRuntimeContext = {
  visitType?: VisitTypeKind
  visitWindowStatus?: VisitWindowStatusKind
  region?: string
  sex?: 'male' | 'female' | 'other' | 'unknown'
  wocbp?: boolean
  ageGroup?: AgeGroupKind
  pharmacokineticSubstudyParticipant?: boolean
  subjectRole?: SubjectRoleKind
  /** Flat map of all captured field values for condition evaluation */
  responses: Record<string, FieldResponseValue>
  sectionSignatures?: Record<string, SectionSignatureState>
  /** Sections explicitly disabled for this visit/instance */
  disabledSectionKeys?: string[]
  /** Active instance keys for repeatable sections */
  activeSectionInstances?: Record<string, number>
  correctionMode?: boolean
  addendumMode?: boolean
  config?: StudyEngineConfig
  /** Visit scheduling anchors for window derivation */
  visitTargetDay?: number | null
  visitActualDay?: number | null
  windowStartDay?: number | null
  windowEndDay?: number | null
}

export type UnitValue = {
  value: number
  unit: string
}

export type FieldResponseValue =
  | string
  | number
  | boolean
  | null
  | UnitValue
  | string[]

export type FieldRuntimeState = {
  visible: boolean
  required: boolean
  disabled: boolean
  locked: boolean
  calculatedValue?: FieldResponseValue
}

export type SourceValidationFinding = {
  fieldKey?: string
  sectionKey?: string
  severity: 'info' | 'warning' | 'error'
  message: string
  ruleId?: string
}

export type SourceValidationResult = {
  valid: boolean
  fieldErrors: Record<string, string[]>
  sectionErrors: Record<string, string[]>
  findings: SourceValidationFinding[]
}

export type TriggerEvaluationResult = {
  firedTriggers: string[]
  actions: TriggerAction[]
}

export type AuditEventType =
  | 'field_captured'
  | 'field_corrected'
  | 'field_addendum'
  | 'section_enabled'
  | 'section_disabled'
  | 'section_signed'
  | 'validation_executed'
  | 'template_submitted'
