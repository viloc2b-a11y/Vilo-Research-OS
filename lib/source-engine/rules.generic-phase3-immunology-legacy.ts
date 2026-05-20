/**
 * Generic Phase 3 immunology / endocrine — canonical BusinessRule + TriggerRule examples.
 */

import { Domain, QuerySeverity, type BusinessRule, type TriggerRule } from '@/lib/source-engine/canonical'

const CORTISOL_LOW = 3
const CORTISOL_STIM_MAX = 10
const PLATELET_LOW = 150_000
const PLATELET_DROP_PCT = 30

export const GENERIC_PHASE3_IMMUNOLOGY_LEGACY_TRIGGER_RULES: TriggerRule[] = [
  {
    triggerField: 'sex',
    triggerValue: 'female',
    action: 'SHOW',
    targetField: 'pregnancy.pregnancy_test_result',
  },
  {
    triggerField: 'adrenal.morning_cortisol_ug_dl',
    triggerValue: 2,
    action: 'SHOW',
    targetField: 'adrenal.acth_stimulation_performed',
  },
  {
    triggerField: 'hit.platelet_count_current',
    triggerValue: 120_000,
    action: 'SHOW',
    targetField: 'hit.four_t_score',
  },
  {
    triggerField: 'hit.anti_pf4_result',
    triggerValue: 'positive',
    action: 'SHOW',
    targetField: 'hit.serotonin_release_assay_ordered',
  },
  {
    triggerField: 'pharmacokineticSubstudyParticipant',
    triggerValue: true,
    action: 'SHOW',
    targetField: 'pk.pk_sample_collected',
  },
  {
    triggerField: 'vitals.weight',
    triggerValue: null,
    action: 'CALCULATE',
    targetField: 'vitals.bmi',
    calculation: (ctx) => {
      const h = ctx['vitals.height'] as { value?: number } | number | undefined
      const w = ctx['vitals.weight'] as { value?: number } | number | undefined
      const heightCm = typeof h === 'object' && h?.value != null ? h.value : (h as number)
      const weightKg = typeof w === 'object' && w?.value != null ? w.value : (w as number)
      if (heightCm == null || weightKg == null || heightCm <= 0) return null
      const heightM = heightCm > 3 ? heightCm / 100 : heightCm
      return Math.round((weightKg / (heightM * heightM)) * 10) / 10
    },
  },
]

export const GENERIC_PHASE3_IMMUNOLOGY_LEGACY_BUSINESS_RULES: BusinessRule[] = [
  {
    id: 'wocbp_pregnancy_required',
    severity: QuerySeverity.ERROR,
    message: 'Pregnancy test required for WOCBP',
    condition: (ctx) =>
      ctx.sex === 'female' &&
      ctx.wocbp === true &&
      (ctx['pregnancy.pregnancy_test_result'] == null ||
        ctx['pregnancy.pregnancy_test_result'] === 'not_done'),
  },
  {
    id: 'cortisol_low_acth',
    severity: QuerySeverity.CRITICAL,
    message: `Morning cortisol < ${CORTISOL_LOW} µg/dL — ACTH stimulation required`,
    condition: (ctx) => {
      const c = ctx['adrenal.morning_cortisol_ug_dl'] as number | undefined
      return c != null && c < CORTISOL_LOW
    },
  },
  {
    id: 'cortisol_indeterminate_acth',
    severity: QuerySeverity.WARNING,
    message: `Morning cortisol indeterminate (${CORTISOL_LOW}–${CORTISOL_STIM_MAX}) — consider ACTH stim (US/Canada)`,
    condition: (ctx) => {
      const c = ctx['adrenal.morning_cortisol_ug_dl'] as number | undefined
      const region = ctx.region as string | undefined
      const usCanada = ['US', 'CA', 'United States', 'Canada'].includes(region ?? '')
      return (
        usCanada &&
        c != null &&
        c >= CORTISOL_LOW &&
        c < CORTISOL_STIM_MAX
      )
    },
  },
  {
    id: 'hit_monitoring_pathway',
    severity: QuerySeverity.WARNING,
    message: 'Platelet drop / thrombosis — complete 4T, Anti-PF4, coagulation panel',
    condition: (ctx) => {
      const current = ctx['hit.platelet_count_current'] as number | undefined
      const drop = ctx['hit.platelet_drop_percent'] as number | undefined
      return (
        (drop != null && drop >= PLATELET_DROP_PCT) ||
        (current != null && current < PLATELET_LOW) ||
        ctx['hit.thrombosis_suspected'] === true
      )
    },
  },
  {
    id: 'anti_pf4_positive_sra',
    severity: QuerySeverity.WARNING,
    message: 'Anti-PF4 positive — order serotonin release assay',
    condition: (ctx) => ctx['hit.anti_pf4_result'] === 'positive',
  },
  {
    id: 'pregnancy_positive',
    severity: QuerySeverity.CRITICAL,
    message: 'Positive pregnancy test — review eligibility',
    condition: (ctx) => ctx['pregnancy.pregnancy_test_result'] === 'positive',
  },
]

/** Example domain coverage for catalog alignment */
export const GENERIC_PHASE3_IMMUNOLOGY_LEGACY_DOMAIN_SET: Domain[] = [
  Domain.VITALS,
  Domain.PREGNANCY,
  Domain.LABS_CENTRAL,
  Domain.FINDINGS,
  Domain.PLASMA,
]
