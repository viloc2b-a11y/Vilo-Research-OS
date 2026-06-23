import type { SupabaseClient } from '@supabase/supabase-js'
import { z } from 'zod'

// ── Types ────────────────────────────────────────────────────────────────────

export const SYSTEM_LIBRARY_CATEGORIES = [
  'Data Capture',
  'Randomization',
  'Patient Technology',
  'Labs',
  'Imaging',
  'Safety',
  'Payments',
  'Training',
  'Regulatory',
  'Recruitment',
  'Sponsor Portal',
  'CRO Portal',
  'Other',
] as const

export type SystemLibraryCategory = (typeof SYSTEM_LIBRARY_CATEGORIES)[number]

export type SystemLibraryEntry = {
  system_id: string
  system_name: string
  vendor_name: string
  system_type: string
  system_category: SystemLibraryCategory
  default_url: string | null
  support_url: string | null
  training_url: string | null
  is_sso_capable: boolean
  active: boolean
}

export type SystemLibrarySortField = 'system_name' | 'vendor_name' | 'system_type' | 'system_category'

export type SystemLibraryOptions = {
  /** Only return systems with this type (e.g. "EDC", "IRT") */
  type?: string
  /** Only return systems in this category */
  category?: SystemLibraryCategory
  /** Filter by active status. Defaults to true */
  active?: boolean
  /** Sort field. Defaults to system_name */
  sortBy?: SystemLibrarySortField
  /** Sort direction. Defaults to 'asc' */
  sortDir?: 'asc' | 'desc'
}

// ── Constants ─────────────────────────────────────────────────────────────────

const SELECT_COLS =
  'system_id, system_name, vendor_name, system_type, system_category, default_url, support_url, training_url, is_sso_capable, active'

// ── Zod schema ────────────────────────────────────────────────────────────────
// Degrades gracefully: unknown/invalid values get safe defaults so a single
// malformed row never breaks the entire catalog.

const toStringOrEmpty = (v: unknown): string => (v == null ? '' : String(v))
const toBoolean = (v: unknown): boolean => (v === true || v === 'true')

const systemLibraryRowSchema = z.object({
  system_id: z.preprocess(toStringOrEmpty, z.string()),
  system_name: z.preprocess(toStringOrEmpty, z.string()),
  vendor_name: z.preprocess(toStringOrEmpty, z.string()),
  system_type: z.preprocess(toStringOrEmpty, z.string()),
  system_category: z.enum(SYSTEM_LIBRARY_CATEGORIES).catch('Other'),
  default_url: z.string().nullable().catch(null),
  support_url: z.string().nullable().catch(null),
  training_url: z.string().nullable().catch(null),
  is_sso_capable: z.preprocess(toBoolean, z.boolean()),
  active: z.preprocess(toBoolean, z.boolean()),
})

function mapRow(row: unknown): SystemLibraryEntry {
  return systemLibraryRowSchema.parse(row)
}

// ── Loader ────────────────────────────────────────────────────────────────────

/**
 * Load systems from the `system_library` catalog.
 *
 * The system_library is a read-only reference table (no RLS write access from
 * the client). All authenticated users can read the full catalog.
 *
 * Supports optional filtering by type and active status, plus sorting.
 */
export async function loadSystemLibrary(
  supabase: SupabaseClient,
  options: SystemLibraryOptions = {},
  unavailable?: string[],
): Promise<SystemLibraryEntry[]> {
  const {
    type,
    category,
    active = true,
    sortBy = 'system_name',
    sortDir = 'asc',
  } = options

  try {
    let query = supabase
      .from('system_library')
      .select(SELECT_COLS)

    if (type) {
      query = query.eq('system_type', type)
    }
    if (category) {
      query = query.eq('system_category', category)
    }

    query = query
      .eq('active', active)
      .order(sortBy, { ascending: sortDir === 'asc' })

    const { data, error } = await query

    if (error) {
      unavailable?.push(`System library: ${error.message}`)
      return []
    }

    return (data ?? []).map(mapRow)
  } catch (err) {
    unavailable?.push(
      `System library: ${err instanceof Error ? err.message : 'unavailable'}`,
    )
    return []
  }
}
