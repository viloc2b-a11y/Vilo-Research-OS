/**
 * Repeatable section definitions — ConMeds, AEs, MH, Labs, PK, etc.
 */

import type { RepeatableSectionDefinition } from '@/lib/source-engine/definitions/types'
import {
  ADVERSE_EVENT_ROW_FIELDS,
  CONMED_ROW_FIELDS,
  LAB_ROW_FIELDS,
  MEDICAL_HISTORY_ROW_FIELDS,
  PK_ROW_FIELDS,
} from '@/lib/source-engine/definitions/field.catalog'

function repeatable(
  def: Omit<RepeatableSectionDefinition, 'childFieldIds'> & { childFieldIds?: string[] },
  fields: { id: string }[],
): RepeatableSectionDefinition {
  return {
    ...def,
    childFieldIds: def.childFieldIds ?? fields.map((f) => f.id),
  }
}

export const MEDICAL_HISTORY_SECTION: RepeatableSectionDefinition = repeatable(
  {
    id: 'medical_history',
    label: 'Medical History',
    domain: 'medical_history',
    entityType: 'medical_history_entry',
    minRows: 0,
    maxRows: 50,
    addLabel: 'Add condition',
    allowAdd: true,
    allowRemove: true,
    allowDisable: true,
    allowPartialCompletion: true,
    sectionRuleIds: ['RULE_MH_PARTIAL'],
  },
  MEDICAL_HISTORY_ROW_FIELDS,
)

export const CONCOMITANT_MEDICATIONS_SECTION: RepeatableSectionDefinition = repeatable(
  {
    id: 'concomitant_medications',
    label: 'Concomitant Medications',
    domain: 'concomitant_medications',
    entityType: 'conmed_entry',
    minRows: 0,
    maxRows: 100,
    addLabel: 'Add medication',
    allowAdd: true,
    allowRemove: true,
    allowDisable: true,
    allowPartialCompletion: true,
    sectionRuleIds: ['RULE_CONMED_AE_LINK'],
  },
  CONMED_ROW_FIELDS,
)

export const ADVERSE_EVENTS_SECTION: RepeatableSectionDefinition = repeatable(
  {
    id: 'adverse_events',
    label: 'Adverse Events',
    domain: 'adverse_events',
    entityType: 'adverse_event',
    minRows: 0,
    maxRows: 100,
    addLabel: 'Add adverse event',
    allowAdd: true,
    allowRemove: true,
    allowDisable: false,
    allowPartialCompletion: false,
    sectionRuleIds: ['RULE_AE_RESOLVED_END_DATE', 'RULE_SAE_CRITERIA'],
  },
  ADVERSE_EVENT_ROW_FIELDS,
)

export const PRIOR_PROCEDURES_SECTION: RepeatableSectionDefinition = repeatable(
  {
    id: 'prior_procedures',
    label: 'Prior Procedures',
    domain: 'medical_history',
    entityType: 'prior_procedure',
    minRows: 0,
    maxRows: 30,
    addLabel: 'Add procedure',
    allowAdd: true,
    allowRemove: true,
    allowDisable: true,
    allowPartialCompletion: true,
    childFieldIds: ['condition_term', 'mh_start_date', 'mh_end_date'],
  },
  [],
)

export const LABS_SECTION: RepeatableSectionDefinition = repeatable(
  {
    id: 'labs',
    label: 'Laboratory Results',
    domain: 'labs',
    entityType: 'lab_result',
    minRows: 0,
    maxRows: 200,
    addLabel: 'Add lab result',
    allowAdd: true,
    allowRemove: true,
    allowDisable: true,
    allowPartialCompletion: true,
  },
  LAB_ROW_FIELDS,
)

export const PK_SAMPLES_SECTION: RepeatableSectionDefinition = repeatable(
  {
    id: 'pk_samples',
    label: 'PK Samples',
    domain: 'pk_sampling',
    entityType: 'pk_sample',
    minRows: 0,
    maxRows: 50,
    addLabel: 'Add PK sample',
    allowAdd: true,
    allowRemove: true,
    allowDisable: true,
    allowPartialCompletion: true,
    sectionRuleIds: ['RULE_PHARMACOKINETIC_SUBSTUDY_SECTION'],
  },
  PK_ROW_FIELDS,
)

export const RESPIRATORY_SAMPLES_SECTION: RepeatableSectionDefinition = repeatable(
  {
    id: 'respiratory_samples',
    label: 'Respiratory Samples',
    domain: 'respiratory_samples',
    entityType: 'respiratory_sample',
    minRows: 0,
    maxRows: 20,
    addLabel: 'Add sample',
    allowAdd: true,
    allowRemove: true,
    allowDisable: true,
    allowPartialCompletion: true,
    childFieldIds: ['specimen_type', 'collection_date', 'collection_time', 'result_value'],
  },
  [],
)

export const REPEATABLE_SECTION_CATALOG: RepeatableSectionDefinition[] = [
  MEDICAL_HISTORY_SECTION,
  CONCOMITANT_MEDICATIONS_SECTION,
  ADVERSE_EVENTS_SECTION,
  PRIOR_PROCEDURES_SECTION,
  LABS_SECTION,
  PK_SAMPLES_SECTION,
  RESPIRATORY_SAMPLES_SECTION,
]

const repeatableById = new Map(REPEATABLE_SECTION_CATALOG.map((s) => [s.id, s]))

export function getRepeatableSection(id: string): RepeatableSectionDefinition | undefined {
  return repeatableById.get(id)
}
