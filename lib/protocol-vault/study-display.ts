import type { SupabaseClient } from '@supabase/supabase-js'
import {
  buildProtocolAliasMapFromRows,
  loadStudyAliasMapsForStudies,
  resolveSafeAlias,
} from '@/lib/protocol-vault/alias-map'
import { assertStudySafeDisplaySanitized } from '@/lib/protocol-vault/runtime-boundary'
import type { StudyAliasMapRow, StudyDisplay, StudyDisplayMode, StudySafeDisplay } from '@/lib/protocol-vault/types'
import { sanitizeProtocolText } from '@/lib/sanitization/protocol-sanitizer'

type StudyVersionSnapshot = {
  protocol_identifier: string | null
  metadata: Record<string, unknown> | null
  created_at?: string | null
}

type StudyRow = {
  id: string
  name: string
  slug: string | null
  study_versions?: StudyVersionSnapshot | StudyVersionSnapshot[] | null
}

export type StudyDisplayPartsInput = {
  studyId: string
  studyName: string
  studySlug: string | null
  protocolIdentifier: string | null
  sponsorRaw: string | null
  compoundRaw: string | null
  aliasRows: StudyAliasMapRow[]
}

function latestStudyVersion(
  versions: StudyRow['study_versions'],
): StudyVersionSnapshot | null {
  if (!versions) return null
  const list = Array.isArray(versions) ? versions : [versions]
  return (
    [...list].sort((a, b) => {
      const aTime = a.created_at ? new Date(a.created_at).getTime() : 0
      const bTime = b.created_at ? new Date(b.created_at).getTime() : 0
      return bTime - aTime
    })[0] ?? null
  )
}

function metadataString(metadata: Record<string, unknown> | null, key: string): string | null {
  if (!metadata) return null
  const value = metadata[key]
  return typeof value === 'string' && value.trim() ? value.trim() : null
}

function labelOrFallback(value: string | null | undefined, fallback: string): string {
  const trimmed = value?.trim()
  return trimmed ? trimmed : fallback
}

export function buildOperationalStudyDisplayFromParts(
  input: StudyDisplayPartsInput,
): StudyDisplay {
  const protocolLabel = labelOrFallback(
    input.protocolIdentifier ?? input.studySlug,
    'Protocol TBD',
  )
  const sponsorLabel = labelOrFallback(input.sponsorRaw, 'Sponsor TBD')
  const compoundLabel = labelOrFallback(input.compoundRaw, 'Compound TBD')
  const studyTitle = input.studyName.trim() || 'Study'
  const coordinatorDisplayName = [studyTitle, protocolLabel, sponsorLabel]
    .filter(Boolean)
    .join(' · ')

  return {
    internalStudyId: input.studyId,
    displayMode: 'operational',
    studyTitle,
    protocolLabel,
    sponsorLabel,
    compoundLabel,
    coordinatorDisplayName,
  }
}

export function buildSanitizedStudyDisplayFromParts(
  input: StudyDisplayPartsInput,
): StudyDisplay {
  const aliasMap = buildProtocolAliasMapFromRows(input.aliasRows)
  const protocolLabel = resolveSafeAlias(
    input.protocolIdentifier ?? input.studySlug,
    'protocol_number',
    input.aliasRows,
    aliasMap,
  )
  const sponsorLabel = resolveSafeAlias(input.sponsorRaw, 'sponsor', input.aliasRows, aliasMap)
  const compoundLabel = resolveSafeAlias(input.compoundRaw, 'compound', input.aliasRows, aliasMap)
  const studyTitle = sanitizeProtocolText(input.studyName.trim() || 'Study', aliasMap)
  const coordinatorDisplayName = sanitizeProtocolText(
    [studyTitle, protocolLabel, sponsorLabel].filter(Boolean).join(' · '),
    aliasMap,
  )

  const display: StudyDisplay = {
    internalStudyId: input.studyId,
    displayMode: 'sanitized',
    studyTitle,
    protocolLabel,
    sponsorLabel,
    compoundLabel,
    coordinatorDisplayName,
  }

  assertStudySafeDisplaySanitized(toStudySafeDisplay(display), 'sanitized study display')
  return display
}

export function buildStudyDisplayFromParts(
  input: StudyDisplayPartsInput,
  displayMode: StudyDisplayMode,
): StudyDisplay {
  if (displayMode === 'operational') {
    return buildOperationalStudyDisplayFromParts(input)
  }
  return buildSanitizedStudyDisplayFromParts(input)
}

export function toStudySafeDisplay(display: StudyDisplay): StudySafeDisplay {
  return {
    internalStudyId: display.internalStudyId,
    protocolAlias: display.protocolLabel,
    sponsorAlias: display.sponsorLabel,
    compoundAlias: display.compoundLabel,
    coordinatorDisplayName: display.coordinatorDisplayName,
  }
}

export async function getStudyDisplay(
  supabase: SupabaseClient,
  studyId: string,
  displayMode: StudyDisplayMode,
): Promise<StudyDisplay | null> {
  const batch = await getStudyDisplayBatch(supabase, [studyId], displayMode)
  return batch.get(studyId) ?? null
}

export async function getStudyDisplayBatch(
  supabase: SupabaseClient,
  studyIds: string[],
  displayMode: StudyDisplayMode,
): Promise<Map<string, StudyDisplay>> {
  const result = new Map<string, StudyDisplay>()
  if (studyIds.length === 0) return result

  const uniqueIds = [...new Set(studyIds)]

  const [{ data: studies, error: studiesError }, aliasByStudy] = await Promise.all([
    supabase
      .from('studies')
      .select('id, name, slug, study_versions(protocol_identifier, metadata, created_at)')
      .in('id', uniqueIds),
    displayMode === 'sanitized'
      ? loadStudyAliasMapsForStudies(supabase, uniqueIds)
      : Promise.resolve(new Map<string, StudyAliasMapRow[]>()),
  ])

  if (studiesError) {
    throw new Error(`Failed to load studies for display: ${studiesError.message}`)
  }

  for (const row of (studies ?? []) as StudyRow[]) {
    const version = latestStudyVersion(row.study_versions)
    const metadata = (version?.metadata as Record<string, unknown> | null) ?? null
    const parts: StudyDisplayPartsInput = {
      studyId: row.id,
      studyName: row.name,
      studySlug: row.slug,
      protocolIdentifier: version?.protocol_identifier ?? null,
      sponsorRaw: metadataString(metadata, 'sponsor'),
      compoundRaw: metadataString(metadata, 'compound') ?? metadataString(metadata, 'compound_name'),
      aliasRows: aliasByStudy.get(row.id) ?? [],
    }
    result.set(row.id, buildStudyDisplayFromParts(parts, displayMode))
  }

  return result
}

export function formatStudyDisplayLabel(display: StudyDisplay): string {
  if (display.displayMode === 'operational') {
    return [display.studyTitle, display.protocolLabel, display.sponsorLabel]
      .filter(Boolean)
      .join(' · ')
  }
  return display.coordinatorDisplayName
}
