import type { SupabaseClient } from '@supabase/supabase-js'
import { DEFAULT_PROTOCOL_ALIAS_MAP } from '@/lib/sanitization/forbidden-protocol-tokens'
import {
  sanitizeProtocolText,
  type ProtocolAliasMap,
} from '@/lib/sanitization/protocol-sanitizer'
import type {
  StudyAliasMapRow,
  StudyAliasSource,
  StudyAliasTokenType,
} from '@/lib/protocol-vault/types'

export type UpsertStudyAliasInput = {
  studyId: string
  rawToken: string
  tokenType: StudyAliasTokenType
  safeAlias: string
  source?: StudyAliasSource
  confidence?: number | null
  approvedBy?: string | null
  approvedAt?: string | null
}

export function buildProtocolAliasMapFromRows(rows: StudyAliasMapRow[]): ProtocolAliasMap {
  const map: ProtocolAliasMap = { ...DEFAULT_PROTOCOL_ALIAS_MAP }
  for (const row of rows) {
    map[row.raw_token] = row.safe_alias
  }
  return map
}

export function resolveSafeAlias(
  rawValue: string | null | undefined,
  tokenType: StudyAliasTokenType,
  rows: StudyAliasMapRow[],
  fallbackAliasMap: ProtocolAliasMap = DEFAULT_PROTOCOL_ALIAS_MAP,
): string {
  const trimmed = rawValue?.trim()
  if (!trimmed) {
    switch (tokenType) {
      case 'protocol_number':
        return 'Protocol TBD'
      case 'sponsor':
        return 'Sponsor TBD'
      case 'compound':
        return 'Compound TBD'
      case 'study_code':
        return 'Study TBD'
      default:
        return '—'
    }
  }

  const exact = rows.find(
    (row) => row.token_type === tokenType && row.raw_token.toLowerCase() === trimmed.toLowerCase(),
  )
  if (exact?.safe_alias) {
    return sanitizeProtocolText(exact.safe_alias, fallbackAliasMap)
  }

  const typed = rows.find((row) => row.token_type === tokenType)
  if (typed?.safe_alias && rows.filter((row) => row.token_type === tokenType).length === 1) {
    return sanitizeProtocolText(typed.safe_alias, fallbackAliasMap)
  }

  return sanitizeProtocolText(trimmed, fallbackAliasMap)
}

export async function listStudyAliasMapsForStudy(
  supabase: SupabaseClient,
  studyId: string,
): Promise<StudyAliasMapRow[]> {
  const { data, error } = await supabase
    .from('study_alias_maps')
    .select(
      'id, study_id, raw_token, token_type, safe_alias, source, confidence, approved_by, approved_at, created_at',
    )
    .eq('study_id', studyId)
    .order('created_at', { ascending: true })

  if (error) {
    throw new Error(`Failed to load study alias maps: ${error.message}`)
  }

  return (data ?? []) as StudyAliasMapRow[]
}

export async function loadStudyAliasMapsForStudies(
  supabase: SupabaseClient,
  studyIds: string[],
): Promise<Map<string, StudyAliasMapRow[]>> {
  const map = new Map<string, StudyAliasMapRow[]>()
  if (studyIds.length === 0) return map

  const { data, error } = await supabase
    .from('study_alias_maps')
    .select(
      'id, study_id, raw_token, token_type, safe_alias, source, confidence, approved_by, approved_at, created_at',
    )
    .in('study_id', studyIds)

  if (error) {
    throw new Error(`Failed to load study alias maps: ${error.message}`)
  }

  for (const row of (data ?? []) as StudyAliasMapRow[]) {
    const list = map.get(row.study_id) ?? []
    list.push(row)
    map.set(row.study_id, list)
  }
  return map
}

export async function loadProtocolAliasMapForStudy(
  supabase: SupabaseClient,
  studyId: string,
): Promise<ProtocolAliasMap> {
  const rows = await listStudyAliasMapsForStudy(supabase, studyId)
  return buildProtocolAliasMapFromRows(rows)
}

export async function upsertStudyAliasMapEntry(
  supabase: SupabaseClient,
  input: UpsertStudyAliasInput,
): Promise<StudyAliasMapRow> {
  const payload = {
    study_id: input.studyId,
    raw_token: input.rawToken.trim(),
    token_type: input.tokenType,
    safe_alias: sanitizeProtocolText(input.safeAlias.trim()),
    source: input.source ?? 'manual',
    confidence: input.confidence ?? null,
    approved_by: input.approvedBy ?? null,
    approved_at: input.approvedAt ?? null,
  }

  const { data, error } = await supabase
    .from('study_alias_maps')
    .upsert(payload, { onConflict: 'study_id,raw_token,token_type' })
    .select(
      'id, study_id, raw_token, token_type, safe_alias, source, confidence, approved_by, approved_at, created_at',
    )
    .single()

  if (error || !data) {
    throw new Error(`Failed to upsert study alias map: ${error?.message ?? 'unknown error'}`)
  }

  return data as StudyAliasMapRow
}
