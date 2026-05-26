import { createHash } from 'crypto'
import type { RuntimeSourcePackageJson } from './source-package-types'

function stableSerialize(value: unknown): string {
  if (value === null || typeof value !== 'object') {
    return JSON.stringify(value)
  }
  if (Array.isArray(value)) {
    return `[${value.map((item) => stableSerialize(item)).join(',')}]`
  }
  const record = value as Record<string, unknown>
  const keys = Object.keys(record).sort()
  return `{${keys.map((key) => `${JSON.stringify(key)}:${stableSerialize(record[key])}`).join(',')}}`
}

export function normalizeSourcePackageJson(
  packageJson: RuntimeSourcePackageJson,
): RuntimeSourcePackageJson {
  const visits = [...packageJson.visits]
    .sort((a, b) => a.sequence_order - b.sequence_order || a.visit_code.localeCompare(b.visit_code))
    .map((visit) => ({
      ...visit,
      source_sections: [...visit.source_sections]
        .sort(
          (a, b) =>
            a.procedure_code.localeCompare(b.procedure_code)
            || a.blueprint_version_id.localeCompare(b.blueprint_version_id),
        )
        .map((section) => ({
          ...section,
          fields: [...section.fields]
            .sort((a, b) => a.field_id.localeCompare(b.field_id))
            .map((field) => ({ ...field })),
        })),
    }))

  return {
    study_id: packageJson.study_id,
    composition_snapshot_id: packageJson.composition_snapshot_id,
    visits,
  }
}

export function computeSourcePackageHash(packageJson: RuntimeSourcePackageJson): string {
  const normalized = normalizeSourcePackageJson(packageJson)
  return createHash('sha256').update(stableSerialize(normalized)).digest('hex')
}
