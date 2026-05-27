import type { SupabaseClient } from '@supabase/supabase-js'
import { loadBlueprintLineageCandidates } from './load-blueprint-lineage-candidates'
import type { LineageMappingInput } from './source-lineage-types'

export async function validateLineageElementsInBlueprint(
  supabase: SupabaseClient,
  blueprintVersionId: string,
  mappings: LineageMappingInput[],
): Promise<void> {
  if (mappings.length === 0) return

  const candidates = await loadBlueprintLineageCandidates(supabase, blueprintVersionId)
  const candidateKeys = new Set(
    candidates.map((c) => `${c.elementType}:${c.elementKey}`),
  )

  for (const mapping of mappings) {
    const key = `${mapping.elementType}:${mapping.elementKey}`
    if (!candidateKeys.has(key)) {
      throw new Error(
        `Blueprint element not found: ${mapping.elementType} "${mapping.elementKey}"`,
      )
    }
  }
}
