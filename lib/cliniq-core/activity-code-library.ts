import type { SupabaseClient } from '@supabase/supabase-js'
import { z } from 'zod'

export type ActivityCodeCategory =
  | 'clinical'
  | 'operational'
  | 'regulatory'
  | 'financial'
  | 'conditional'

export type ActivityCodeUnit =
  | 'per_visit'
  | 'per_hour'
  | 'per_patient'
  | 'flat'
  | 'per_event'

export type ActivityCodeEntry = {
  id: string
  code: string
  name: string
  category: ActivityCodeCategory
  sub_category: string | null
  typical_unit: ActivityCodeUnit
  fmv_low: number | null
  fmv_high: number | null
  organization_id: string | null
  notes: string | null
}

const SELECT_COLS =
  'id, code, name, category, sub_category, typical_unit, fmv_low, fmv_high, organization_id, notes'

const ACTIVITY_CODE_CATEGORIES = [
  'clinical',
  'operational',
  'regulatory',
  'financial',
  'conditional',
] as const

const ACTIVITY_CODE_UNITS = [
  'per_visit',
  'per_hour',
  'per_patient',
  'flat',
  'per_event',
] as const

const toStringOrEmpty = (v: unknown): string => (v == null ? '' : String(v))

// Zod schema for an untrusted activity_code_library row coming from Supabase.
// Unknown/invalid enum values and non-string/number fields degrade to safe
// defaults (never throws), keeping a malformed row from breaking the catalog.
const activityCodeRowSchema = z.object({
  id: z.preprocess(toStringOrEmpty, z.string()),
  code: z.preprocess(toStringOrEmpty, z.string()),
  name: z.preprocess(toStringOrEmpty, z.string()),
  category: z.enum(ACTIVITY_CODE_CATEGORIES).catch('clinical'),
  sub_category: z.string().nullable().catch(null),
  typical_unit: z.enum(ACTIVITY_CODE_UNITS).catch('flat'),
  fmv_low: z.number().nullable().catch(null),
  fmv_high: z.number().nullable().catch(null),
  organization_id: z.string().nullable().catch(null),
  notes: z.string().nullable().catch(null),
})

function mapRow(row: unknown): ActivityCodeEntry {
  return activityCodeRowSchema.parse(row)
}

// Access control: the `activity_code_library` table is governed by RLS
// (migration 0222) — global rows (organization_id IS NULL) are readable by any
// authenticated user and immutable from the client; org rows are readable only
// by active members of `organization_id`. This loader reads only; the catalog
// is a non-identifiable FMV reference set (no subject/PHI data).
export async function loadActivityCodeCatalog(
  supabase: SupabaseClient,
  organizationId: string,
  unavailable?: string[],
): Promise<ActivityCodeEntry[]> {
  try {
    const [globalRes, orgRes] = await Promise.all([
      supabase.from('activity_code_library').select(SELECT_COLS).is('organization_id', null),
      supabase
        .from('activity_code_library')
        .select(SELECT_COLS)
        .eq('organization_id', organizationId),
    ])

    if (globalRes.error) {
      unavailable?.push(`Activity code library (global): ${globalRes.error.message}`)
      return []
    }
    if (orgRes.error) {
      unavailable?.push(`Activity code library (org): ${orgRes.error.message}`)
      return []
    }

    const map = new Map<string, ActivityCodeEntry>()
    for (const row of globalRes.data ?? []) {
      const entry = mapRow(row)
      map.set(entry.code, entry)
    }
    for (const row of orgRes.data ?? []) {
      const entry = mapRow(row)
      map.set(entry.code, entry) // org row wins over global
    }

    return Array.from(map.values()).sort((a, b) => {
      const catCmp = a.category.localeCompare(b.category)
      return catCmp !== 0 ? catCmp : a.name.localeCompare(b.name)
    })
  } catch (err) {
    unavailable?.push(
      `Activity code library: ${err instanceof Error ? err.message : 'unavailable'}`,
    )
    return []
  }
}
