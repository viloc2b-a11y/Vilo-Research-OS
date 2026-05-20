/**
 * Vilo Engine — client layer (Zod + React Hook Form + Supabase domain tables).
 * Core catalog/rules live in @/lib/source-engine.
 */

import { initViloEngine } from '@/lib/source-engine/init'
import { buildViloDefaultValues, buildViloZodSchema } from '@/src/vilo-engine/zod-schemas'
import { VILO_DOMAIN_TABLES } from '@/src/vilo-engine/domain-tables'

export {
  buildViloDefaultValues,
  buildViloZodSchema,
  viloFormZodSchema,
  type ViloFormValues,
} from '@/src/vilo-engine/zod-schemas'

export {
  VILO_DOMAIN_TABLES,
  fieldSpecToColumn,
  groupFieldsByDomain,
  sourcePathToDomain,
  sourcePathToTable,
  type ViloDomainKey,
} from '@/src/vilo-engine/domain-tables'

export {
  useViloSourceForm,
  type UseViloSourceFormOptions,
  type UseViloSourceFormReturn,
  type ViloTriggerState,
} from '@/src/vilo-engine/use-vilo-form'

export { initViloEngine } from '@/lib/source-engine/init'

export {
  VILO_FIELD_CATALOG,
  DYNAMIC_TRIGGERS,
  BUSINESS_RULES,
  applyTriggerRules,
  evaluateBusinessRules,
  Domain,
  FieldType,
  QuerySeverity,
  SignatureState,
} from '@/lib/source-engine/legacy'

export type { BusinessRuleResult, FieldSpec, TriggerRule } from '@/lib/source-engine/legacy'

/** Quick bootstrap for React / Supabase capture shells. */
export function initViloEngineClient() {
  const bundle = initViloEngine()
  return {
    ...bundle,
    zodSchema: buildViloZodSchema(bundle.fields),
    defaultValues: buildViloDefaultValues(bundle.fields),
    domainTables: VILO_DOMAIN_TABLES,
  }
}
