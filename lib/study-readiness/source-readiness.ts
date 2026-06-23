import type { ReadinessDomain, ReadinessBlocker } from './study-readiness'

// ── Input type for the pure evaluator ────────────────────────────────────────
// All data fetched server-side; the evaluator is pure.

export type SourceReadinessInput = {
  /** Does a protocol runtime version/draft exist? */
  hasProtocolRuntime: boolean
  /** Is there a published source package? */
  hasPublishedSource: boolean
  /** Are visit definitions defined for this study? */
  hasVisitDefinitions: boolean
  /** Are procedure-source bindings set? */
  hasSourceBindings: boolean
  /** Number of source generation errors (if tracked) */
  sourceGenerationErrors: number
  /** Are there any required visits/procedures missing source? */
  missingSourceCount: number
  /** Is the source package publish-ready? */
  publishReady: boolean | null
  /** Source package validation status */
  validationStatus: string | null
  /** Source package consistency (Pass/Fail/Unavailable) */
  packageConsistency: 'Pass' | 'Fail' | 'Unavailable' | null
  /** Can the study runtime execute? (from canExecuteStudyRuntime) */
  canExecuteRuntime: boolean
  /** Existing runtime blocker strings */
  runtimeBlockers: string[]
  /** Existing runtime warning strings */
  runtimeWarnings: string[]
  /** Is the source stale after an amendment? */
  staleAfterAmendment: boolean
}

// ── Pure evaluator ───────────────────────────────────────────────────────────

/**
 * Evaluate source readiness from source/runtime data.
 *
 * Pure function — no DB calls, no side effects.
 */
export function evaluateSourceReadiness(input: SourceReadinessInput): ReadinessDomain {
  const blockers: ReadinessBlocker[] = []
  let score = 100

  // ── 1. No protocol runtime → blocked ──
  if (!input.hasProtocolRuntime) {
    blockers.push({
      domain: 'source',
      severity: 'critical',
      message: 'No protocol draft generated — complete protocol intake first',
    })
    score = Math.min(score, 15)
  }

  // ── 2. Cannot execute runtime → blocked ──
  if (!input.canExecuteRuntime) {
    for (const blockerMsg of input.runtimeBlockers) {
      blockers.push({
        domain: 'source',
        severity: 'critical',
        message: blockerMsg,
      })
    }
    score = Math.min(score, 20)
  }

  // ── 3. Source generation errors → blocked ──
  if (input.sourceGenerationErrors > 0) {
    blockers.push({
      domain: 'source',
      severity: 'critical',
      message: `${input.sourceGenerationErrors} source generation error(s) detected`,
    })
    score = Math.min(score, 25)
  }

  // ── 4. Stale source after amendment → blocked/warning ──
  if (input.staleAfterAmendment) {
    blockers.push({
      domain: 'source',
      severity: 'critical',
      message: 'Source is stale after amendment — regenerate source',
    })
    score = Math.min(score, 30)
  }

  // ── 5. Missing source for required visits/procedures → blocked ──
  if (input.missingSourceCount > 0) {
    blockers.push({
      domain: 'source',
      severity: 'critical',
      message: `${input.missingSourceCount} required visit(s) or procedure(s) missing source`,
    })
    score = Math.min(score, 35)
  }

  // ── 6. Package consistency Fail → blocked ──
  if (input.packageConsistency === 'Fail') {
    blockers.push({
      domain: 'source',
      severity: 'critical',
      message: 'Source package consistency check failed',
    })
    score = Math.min(score, 20)
  }

  // ── 7. No published source → warning ──
  if (!input.hasPublishedSource && input.hasProtocolRuntime) {
    blockers.push({
      domain: 'source',
      severity: 'warning',
      message: 'Protocol draft exists but no published source package — publish to proceed',
    })
    score = Math.min(score, 55)
  }

  // ── 8. No visit definitions → warning ──
  if (!input.hasVisitDefinitions) {
    blockers.push({
      domain: 'source',
      severity: 'warning',
      message: 'No visit definitions configured',
    })
    score = Math.min(score, 50)
  }

  // ── 9. No source bindings → warning ──
  if (!input.hasSourceBindings) {
    blockers.push({
      domain: 'source',
      severity: 'warning',
      message: 'No procedure-source bindings configured',
    })
    score = Math.min(score, 55)
  }

  // ── 10. Not publish-ready → warning ──
  if (input.publishReady === false) {
    blockers.push({
      domain: 'source',
      severity: 'warning',
      message: 'Source package is not publish-ready',
    })
    score = Math.min(score, 60)
  }

  // ── 11. Runtime warnings → warning blockers ──
  for (const warnMsg of input.runtimeWarnings) {
    blockers.push({
      domain: 'source',
      severity: 'warning',
      message: warnMsg,
    })
    score = Math.min(score, 65)
  }

  // ── 12. No source requirement detected (no visit defs, no runtime) → warning/info ──
  if (!input.hasVisitDefinitions && !input.hasProtocolRuntime && input.missingSourceCount === 0) {
    blockers.push({
      domain: 'source',
      severity: 'info',
      message: 'No source requirement detected — study may not need source generation',
    })
    score = Math.min(score, 85)
  }

  // Determine status
  const hasCritical = blockers.some((b) => b.severity === 'critical')
  const hasWarning = blockers.some((b) => b.severity === 'warning')
  const status = hasCritical ? 'blocked' : hasWarning ? 'warning' : 'ready'

  // Clamp score
  score = Math.max(0, Math.min(100, score))

  return { domain: 'source', status, score, blockers }
}

