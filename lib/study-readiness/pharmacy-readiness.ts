import type { ReadinessDomain, ReadinessBlocker } from './study-readiness'

// ── Input type for the pure evaluator ────────────────────────────────────────

export type PharmacyReadinessInput = {
  /** Does the study require IP (investigational product)? */
  requiresIP: boolean
  /** Is there an active pharmacy blueprint? */
  hasActiveBlueprint: boolean
  /** Blueprint activation status */
  blueprintStatus: string | null
  /** Is CRC review completed? */
  crcReviewCompleted: boolean
  /** Does the study require blinding/unblinding support? */
  requiresBlinding: boolean
  /** Is blinding/unblinding configured? */
  blindingConfigured: boolean
  /** Are drug receipt/storage workflows configured? */
  receiptConfigComplete: boolean
  /** Are dispensing rules configured? */
  dispensingRulesConfigured: boolean
  /** Is drug accountability/reconciliation configured? */
  accountabilityConfigured: boolean
  /** Are there any known pharmacy blockers? */
  hasPharmacyBlockers: boolean
  /** Pharmacy blocker count */
  pharmacyBlockerCount: number
  /** Pharmacy blocker descriptions */
  pharmacyBlockerMessages: string[]
  /** Are temperature/storage requirements configured (if applicable)? */
  storageConfigComplete: boolean
}

// ── Pure evaluator ───────────────────────────────────────────────────────────

/**
 * Evaluate pharmacy readiness from pharmacy runtime data.
 */
export function evaluatePharmacyReadiness(input: PharmacyReadinessInput): ReadinessDomain {
  const blockers: ReadinessBlocker[] = []
  let score = 100

  // ── 1. No IP requirement detected ──
  if (!input.requiresIP) {
    blockers.push({
      domain: 'pharmacy',
      severity: 'info',
      message: 'No investigational product requirement detected — pharmacy may not be needed',
    })
    return { domain: 'pharmacy', status: 'ready', score: 100, blockers }
  }

  // ── 2. IP required but no blueprint → blocked ──
  if (!input.hasActiveBlueprint) {
    blockers.push({
      domain: 'pharmacy',
      severity: 'critical',
      message: 'IP required but no pharmacy blueprint configured',
    })
    score = Math.min(score, 15)
  }

  // ── 3. Critical pharmacy blockers → blocked ──
  if (input.hasPharmacyBlockers) {
    for (const msg of input.pharmacyBlockerMessages) {
      blockers.push({
        domain: 'pharmacy',
        severity: 'critical',
        message: msg,
      })
    }
    score = Math.min(score, 20)
  }

  // ── 4. Blueprint not active / still in draft → blocked ──
  if (input.hasActiveBlueprint && input.blueprintStatus && input.blueprintStatus !== 'active') {
    blockers.push({
      domain: 'pharmacy',
      severity: 'critical',
      message: `Pharmacy blueprint status is "${input.blueprintStatus}" — must be active`,
    })
    score = Math.min(score, 25)
  }

  // ── 5. CRC review not completed → warning ──
  if (input.hasActiveBlueprint && !input.crcReviewCompleted) {
    blockers.push({
      domain: 'pharmacy',
      severity: 'warning',
      message: 'Pharmacy blueprint CRC review not yet completed',
    })
    score = Math.min(score, 55)
  }

  // ── 6. Receipt/storage not configured → warning ──
  if (!input.receiptConfigComplete) {
    blockers.push({
      domain: 'pharmacy',
      severity: 'warning',
      message: 'Drug receipt/storage workflow not fully configured',
    })
    score = Math.min(score, 60)
  }

  // ── 7. Dispensing rules not configured → warning ──
  if (!input.dispensingRulesConfigured) {
    blockers.push({
      domain: 'pharmacy',
      severity: 'warning',
      message: 'Dispensing rules not configured',
    })
    score = Math.min(score, 55)
  }

  // ── 8. Accountability not configured → warning ──
  if (!input.accountabilityConfigured) {
    blockers.push({
      domain: 'pharmacy',
      severity: 'warning',
      message: 'Drug accountability/reconciliation not configured',
    })
    score = Math.min(score, 60)
  }

  // ── 9. Blinding required but not configured → warning ──
  if (input.requiresBlinding && !input.blindingConfigured) {
    blockers.push({
      domain: 'pharmacy',
      severity: 'warning',
      message: 'Blinding/unblinding support required but not configured',
    })
    score = Math.min(score, 50)
  }

  // ── 10. Storage not configured → warning ──
  if (!input.storageConfigComplete) {
    blockers.push({
      domain: 'pharmacy',
      severity: 'warning',
      message: 'Temperature/storage requirements not configured',
    })
    score = Math.min(score, 65)
  }

  const hasCritical = blockers.some((b) => b.severity === 'critical')
  const status = hasCritical ? 'blocked' : (blockers.length > 0 ? 'warning' : 'ready')

  score = Math.max(0, Math.min(100, score))

  // If no blockers at all, return ready
  if (blockers.length === 0) {
    return { domain: 'pharmacy', status: 'ready', score: 100, blockers }
  }

  return { domain: 'pharmacy', status, score, blockers }
}

