import type { SupabaseClient } from '@supabase/supabase-js'
import type { ProcedureLibraryRow } from '@/lib/procedure-library/procedure-types'
import { listProcedures } from '@/lib/procedure-library/list-procedures'
import { appendReconciliationEvent } from './append-reconciliation-event'
import {
  mapProcedureReconciliationRow,
  MATCHING_METHOD,
  PROCEDURE_RECONCILIATION_STATUS,
  RECONCILIATION_EVENT_TYPE,
  type MatchingMethod,
  type ProcedureMatchSuggestion,
} from './protocol-reconciliation-types'
import { resolveProtocolVersionOrg } from './resolve-protocol-version-org'
import { buildProcedureReconciliationStateSnapshot } from './reconciliation-state-hash'

export const AUTO_MATCH_THRESHOLD = 0.85

function normalizeToken(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim()
}

function tokenSet(value: string): Set<string> {
  return new Set(normalizeToken(value).split(/\s+/).filter(Boolean))
}

function jaccardSimilarity(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 || b.size === 0) return 0
  let intersection = 0
  for (const token of a) {
    if (b.has(token)) intersection += 1
  }
  const union = a.size + b.size - intersection
  return union === 0 ? 0 : intersection / union
}

export function scoreProcedureMatch(
  candidateName: string,
  procedure: ProcedureLibraryRow,
): { confidence: number; matchingMethod: MatchingMethod } {
  const candidate = normalizeToken(candidateName)
  const name = normalizeToken(procedure.procedureName)
  const code = normalizeToken(procedure.procedureCode)

  if (!candidate) return { confidence: 0, matchingMethod: MATCHING_METHOD.NONE }
  if (candidate === code) {
    return { confidence: 1, matchingMethod: MATCHING_METHOD.AUTO_EXACT_CODE }
  }
  if (candidate === name) {
    return { confidence: 1, matchingMethod: MATCHING_METHOD.AUTO_STRING }
  }
  if (name.includes(candidate) || candidate.includes(name)) {
    return { confidence: 0.92, matchingMethod: MATCHING_METHOD.AUTO_STRING }
  }
  if (code.includes(candidate) || candidate.includes(code)) {
    return { confidence: 0.88, matchingMethod: MATCHING_METHOD.AUTO_EXACT_CODE }
  }

  const candidateTokens = tokenSet(candidateName)
  const procedureTokens = new Set([
    ...tokenSet(procedure.procedureName),
    ...tokenSet(procedure.procedureCode),
  ])
  const confidence = jaccardSimilarity(candidateTokens, procedureTokens)
  return {
    confidence,
    matchingMethod: confidence > 0 ? MATCHING_METHOD.AUTO_STRING : MATCHING_METHOD.NONE,
  }
}

export function suggestProcedureMatches(
  candidateName: string,
  procedures: ProcedureLibraryRow[],
  limit = 5,
): ProcedureMatchSuggestion[] {
  return procedures
    .map((procedure) => {
      const scored = scoreProcedureMatch(candidateName, procedure)
      return {
        procedureId: procedure.id,
        procedureCode: procedure.procedureCode,
        procedureName: procedure.procedureName,
        blueprintVersionId: procedure.activeVersionId,
        confidence: scored.confidence,
        matchingMethod: scored.matchingMethod,
      }
    })
    .filter((item) => item.confidence > 0 && item.blueprintVersionId)
    .sort(
      (a, b) =>
        b.confidence - a.confidence || a.procedureName.localeCompare(b.procedureName),
    )
    .slice(0, limit)
}

export function pickBestProcedureMatch(
  candidateName: string,
  procedures: ProcedureLibraryRow[],
): ProcedureMatchSuggestion | null {
  const suggestions = suggestProcedureMatches(candidateName, procedures, 1)
  return suggestions[0] ?? null
}

export type SuggestProcedureMatchesResult = {
  updatedCount: number
  matchedCount: number
  needsReviewCount: number
  totalCandidates: number
}

export async function runSuggestProcedureMatches(args: {
  supabase: SupabaseClient
  organizationId: string
  protocolVersionId: string
  actorId: string
}): Promise<SuggestProcedureMatchesResult> {
  const context = await resolveProtocolVersionOrg(
    args.supabase,
    args.organizationId,
    args.protocolVersionId,
  )
  if (!context) throw new Error('Protocol version not found')

  const procedures = await listProcedures(args.supabase, {
    organizationId: args.organizationId,
    libraryScope: 'all',
    status: 'active',
    limit: 500,
  })

  const { data: rows, error } = await args.supabase
    .from('protocol_procedure_reconciliations')
    .select('*')
    .eq('protocol_version_id', args.protocolVersionId)
    .in('reconciliation_status', [
      PROCEDURE_RECONCILIATION_STATUS.NEEDS_REVIEW,
      PROCEDURE_RECONCILIATION_STATUS.MANUAL_MAPPING_REQUIRED,
    ])

  if (error) throw new Error(error.message)

  let updatedCount = 0
  let matchedCount = 0
  let needsReviewCount = 0

  for (const row of rows ?? []) {
    const current = mapProcedureReconciliationRow(row as Record<string, unknown>)
    const suggestions = suggestProcedureMatches(current.procedureName, procedures, 5)
    const best = pickBestProcedureMatch(current.procedureName, procedures)

    const patch: Record<string, unknown> = {
      metadata: {
        ...current.metadata,
        match_suggestions: suggestions,
        last_suggest_run_at: new Date().toISOString(),
      },
    }

    if (best && best.confidence >= AUTO_MATCH_THRESHOLD) {
      patch.matched_procedure_library_id = best.procedureId
      patch.matched_blueprint_version_id = best.blueprintVersionId
      patch.match_confidence = best.confidence
      patch.matching_method = best.matchingMethod
      patch.reconciliation_status = PROCEDURE_RECONCILIATION_STATUS.MATCHED
      matchedCount += 1
    } else {
      patch.match_confidence = best?.confidence ?? null
      patch.matching_method = MATCHING_METHOD.NONE
      patch.reconciliation_status = PROCEDURE_RECONCILIATION_STATUS.NEEDS_REVIEW
      needsReviewCount += 1
    }

    const { data: updated, error: updateError } = await args.supabase
      .from('protocol_procedure_reconciliations')
      .update(patch)
      .eq('id', current.id)
      .select('*')
      .single()

    if (updateError || !updated) throw new Error(updateError?.message ?? 'Failed to update procedure match')

    updatedCount += 1
    const mapped = mapProcedureReconciliationRow(updated as Record<string, unknown>)
    await appendReconciliationEvent({
      supabase: args.supabase,
      organizationId: args.organizationId,
      protocolVersionId: args.protocolVersionId,
      eventType: RECONCILIATION_EVENT_TYPE.PROCEDURE_MATCH_SUGGESTED,
      actorId: args.actorId,
      procedureReconciliationId: mapped.id,
      eventPayload: {
        suggestions,
        best_match: best,
        auto_match_threshold: AUTO_MATCH_THRESHOLD,
      },
      stateSnapshot: buildProcedureReconciliationStateSnapshot(mapped),
    })
  }

  return {
    updatedCount,
    matchedCount,
    needsReviewCount,
    totalCandidates: (rows ?? []).length,
  }
}
