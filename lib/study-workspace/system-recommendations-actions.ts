'use server'

import { revalidatePath } from 'next/cache'
import { createServerClient } from '@/lib/supabase/server'
import type {
  CreateRecommendationInput,
  UpdateRecommendationInput,
  SystemRecommendation,
} from './system-recommendations'

export type RecommendationActionResult = {
  ok: boolean
  error?: string
  data?: SystemRecommendation
}

/**
 * Create a new activity→system recommendation.
 */
export async function createRecommendation(
  input: CreateRecommendationInput,
): Promise<RecommendationActionResult> {
  try {
    const supabase = await createServerClient()

    // If setting as default, unset existing default first
    if (input.isDefault) {
      await supabase
        .from('activity_system_recommendations')
        .update({ is_default: false })
        .eq('activity_code', input.activityCode)
        .eq('is_default', true)
    }

    const { data, error } = await supabase
      .from('activity_system_recommendations')
      .insert({
        activity_code: input.activityCode,
        system_library_id: input.systemLibraryId,
        recommendation_weight: input.weight ?? 100,
        is_default: input.isDefault ?? false,
      })
      .select()
      .single()

    if (error) return { ok: false, error: error.message }

    revalidatePath('/studies')
    return { ok: true, data: data as SystemRecommendation }
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : 'Failed to create recommendation',
    }
  }
}

/**
 * Update an existing recommendation (weight, default).
 */
export async function updateRecommendation(
  input: UpdateRecommendationInput,
): Promise<RecommendationActionResult> {
  try {
    const supabase = await createServerClient()
    const updates: Record<string, unknown> = {}

    if (input.weight !== undefined) updates.recommendation_weight = input.weight
    if (input.isDefault !== undefined) updates.is_default = input.isDefault

    // If setting as default, unset existing default for this activity
    if (input.isDefault) {
      // Get the activity code for this recommendation
      const { data: existing } = await supabase
        .from('activity_system_recommendations')
        .select('activity_code')
        .eq('recommendation_id', input.recommendationId)
        .single()

      if (existing) {
        await supabase
          .from('activity_system_recommendations')
          .update({ is_default: false })
          .eq('activity_code', existing.activity_code)
          .eq('is_default', true)
          .neq('recommendation_id', input.recommendationId)
      }
    }

    const { data, error } = await supabase
      .from('activity_system_recommendations')
      .update(updates)
      .eq('recommendation_id', input.recommendationId)
      .select()
      .single()

    if (error) return { ok: false, error: error.message }

    revalidatePath('/studies')
    return { ok: true, data: data as SystemRecommendation }
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : 'Failed to update recommendation',
    }
  }
}

/**
 * Delete a recommendation.
 */
export async function deleteRecommendation(
  recommendationId: string,
): Promise<RecommendationActionResult> {
  try {
    const supabase = await createServerClient()

    const { data, error } = await supabase
      .from('activity_system_recommendations')
      .delete()
      .eq('recommendation_id', recommendationId)
      .select()
      .single()

    if (error) return { ok: false, error: error.message }

    revalidatePath('/studies')
    return { ok: true, data: data as SystemRecommendation }
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : 'Failed to delete recommendation',
    }
  }
}