// ── Server loader ────────────────────────────────────────────────────────────

/**
 * Load pharmacy readiness for a study.
 */
export async function loadPharmacyReadinessDomain(studyId: string): Promise<ReadinessDomain> {
  const { createServerClient } = await import('@/lib/supabase/server')
  const supabase = await createServerClient()

  // Check if pharmacy blueprint exists
  const { data: blueprint } = await supabase
    .from('pharmacy_runtime_blueprints')
    .select('*')
    .eq('study_id', studyId)
    .maybeSingle()

  const hasActiveBlueprint = blueprint !== null
  const blueprintStatus = blueprint?.activation_status ?? null
  const crcReviewCompleted = blueprint?.crc_review_completed ?? false

  // Check for receipt expectations
  let receiptConfigComplete = false
  let dispensingRulesConfigured = false
  let accountabilityConfigured = false
  let storageConfigComplete = false
  let blindingConfigured = false

  if (hasActiveBlueprint) {
    const bpId = (blueprint as Record<string, unknown>).blueprint_id as string

    const [{ count: receiptCount }, { count: rulesCount }, { count: storageCount }, { count: unblindCount }] =
      await Promise.all([
        supabase.from('phase1_receipt_expectations').select('id', { count: 'exact', head: true }).eq('blueprint_id', bpId).limit(1),
        supabase.from('pharmacy_dispensing_blueprint_rules').select('id', { count: 'exact', head: true }).eq('blueprint_id', bpId).limit(1),
        supabase.from('pharmacy_storage_requirements').select('id', { count: 'exact', head: true }).eq('blueprint_id', bpId).limit(1),
        supabase.from('pharmacy_unblind_policies').select('id', { count: 'exact', head: true }).eq('blueprint_id', bpId).limit(1),
      ])

    receiptConfigComplete = (receiptCount ?? 0) > 0
    dispensingRulesConfigured = (rulesCount ?? 0) > 0
    storageConfigComplete = (storageCount ?? 0) > 0
    blindingConfigured = (unblindCount ?? 0) > 0
    accountabilityConfigured = dispensingRulesConfigured // simplified: follows dispensing
  }

  // Determine if study requires IP (has blueprint = needs IP, or check study type)
  const requiresIP = hasActiveBlueprint

  // Check for blinding requirement
  const requiresBlinding = false // simplified — would come from protocol data

  const input: PharmacyReadinessInput = {
    requiresIP,
    hasActiveBlueprint,
    blueprintStatus: blueprintStatus as string | null,
    crcReviewCompleted,
    requiresBlinding,
    blindingConfigured,
    receiptConfigComplete,
    dispensingRulesConfigured,
    accountabilityConfigured,
    hasPharmacyBlockers: false,
    pharmacyBlockerCount: 0,
    pharmacyBlockerMessages: [],
    storageConfigComplete,
  }

  return evaluatePharmacyReadiness(input)
}
