/**
 * Supabase domain tables — sourcePath prefix maps 1:1 to table/column conventions.
 */

import type { FieldSpec } from '@/lib/source-engine/canonical'

/** Postgres table names (public schema). */
export const VILO_DOMAIN_TABLES = {
  demographics: 'vilo_demographics',
  vitals: 'vilo_vitals',
  procedures: 'vilo_procedures',
  findings: 'vilo_findings',
  tnm: 'vilo_tnm',
  plasma_aliquots: 'vilo_plasma_aliquots',
  ip_supply: 'vilo_ip_supply',
  site_delegation: 'vilo_site_delegation',
} as const

export type ViloDomainKey = keyof typeof VILO_DOMAIN_TABLES

const SOURCE_PREFIX_TO_DOMAIN: Record<string, ViloDomainKey> = {
  demo: 'demographics',
  pregnancy: 'demographics',
  vitals: 'vitals',
  proc: 'procedures',
  finding: 'findings',
  tnm: 'tnm',
  lab: 'plasma_aliquots',
  supply: 'ip_supply',
  site: 'site_delegation',
}

/** Resolve catalog sourcePath (e.g. `vitals.sys_bp`) → domain table key. */
export function sourcePathToDomain(sourcePath: string): ViloDomainKey | null {
  const prefix = sourcePath.split('.')[0]
  return SOURCE_PREFIX_TO_DOMAIN[prefix] ?? null
}

export function sourcePathToTable(sourcePath: string): string | null {
  const domain = sourcePathToDomain(sourcePath)
  return domain ? VILO_DOMAIN_TABLES[domain] : null
}

/** Column name on domain row — uses flat field id from catalog. */
export function fieldSpecToColumn(spec: FieldSpec): string {
  return spec.id
}

export function groupFieldsByDomain(
  fields: FieldSpec[],
): Partial<Record<ViloDomainKey, FieldSpec[]>> {
  const grouped: Partial<Record<ViloDomainKey, FieldSpec[]>> = {}
  for (const spec of fields) {
    const domain = sourcePathToDomain(spec.sourcePath)
    if (!domain) continue
    if (!grouped[domain]) grouped[domain] = []
    grouped[domain]!.push(spec)
  }
  return grouped
}
