import type { SupabaseClient } from '@supabase/supabase-js'

// ── Types ────────────────────────────────────────────────────────────────────

export type SystemRecommendation = {
  recommendation_id: string
  activity_code: string
  system_library_id: string
  recommendation_weight: number
  is_default: boolean
  created_at: string
  updated_at: string
}

export type SystemRecommendationWithDetails = SystemRecommendation & {
  system_name: string
  vendor_name: string | null
  system_type: string
  system_category: string | null
  default_url: string | null
}

export type RecommendedSystemResult = {
  system: SystemRecommendationWithDetails
  isRegistered: boolean
  isDefault: boolean
}

export type GetRecommendedSystemsOutput = {
  recommended: RecommendedSystemResult[]
  fallbackReason: 'no_recommendations' | 'no_matching_system' | null
  defaultSystem: SystemRecommendationWithDetails | null
}

// ── Admin input types ────────────────────────────────────────────────────────

export type CreateRecommendationInput = {
  activityCode: string
  systemLibraryId: string
  weight?: number
  isDefault?: boolean
}

export type UpdateRecommendationInput = {
  recommendationId: string
  weight?: number
  isDefault?: boolean
}

// ── Recommendation Engine ─────────────────────────────────────────────────────

/**
 * Get recommended systems for an activity based on a study's registered systems.
 *
 * Algorithm:
 * 1. Find all recommendation entries for the given activity_code
 * 2. Find all systems registered for the given study
 * 3. Intersect: return recommended systems that the study has registered
 * 4. Sort by recommendation_weight descending
 * 5. Mark which is the default
 */
export async function getRecommendedSystems(
  supabase: SupabaseClient,
  studyId: string,
  activityCode: string,
  unavailable?: string[],
): Promise<GetRecommendedSystemsOutput> {
  try {
    // Step 1: Get recommendation entries for this activity
    const { data: recommendations, error: recError } = await supabase
      .from('activity_system_recommendations')
      .select(`
        *,
        system_library!inner(
          system_name, vendor_name, system_type, system_category, default_url
        )
      `)
      .eq('activity_code', activityCode)
      .order('recommendation_weight', { ascending: false })

    if (recError) {
      unavailable?.push(`Recommendations: ${recError.message}`)
      return { recommended: [], fallbackReason: 'no_recommendations', defaultSystem: null }
    }

    if (!recommendations || recommendations.length === 0) {
      return { recommended: [], fallbackReason: 'no_recommendations', defaultSystem: null }
    }

    // Step 2: Get registered systems for the study
    const { data: studySystems } = await supabase
      .from('study_systems')
      .select('system_library_id')
      .eq('study_id', studyId)
      .eq('active', true)

    const registeredIds = new Set(
      (studySystems ?? [])
        .map((s: { system_library_id: string | null }) => s.system_library_id)
        .filter((id: string | null): id is string => id !== null),
    )

    // Step 3: Map results with system details
    const withDetails = (recommendations as unknown[]).map((row) => {
      const r = row as Record<string, unknown>
      const sys = r.system_library as Record<string, unknown> || {}
      return {
        ...(r as unknown as SystemRecommendation),
        system_name: String(sys.system_name ?? ''),
        vendor_name: sys.vendor_name != null ? String(sys.vendor_name) : null,
        system_type: String(sys.system_type ?? ''),
        system_category: sys.system_category != null ? String(sys.system_category) : null,
        default_url: sys.default_url != null ? String(sys.default_url) : null,
      } as SystemRecommendationWithDetails
    })

    // Step 4: Build result with registration status
    const defaultSystem = withDetails.find((r) => r.is_default) ?? null

    const recommended: RecommendedSystemResult[] = withDetails.map((s) => ({
      system: s,
      isRegistered: registeredIds.has(s.system_library_id),
      isDefault: s.is_default,
    }))

    return {
      recommended,
      fallbackReason: null,
      defaultSystem,
    }
  } catch (err) {
    unavailable?.push(
      `Recommendations: ${err instanceof Error ? err.message : 'unavailable'}`,
    )
    return { recommended: [], fallbackReason: 'no_recommendations', defaultSystem: null }
  }
}

/**
 * Get all recommendations for a specific activity (full list, no study filter).
 */
export async function getRecommendationsForActivity(
  supabase: SupabaseClient,
  activityCode: string,
): Promise<SystemRecommendationWithDetails[]> {
  try {
    const { data, error } = await supabase
      .from('activity_system_recommendations')
      .select(`
        *,
        system_library!inner(
          system_name, vendor_name, system_type, system_category, default_url
        )
      `)
      .eq('activity_code', activityCode)
      .order('recommendation_weight', { ascending: false })

    if (error || !data) return []

    return (data as unknown[]).map((row) => {
      const r = row as Record<string, unknown>
      const sys = r.system_library as Record<string, unknown> || {}
      return {
        ...(r as unknown as SystemRecommendation),
        system_name: String(sys.system_name ?? ''),
        vendor_name: sys.vendor_name != null ? String(sys.vendor_name) : null,
        system_type: String(sys.system_type ?? ''),
        system_category: sys.system_category != null ? String(sys.system_category) : null,
        default_url: sys.default_url != null ? String(sys.default_url) : null,
      } as SystemRecommendationWithDetails
    })
  } catch {
    return []
  }
}

/**
 * Get all unique activity codes that have recommendations configured.
 */
export async function getActivitiesWithRecommendations(
  supabase: SupabaseClient,
): Promise<string[]> {
  try {
    const { data, error } = await supabase
      .from('activity_system_recommendations')
      .select('activity_code')

    if (error || !data) return []
    return [...new Set(data.map((r: { activity_code: string }) => r.activity_code))]
  } catch {
    return []
  }
}
