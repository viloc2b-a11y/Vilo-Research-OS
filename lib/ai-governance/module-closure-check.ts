/**
 * GOV-2 module closure check — gates that must pass before a module can be
 * marked CLOSED in the Vilo OS sprint tracking.
 *
 * A module CANNOT be closed unless:
 *  1. The ai_use_case_registry has at least one entry for the module,
 *     OR the module is explicitly exempt (no AI/automation capability).
 *  2. Every active high/critical use case has at least one validation record
 *     that is NOT in 'pending' state.
 *  3. Every use case with human_review_required = true has at least one
 *     human review checkpoint defined.
 */

import type { SupabaseClient } from '@supabase/supabase-js'
import type { ModuleClosureCheckResult } from '@/lib/ai-governance/registry-types'

const NO_AI_MODULES = new Set([
  'admin_settings',
  'user_management',
  'billing_subscription',
])

export async function checkModuleClosure(
  supabase: SupabaseClient,
  moduleKey: string,
): Promise<ModuleClosureCheckResult> {
  if (NO_AI_MODULES.has(moduleKey)) {
    return { moduleKey, canClose: true, blockers: [], warnings: [] }
  }

  const blockers: string[] = []
  const warnings: string[] = []

  // 1. Check use case registry entries for this module
  const { data: useCases } = await supabase
    .from('ai_use_case_registry')
    .select('id, use_case_name, risk_level, human_review_required, current_status')
    .eq('module', moduleKey)
    .eq('current_status', 'active')

  if (!useCases || useCases.length === 0) {
    warnings.push(
      `No AI use case registry entries found for module '${moduleKey}'. ` +
        `Add entries or mark module as N/A for AI governance.`,
    )
    return { moduleKey, canClose: true, blockers: [], warnings }
  }

  const useCaseIds = useCases.map((uc) => uc.id as string)

  // 2. Validation evidence check for high/critical use cases
  const { data: validations } = await supabase
    .from('ai_validation_registry')
    .select('use_case_id, validation_result')
    .in('use_case_id', useCaseIds)

  const validatedUseCaseIds = new Set(
    (validations ?? [])
      .filter((v) => v.validation_result !== 'pending' && v.validation_result !== null)
      .map((v) => v.use_case_id as string),
  )

  for (const uc of useCases) {
    const risk = uc.risk_level as string
    if (risk === 'high' || risk === 'critical') {
      if (!validatedUseCaseIds.has(uc.id as string)) {
        blockers.push(
          `Use case '${uc.use_case_name}' (${risk}) has no completed validation evidence. ` +
            `At least one non-pending validation result is required.`,
        )
      }
    }
  }

  // 3. Human review checkpoint check
  const reviewRequiredIds = useCases
    .filter((uc) => uc.human_review_required)
    .map((uc) => uc.id as string)

  if (reviewRequiredIds.length > 0) {
    const { data: checkpoints } = await supabase
      .from('ai_human_review_registry')
      .select('use_case_id')
      .in('use_case_id', reviewRequiredIds)

    const checkpointCoveredIds = new Set(
      (checkpoints ?? []).map((c) => c.use_case_id as string),
    )

    for (const uc of useCases) {
      if (uc.human_review_required && !checkpointCoveredIds.has(uc.id as string)) {
        blockers.push(
          `Use case '${uc.use_case_name}' requires human review but no checkpoint is defined in ai_human_review_registry.`,
        )
      }
    }
  }

  return {
    moduleKey,
    canClose: blockers.length === 0,
    blockers,
    warnings,
  }
}
