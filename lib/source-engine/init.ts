/**
 * Quick bootstrap for React / Supabase clients — loads catalog + dynamic rules.
 */

import type { BusinessRule, FieldSpec, TriggerRule } from '@/lib/source-engine/canonical'
import { BUSINESS_RULES, DYNAMIC_TRIGGERS } from '@/lib/source-engine/vilo-dynamic-rules'
import { VILO_FIELD_CATALOG } from '@/lib/source-engine/vilo-field-catalog'

export type ViloEngineInit = {
  fields: FieldSpec[]
  triggers: TriggerRule[]
  rules: BusinessRule[]
}

/** Log catalog size and return fields, triggers, and business rules for wiring capture UI. */
export function initViloEngine(): ViloEngineInit {
  console.log(
    '✅ Vilo OS Source Engine initialized with',
    VILO_FIELD_CATALOG.length,
    'fields',
  )
  console.log(
    '⚡ Loaded',
    DYNAMIC_TRIGGERS.length,
    'triggers &',
    BUSINESS_RULES.length,
    'business rules',
  )
  return {
    fields: VILO_FIELD_CATALOG,
    triggers: DYNAMIC_TRIGGERS,
    rules: BUSINESS_RULES,
  }
}
