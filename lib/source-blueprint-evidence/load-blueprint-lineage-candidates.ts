import type { SupabaseClient } from '@supabase/supabase-js'
import type { BlueprintJson } from '@/lib/procedure-library/procedure-types'
import {
  LINEAGE_ELEMENT_TYPE,
  type BlueprintLineageCandidate,
} from './source-lineage-types'

function ruleArrayCandidates(
  rules: unknown,
  elementType: 'validation_rule' | 'completion_rule',
  prefix: string,
): BlueprintLineageCandidate[] {
  if (!Array.isArray(rules)) return []
  const out: BlueprintLineageCandidate[] = []
  for (let i = 0; i < rules.length; i++) {
    const item = rules[i]
    if (!item || typeof item !== 'object') continue
    const record = item as Record<string, unknown>
    const key = String(record.id ?? record.rule_id ?? record.requirement_id ?? `${prefix}_${i}`)
    const label = String(record.label ?? record.name ?? record.description ?? key)
    out.push({ elementType, elementKey: key, elementLabel: label })
  }
  return out
}

function signatureCandidates(signatureReqs: unknown): BlueprintLineageCandidate[] {
  if (!signatureReqs || typeof signatureReqs !== 'object') return []
  const record = signatureReqs as Record<string, unknown>
  if (Array.isArray(record.requirements)) {
    const out: BlueprintLineageCandidate[] = []
    for (let i = 0; i < record.requirements.length; i++) {
      const item = record.requirements[i]
      if (!item || typeof item !== 'object') continue
      const row = item as Record<string, unknown>
      const key = String(row.id ?? row.role ?? `signature_${i}`)
      out.push({
        elementType: LINEAGE_ELEMENT_TYPE.SIGNATURE_PLACEHOLDER,
        elementKey: key,
        elementLabel: String(row.label ?? row.role ?? key),
      })
    }
    return out
  }
  return Object.keys(record).map((key) => ({
    elementType: LINEAGE_ELEMENT_TYPE.SIGNATURE_PLACEHOLDER,
    elementKey: key,
    elementLabel: key,
  }))
}

export function buildLineageCandidatesFromBlueprint(
  blueprintJson: BlueprintJson,
  operationalRules: Record<string, unknown>,
): BlueprintLineageCandidate[] {
  const candidates: BlueprintLineageCandidate[] = []

  if (blueprintJson.instructions?.trim()) {
    candidates.push({
      elementType: LINEAGE_ELEMENT_TYPE.OPERATIONAL_INSTRUCTION,
      elementKey: 'blueprint.instructions',
      elementLabel: 'Blueprint instructions',
    })
  }
  if (blueprintJson.coordinator_guidance?.trim()) {
    candidates.push({
      elementType: LINEAGE_ELEMENT_TYPE.OPERATIONAL_INSTRUCTION,
      elementKey: 'blueprint.coordinator_guidance',
      elementLabel: 'Blueprint coordinator guidance',
    })
  }

  for (const section of blueprintJson.sections ?? []) {
    candidates.push({
      elementType: LINEAGE_ELEMENT_TYPE.SOURCE_SECTION,
      elementKey: section.section_id,
      elementLabel: section.title || section.section_id,
    })
    if (section.instructions?.trim()) {
      candidates.push({
        elementType: LINEAGE_ELEMENT_TYPE.OPERATIONAL_INSTRUCTION,
        elementKey: `${section.section_id}.instructions`,
        elementLabel: `${section.title} instructions`,
        parentSectionId: section.section_id,
      })
    }
    if (section.coordinator_guidance?.trim()) {
      candidates.push({
        elementType: LINEAGE_ELEMENT_TYPE.OPERATIONAL_INSTRUCTION,
        elementKey: `${section.section_id}.coordinator_guidance`,
        elementLabel: `${section.title} coordinator guidance`,
        parentSectionId: section.section_id,
      })
    }
    for (const field of section.fields ?? []) {
      candidates.push({
        elementType: LINEAGE_ELEMENT_TYPE.SOURCE_FIELD,
        elementKey: field.field_id,
        elementLabel: field.label || field.field_id,
        parentSectionId: section.section_id,
      })
    }
  }

  candidates.push(...signatureCandidates(blueprintJson.signature_requirements))
  candidates.push(
    ...ruleArrayCandidates(
      operationalRules.validation_rules,
      LINEAGE_ELEMENT_TYPE.VALIDATION_RULE,
      'validation',
    ),
  )
  candidates.push(
    ...ruleArrayCandidates(
      operationalRules.completion_rules ?? operationalRules.workflow_requirements,
      LINEAGE_ELEMENT_TYPE.COMPLETION_RULE,
      'completion',
    ),
  )

  return candidates
}

export async function loadBlueprintLineageCandidates(
  supabase: SupabaseClient,
  blueprintVersionId: string,
): Promise<BlueprintLineageCandidate[]> {
  const { data, error } = await supabase
    .from('procedure_blueprint_versions')
    .select('blueprint_json, operational_rules')
    .eq('id', blueprintVersionId)
    .maybeSingle()

  if (error) throw new Error(error.message)
  if (!data) throw new Error('Blueprint version not found.')

  const blueprintJson = (data.blueprint_json ?? { sections: [] }) as BlueprintJson
  const operationalRules = (data.operational_rules ?? {}) as Record<string, unknown>
  return buildLineageCandidatesFromBlueprint(blueprintJson, operationalRules)
}
