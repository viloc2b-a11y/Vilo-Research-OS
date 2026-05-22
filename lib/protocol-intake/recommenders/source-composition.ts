import { getCanonicalLibraryFields } from '@/lib/source-engine/canonical-clinical-library'
import { evidenceRef } from '@/lib/protocol-intake/evidence'
import type { ExtractedProcedure } from '@/lib/protocol-intake/types'
import type { SourceCompositionRecommendation } from '@/lib/protocol-intake/types'

const CATEGORY_MAP: Record<
  string,
  { libraries: string[]; overlays: string[]; optionalFields?: string[]; excludeFields?: string[] }
> = {
  vitals: { libraries: ['VITALS_CORE_V1'], overlays: [] },
  adverse_events: { libraries: ['AE_CORE_V1'], overlays: [] },
  concomitant_medications: { libraries: ['CONMED_CORE_V1'], overlays: [] },
  ip_administration: { libraries: ['VITALS_CORE_V1', 'IP_ADMIN_CORE_V1'], overlays: [] },
  labs: { libraries: ['LAB_CORE_V1'], overlays: [] },
  ecg: { libraries: ['ECG_CORE_V1'], overlays: [] },
  physical_exam: { libraries: ['PHYSICAL_EXAM_CORE_V1'], overlays: [] },
  adrenal: {
    libraries: ['PHYSICAL_EXAM_CORE_V1'],
    overlays: ['PARA_ADRENAL_OVERLAY_V1'],
  },
  hit: { libraries: ['LAB_CORE_V1'], overlays: ['PARA_HIT_OVERLAY_V1'] },
  symptoms: { libraries: [], overlays: ['MV_HOUSEHOLD_SYMPTOM_OVERLAY_V1'] },
  swab: { libraries: ['LAB_CORE_V1'], overlays: ['MV_HOUSEHOLD_SYMPTOM_OVERLAY_V1'] },
}

function refineByProcedureName(
  name: string,
  category: string,
): { libraries: string[]; overlays: string[] } {
  const base = CATEGORY_MAP[category] ?? { libraries: ['VITALS_CORE_V1'], overlays: [] }
  const libraries = [...base.libraries]
  const overlays = [...base.overlays]

  if (/ACTH|adrenal|cortisol/i.test(name)) {
    if (!libraries.includes('LAB_CORE_V1')) libraries.push('LAB_CORE_V1')
    if (!overlays.includes('PARA_ADRENAL_OVERLAY_V1')) overlays.push('PARA_ADRENAL_OVERLAY_V1')
    if (!libraries.includes('PHYSICAL_EXAM_CORE_V1')) libraries.push('PHYSICAL_EXAM_CORE_V1')
  }
  if (/HIT|platelet|PF4|4T/i.test(name)) {
    if (!libraries.includes('LAB_CORE_V1')) libraries.push('LAB_CORE_V1')
    if (!overlays.includes('PARA_HIT_OVERLAY_V1')) overlays.push('PARA_HIT_OVERLAY_V1')
  }
  if (/symptom|sick|household|cough|COVID|influenza/i.test(name)) {
    if (!overlays.includes('MV_HOUSEHOLD_SYMPTOM_OVERLAY_V1')) {
      overlays.push('MV_HOUSEHOLD_SYMPTOM_OVERLAY_V1')
    }
  }
  if (/swab/i.test(name)) {
    if (!libraries.includes('LAB_CORE_V1')) libraries.push('LAB_CORE_V1')
  }

  return { libraries: [...new Set(libraries)], overlays: [...new Set(overlays)] }
}

export function recommendSourceComposition(
  procedures: ExtractedProcedure[],
): SourceCompositionRecommendation[] {
  return procedures.map((proc) => {
    const code = proc.procedure_code.value
    const name = proc.procedure_name.value
    const category = proc.procedure_category.value
    const map = refineByProcedureName(name, category)

    const include_fields: string[] = []
    const optional_fields: string[] = []
    const excluded_fields: string[] = ['linked_ae_id']
    const omission_reasons: Array<{ field_key: string; reason: string }> = []

    for (const lib of map.libraries) {
      for (const field of getCanonicalLibraryFields(lib)) {
        if (field.required_default) include_fields.push(field.field_key)
        else optional_fields.push(field.field_key)
      }
    }
    for (const overlay of map.overlays) {
      for (const field of getCanonicalLibraryFields(overlay)) {
        optional_fields.push(field.field_key)
      }
    }

    if (proc.conditional.value) {
      omission_reasons.push({
        field_key: '_procedure',
        reason: `Conditional procedure — instantiate when: ${proc.condition_text.value ?? 'coordinator confirms'}`,
      })
    }

    const confidence = proc.confidence
    const requires_human_review =
      proc.requires_human_review || map.libraries.length === 0

    return {
      procedure_code: code,
      recommended_library_blocks: map.libraries,
      recommended_overlays: map.overlays,
      include_fields: [...new Set(include_fields)],
      optional_fields: [...new Set(optional_fields)],
      excluded_fields,
      omission_reasons,
      evidence_refs: proc.source_evidence,
      confidence,
      requires_human_review,
    }
  })
}
