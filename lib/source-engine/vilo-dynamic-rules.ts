/**
 * Vilo dynamic form routing + business validation rules.
 * Runtime-only calculations use flat field ids on rule context (see sourceContextToRuleContext).
 */

import {
  QuerySeverity,
  SignatureState,
  type BusinessRule,
  type TriggerRule,
} from '@/lib/source-engine/canonical'

/** Dynamic form routing — visibility and derived fields. */
export const DYNAMIC_TRIGGERS: TriggerRule[] = [
  {
    triggerField: 'sex',
    triggerValue: 'Female',
    action: 'SHOW',
    targetField: 'childbearing_potential',
  },
  {
    triggerField: 'childbearing_potential',
    triggerValue: 'Yes',
    action: 'SHOW',
    targetField: 'pregnancy_test_result',
  },
  {
    triggerField: 'weight_kg',
    triggerValue: null,
    action: 'CALCULATE',
    targetField: 'bmi',
    calculation: (ctx) => {
      const w = ctx.weight_kg as number | undefined
      const hCm = ctx.height_cm as number | undefined
      if (w == null || hCm == null || hCm <= 0) return null
      const h = hCm / 100
      return Number((w / (h * h)).toFixed(2))
    },
  },
  {
    triggerField: 'bbps_right',
    triggerValue: null,
    action: 'CALCULATE',
    targetField: 'bbps_total',
    calculation: (ctx) => {
      const parts = [ctx.bbps_right, ctx.bbps_transverse, ctx.bbps_left]
      const nums = parts
        .filter((v) => v !== null && v !== undefined && v !== '')
        .map((v) => Number(v))
      if (nums.length === 0) return null
      return nums.reduce((sum, v) => sum + v, 0)
    },
  },
]

/** Business validation — queries, auto-resolve side effects. */
export const VILO_BUSINESS_RULES: BusinessRule[] = [
  {
    id: 'HEMOLYSIS_REJECT',
    severity: QuerySeverity.CRITICAL,
    condition: (ctx) => ctx.hemolysis_grade === '4_HEMOLYZED',
    message: 'Muestra rechazada: Hemólisis grado 4. No apta para cfDNA.',
    autoResolve: (ctx) => {
      ctx.sample_status = 'REJECTED'
    },
  },
  {
    id: 'BBPS_INADEQUATE',
    severity: QuerySeverity.WARNING,
    condition: (ctx) => {
      const nums = [ctx.bbps_right, ctx.bbps_transverse, ctx.bbps_left]
        .filter((v) => v != null && v !== '')
        .map((v) => Number(v))
      if (nums.length === 0) return false
      const total = nums.reduce((sum, v) => sum + v, 0)
      return total < 6
    },
    message:
      'Preparación intestinal inadecuada (BBPS < 6). Considere reprogramar o documentar desviación.',
  },
  {
    id: 'IP_KIT_DUPLICATE',
    severity: QuerySeverity.ERROR,
    condition: (ctx, allContexts) => {
      if (!allContexts?.length || ctx.ip_kit_id == null || ctx.ip_kit_id === '') {
        return false
      }
      return allContexts.filter((c) => c.ip_kit_id === ctx.ip_kit_id).length > 1
    },
    message: 'Kit IP duplicado detectado en múltiples registros.',
  },
  {
    id: 'SIGNATURE_BREAK_ON_EDIT',
    severity: QuerySeverity.WARNING,
    condition: (ctx) =>
      ctx.signature_state === SignatureState.SIGNED && ctx.is_edit_mode === true,
    message:
      'Edición detectada post-firma. Firma electrónica rota. Requiere re-firma del PI.',
    autoResolve: (ctx) => {
      ctx.signature_state = SignatureState.BROKEN
    },
  },
]

/** @deprecated Use VILO_BUSINESS_RULES */
export const BUSINESS_RULES = VILO_BUSINESS_RULES
