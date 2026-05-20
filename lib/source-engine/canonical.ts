/**
 * Canonical Source Engine contract — study-configurable field specs and rules.
 * Serializable configs use rule IDs; runtime-only rules may attach functions.
 */

export enum FieldType {
  TEXT = 'TEXT',
  NUMBER = 'NUMBER',
  DATE = 'DATE',
  TIME = 'TIME',
  BOOLEAN = 'BOOLEAN',
  ENUM = 'ENUM',
  ENUM_ARRAY = 'ENUM_ARRAY',
  FILE = 'FILE',
}

export enum Domain {
  DEMO = 'DEMO',
  ELIGIBILITY = 'ELIGIBILITY',
  MH = 'MH',
  CM = 'CM',
  AE = 'AE',
  SAE = 'SAE',
  VITALS = 'VITALS',
  LABS_LOCAL = 'LABS_LOCAL',
  LABS_CENTRAL = 'LABS_CENTRAL',
  PROCEDURES = 'PROCEDURES',
  FINDINGS = 'FINDINGS',
  TNM = 'TNM',
  PLASMA = 'PLASMA',
  PROS = 'PROS',
  PREGNANCY = 'PREGNANCY',
  IRT_SUPPLY = 'IRT_SUPPLY',
  SITE_COMPLIANCE = 'SITE_COMPLIANCE',
}

export enum QuerySeverity {
  WARNING = 'WARNING',
  ERROR = 'ERROR',
  CRITICAL = 'CRITICAL',
}

export enum SignatureState {
  UNSIGNED = 'UNSIGNED',
  SIGNED = 'SIGNED',
  BROKEN = 'BROKEN',
  LOCKED = 'LOCKED',
}

export type TriggerActionType = 'SHOW' | 'HIDE' | 'ENABLE' | 'DISABLE' | 'CALCULATE'

export interface FieldSpecValidation {
  min?: number
  max?: number
  /** Serializable pattern (preferred for published configs) */
  pattern?: string
  /** Runtime-only; not persisted in JSON packages */
  patternRegex?: RegExp
  message?: string
  custom?: (val: unknown, ctx: Record<string, unknown>) => boolean
}

export interface FieldSpec {
  id: string
  domain: Domain
  label: string
  type: FieldType
  required: boolean
  options?: string[]
  validation?: FieldSpecValidation
  conditional?: { dependsOn: string; equals: unknown }
  /** Dot-path into rule context, e.g. `vitals.systolic_bp` */
  sourcePath: string
}

export interface TriggerRule {
  triggerField: string
  triggerValue: unknown
  action: TriggerActionType
  targetField?: string
  /** Runtime-only derived value */
  calculation?: (ctx: Record<string, unknown>) => unknown
}

/** Optional `allContexts` supports cross-record rules (e.g. duplicate kit ID). */
export type BusinessRuleCondition = (
  ctx: Record<string, unknown>,
  allContexts?: Record<string, unknown>[],
) => boolean

export interface BusinessRule {
  id: string
  severity: QuerySeverity
  condition: BusinessRuleCondition
  message: string
  autoResolve?: (ctx: Record<string, unknown>) => void
}

export interface BusinessRuleResult {
  ruleId: string
  severity: QuerySeverity
  message: string
  fired: boolean
}