// ── Source input extractor (server-side) ─────────────────────────────────────

export type SourceReadinessRawData = {
  hasProtocolRuntime: boolean
  hasPublishedSource: boolean
  hasVisitDefinitions: boolean
  hasSourceBindings: boolean
  sourceGenerationErrors: number
  missingSourceCount: number
  publishReady: boolean | null
  validationStatus: string | null
  packageConsistency: 'Pass' | 'Fail' | 'Unavailable' | null
  canExecuteRuntime: boolean
  runtimeBlockers: string[]
  runtimeWarnings: string[]
  staleAfterAmendment: boolean
}

/**
 * Build the SourceReadinessInput from raw data fetched server-side.
 * This keeps the evaluator pure while allowing DB access in the caller.
 */
export function buildSourceReadinessInput(raw: SourceReadinessRawData): SourceReadinessInput {
  return {
    hasProtocolRuntime: raw.hasProtocolRuntime,
    hasPublishedSource: raw.hasPublishedSource,
    hasVisitDefinitions: raw.hasVisitDefinitions,
    hasSourceBindings: raw.hasSourceBindings,
    sourceGenerationErrors: raw.sourceGenerationErrors,
    missingSourceCount: raw.missingSourceCount,
    publishReady: raw.publishReady,
    validationStatus: raw.validationStatus,
    packageConsistency: raw.packageConsistency,
    canExecuteRuntime: raw.canExecuteRuntime,
    runtimeBlockers: raw.runtimeBlockers,
    runtimeWarnings: raw.runtimeWarnings,
    staleAfterAmendment: raw.staleAfterAmendment,
  }
}

// ── Server loader ────────────────────────────────────────────────────────────

/**
 * Load source readiness for a study by querying source/runtime data.
 */
export async function loadSourceReadinessDomain(studyId: string): Promise<ReadinessDomain> {
  const { createServerClient } = await import('@/lib/supabase/server')

  const supabase = await createServerClient()

  // Load data in parallel
  const [
    protocolResult,
    packageResult,
    visitDefResult,
    bindingResult,
    errorsResult,
    runtimeResult,
  ] = await Promise.all([
    // Protocol runtime versions exist?
    supabase
      .from('protocol_runtime_studies')
      .select('id')
      .eq('study_id', studyId)
      .limit(1),
    // Published source package?
    supabase
      .from('source_publish_packages')
      .select('id, publish_ready, validation_status, persisted_at')
      .eq('study_id', studyId)
      .not('persisted_at', 'is', null)
      .order('persisted_at', { ascending: false })
      .limit(1),
    // Visit definitions?
    supabase
      .from('visit_definitions')
      .select('id')
      .eq('study_id', studyId)
      .limit(1),
    // Procedure-source bindings?
    supabase
      .from('procedure_source_bindings')
      .select('id')
      .eq('study_id', studyId)
      .limit(1),
    // Source generation errors (stub — no dedicated error table yet)
    Promise.resolve({ data: [], error: null }),
    // Runtime readiness
    supabase
      .from('studies')
      .select('status')
      .eq('id', studyId)
      .maybeSingle(),
  ])

  const hasProtocolRuntime = (protocolResult.data?.length ?? 0) > 0
  const latestPackage = packageResult.data?.[0] ?? null
  const hasPublishedSource = latestPackage !== null
  const hasVisitDefinitions = (visitDefResult.data?.length ?? 0) > 0
  const hasSourceBindings = (bindingResult.data?.length ?? 0) > 0

  const publishReady = latestPackage?.publish_ready ?? null
  const validationStatus = latestPackage?.validation_status ?? null

  // Stale after amendment: not yet detectable from DB alone — default false
  const staleAfterAmendment = false

  const raw: SourceReadinessRawData = {
    hasProtocolRuntime,
    hasPublishedSource,
    hasVisitDefinitions,
    hasSourceBindings,
    sourceGenerationErrors: 0, // stub
    missingSourceCount: hasVisitDefinitions && !hasSourceBindings ? 1 : 0,
    publishReady: publishReady as boolean | null,
    validationStatus: validationStatus as string | null,
    packageConsistency: hasPublishedSource
      ? (publishReady === true ? 'Pass' : validationStatus === 'error' ? 'Fail' : 'Unavailable')
      : null,
    canExecuteRuntime: hasProtocolRuntime && hasPublishedSource,
    runtimeBlockers: [],
    runtimeWarnings: [],
    staleAfterAmendment,
  }

  const input = buildSourceReadinessInput(raw)
  return evaluateSourceReadiness(input)
}
