import type { SupabaseClient } from '@supabase/supabase-js'

// ── Types ────────────────────────────────────────────────────────────────────

export type ActivitySystemMapEntry = {
  activity_system_map_id: string
  activity_code: string
  system_library_id: string
  is_primary: boolean
  notes: string | null
  created_at: string
  updated_at: string
}

export type ActivitySystemMapWithSystem = ActivitySystemMapEntry & {
  system_name: string
  vendor_name: string | null
  system_type: string
  system_category: string | null
  default_url: string | null
  support_url: string | null
  training_url: string | null
}

export type ActivitySystemMapInput = {
  activityCode: string
  systemLibraryId: string
  isPrimary?: boolean
  notes?: string | null
}

// ── Loaders ──────────────────────────────────────────────────────────────────

/**
 * Load the activity→system map, enriched with system details.
 */
export async function loadActivitySystemMap(
  supabase: SupabaseClient,
  unavailable?: string[],
): Promise<ActivitySystemMapWithSystem[]> {
  try {
    const { data, error } = await supabase
      .from('activity_system_map')
      .select(`
        *,
        system_library!inner(
          system_name, vendor_name, system_type, system_category,
          default_url, support_url, training_url
        )
      `)
      .order('activity_code', { ascending: true })

    if (error) {
      unavailable?.push(`Activity system map: ${error.message}`)
      return []
    }

    return ((data ?? []) as unknown[]).map((row) => {
      const r = row as Record<string, unknown>
      const sys = r.system_library as Record<string, unknown> || {}
      return {
        ...(r as unknown as ActivitySystemMapEntry),
        system_name: String(sys.system_name ?? ''),
        vendor_name: sys.vendor_name != null ? String(sys.vendor_name) : null,
        system_type: String(sys.system_type ?? ''),
        system_category: sys.system_category != null ? String(sys.system_category) : null,
        default_url: sys.default_url != null ? String(sys.default_url) : null,
        support_url: sys.support_url != null ? String(sys.support_url) : null,
        training_url: sys.training_url != null ? String(sys.training_url) : null,
      }
    }) as ActivitySystemMapWithSystem[]
  } catch (err) {
    unavailable?.push(
      `Activity system map: ${err instanceof Error ? err.message : 'unavailable'}`,
    )
    return []
  }
}

/**
 * Get the primary system for a specific activity code.
 */
export async function getSystemForActivity(
  supabase: SupabaseClient,
  activityCode: string,
): Promise<ActivitySystemMapWithSystem | null> {
  try {
    const { data, error } = await supabase
      .from('activity_system_map')
      .select(`
        *,
        system_library!inner(
          system_name, vendor_name, system_type, system_category,
          default_url, support_url, training_url
        )
      `)
      .eq('activity_code', activityCode)
      .eq('is_primary', true)
      .order('created_at', { ascending: true })
      .limit(1)
      .single()

    if (error || !data) return null

    const d = data as Record<string, unknown>
    const sys = d.system_library as Record<string, unknown> || {}
    return {
      ...(d as unknown as ActivitySystemMapEntry),
      system_name: String(sys.system_name ?? ''),
      vendor_name: sys.vendor_name != null ? String(sys.vendor_name) : null,
      system_type: String(sys.system_type ?? ''),
      system_category: sys.system_category != null ? String(sys.system_category) : null,
      default_url: sys.default_url != null ? String(sys.default_url) : null,
      support_url: sys.support_url != null ? String(sys.support_url) : null,
      training_url: sys.training_url != null ? String(sys.training_url) : null,
    }
  } catch {
    return null
  }
}

/**
 * Get all activity codes that have external system mappings.
 * Useful for the Command Center "External System Required" filter.
 */
export async function getMappedActivityCodes(
  supabase: SupabaseClient,
): Promise<string[]> {
  try {
    const { data, error } = await supabase
      .from('activity_system_map')
      .select('activity_code')
      .eq('is_primary', true)

    if (error || !data) return []
    return [...new Set(data.map((r: { activity_code: string }) => r.activity_code))]
  } catch {
    return []
  }
}
