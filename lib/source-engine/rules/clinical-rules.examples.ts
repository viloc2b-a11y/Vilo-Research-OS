/**
 * Example declarative clinical rules — study-agnostic patterns from multi-study CRF analysis.
 */

import type { RuleDefinition } from '@/lib/source-engine/definitions/types'

export const CLINICAL_RULES_EXAMPLES: RuleDefinition[] = [
  // 1. WOCBP → show + require pregnancy test
  {
    id: 'RULE_WOCBP_PREGNANCY',
    label: 'WOCBP pregnancy test',
    when: {
      op: 'and',
      conditions: [
        { op: 'eq', contextKey: 'sexAtBirth', value: 'female' },
        { op: 'eq', contextKey: 'wocbp', value: true },
      ],
    },
    actions: [
      { type: 'SHOW', fieldId: 'pregnancy_test_type' },
      { type: 'SHOW', fieldId: 'pregnancy_test_result' },
      { type: 'SHOW', fieldId: 'pregnancy_collection_date' },
      { type: 'REQUIRE', fieldId: 'pregnancy_test_result' },
    ],
    priority: 10,
  },

  // 2. US/Canada cortisol gray zone → show ACTH stim
  {
    id: 'RULE_CORTISOL_GRAY_ZONE_ACTH',
    label: 'ACTH stim in gray zone (US/Canada)',
    when: {
      op: 'and',
      conditions: [
        { op: 'includes', contextKey: 'country', value: 'US' },
        { op: 'gt', fieldId: 'morning_cortisol', value: 3 },
        { op: 'lt', fieldId: 'morning_cortisol', value: 10 },
      ],
    },
    actions: [
      { type: 'SHOW', fieldId: 'acth_stim_time_0' },
      { type: 'SHOW', fieldId: 'acth_stim_30_min' },
      { type: 'SHOW', fieldId: 'acth_stim_60_min' },
    ],
    priority: 20,
  },

  // 3. Cortisol < 3 → require ACTH stim
  {
    id: 'RULE_CORTISOL_LOW_ACTH_REQUIRED',
    label: 'Low cortisol requires ACTH stimulation',
    when: { op: 'lt', fieldId: 'morning_cortisol', value: 3 },
    actions: [
      { type: 'SHOW', fieldId: 'acth_stim_time_0' },
      { type: 'SHOW', fieldId: 'acth_stim_30_min' },
      { type: 'SHOW', fieldId: 'acth_stim_60_min' },
      { type: 'REQUIRE', fieldId: 'acth_stim_30_min' },
      { type: 'REQUIRE', fieldId: 'acth_stim_60_min' },
    ],
    priority: 15,
  },

  // 4. Failed ACTH peak → synthetic steroid panel
  {
    id: 'RULE_ACTH_FAIL_STEROID_PANEL',
    label: 'Failed ACTH stim → steroid panel',
    when: {
      op: 'and',
      conditions: [
        { op: 'lt', fieldId: 'acth_stim_30_min', value: 18 },
        { op: 'lt', fieldId: 'acth_stim_60_min', value: 18 },
        { op: 'exists', fieldId: 'acth_stim_30_min' },
        { op: 'exists', fieldId: 'acth_stim_60_min' },
      ],
    },
    actions: [
      { type: 'SHOW', fieldId: 'synthetic_steroid_panel_required' },
      { type: 'REQUIRE', fieldId: 'synthetic_steroid_panel_required' },
    ],
    priority: 25,
  },

  // 5. HIT criteria → 4T, Anti-PF4, D-dimer, fibrinogen
  {
    id: 'RULE_HIT_WORKUP',
    label: 'HIT workup panel',
    when: {
      op: 'or',
      conditions: [
        { op: 'gte', fieldId: 'platelet_drop_percent', value: 30 },
        { op: 'lt', fieldId: 'platelet_count', value: 150000 },
        { op: 'eq', fieldId: 'thrombosis_suspected', value: true },
      ],
    },
    actions: [
      { type: 'SHOW', fieldId: 'four_t_score' },
      { type: 'SHOW', fieldId: 'anti_pf4' },
      { type: 'SHOW', fieldId: 'd_dimer' },
      { type: 'SHOW', fieldId: 'fibrinogen' },
      { type: 'REQUIRE', fieldId: 'four_t_score' },
      { type: 'REQUIRE', fieldId: 'anti_pf4' },
    ],
    priority: 30,
  },

  // 6. Anti-PF4 positive → serotonin release assay
  {
    id: 'RULE_HIT_SRA',
    label: 'Positive Anti-PF4 → SRA',
    when: { op: 'eq', fieldId: 'anti_pf4', value: 'positive' },
    actions: [
      { type: 'SHOW', fieldId: 'serotonin_release_assay' },
      { type: 'REQUIRE', fieldId: 'serotonin_release_assay' },
    ],
    priority: 35,
  },

  // 7. Age group — symptom fields (placeholder pediatric fields)
  {
    id: 'RULE_AGE_GROUP_SYMPTOMS',
    label: 'Age-specific symptom fields',
    when: { op: 'lt', contextKey: 'subjectAge', value: 18 },
    actions: [
      { type: 'SHOW', fieldId: 'rest_period_confirmed' },
      {
        type: 'FLAG',
        flagCode: 'PEDIATRIC_VISIT',
        message: 'Pediatric visit — confirm age-appropriate assessments.',
      },
    ],
    priority: 5,
  },

  // 8. PK substudy → PK section
  {
    id: 'RULE_PHARMACOKINETIC_SUBSTUDY_SECTION',
    label: 'Pharmacokinetic substudy section visibility',
    when: {
      op: 'or',
      conditions: [
        { op: 'eq', contextKey: 'isPharmacokineticSubstudy', value: true },
        { op: 'eq', fieldId: 'pharmacokinetic_substudy_participant', value: true },
      ],
    },
    actions: [{ type: 'SHOW', repeatableSectionId: 'pk_samples' }],
    priority: 12,
  },

  // 9. Phone/off-site → disable remote-incompatible procedures
  {
    id: 'RULE_REMOTE_VISIT_LIMITS',
    label: 'Remote visit procedure limits',
    when: {
      op: 'or',
      conditions: [
        { op: 'eq', contextKey: 'isPhoneVisit', value: true },
        { op: 'eq', contextKey: 'isOffSiteVisit', value: true },
      ],
    },
    actions: [
      { type: 'DISABLE', sectionId: 'physical_exam' },
      { type: 'DISABLE', sectionId: 'adrenal_testing' },
      { type: 'DISABLE', repeatableSectionId: 'labs' },
    ],
    priority: 40,
  },

  // 10. Signed/locked → disable editing
  {
    id: 'RULE_SIGNED_LOCKED_READONLY',
    label: 'Signed or locked source is read-only',
    when: {
      op: 'or',
      conditions: [
        { op: 'eq', contextKey: 'signatureState', value: 'signed' },
        { op: 'eq', contextKey: 'signatureState', value: 'locked' },
        { op: 'eq', contextKey: 'locked', value: true },
      ],
    },
    actions: [
      { type: 'DISABLE', sectionId: 'vital_signs' },
      { type: 'BLOCK_SIGNING' },
      {
        type: 'FLAG',
        flagCode: 'SOURCE_LOCKED',
        message: 'Source is signed or locked. Use correction or addendum workflow to edit.',
      },
    ],
    priority: 100,
  },
]

export const CLINICAL_RULES_BY_ID = new Map(
  CLINICAL_RULES_EXAMPLES.map((r) => [r.id, r]),
)

export function pickClinicalRules(ids: string[]): RuleDefinition[] {
  return ids.map((id) => CLINICAL_RULES_BY_ID.get(id)).filter((r): r is RuleDefinition => Boolean(r))
}
