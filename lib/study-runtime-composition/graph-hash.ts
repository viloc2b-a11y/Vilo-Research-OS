import { createHash } from 'crypto'
import type { StudyRuntimeGraphJson } from './runtime-composition-types'

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

export function normalizeStudyRuntimeGraph(graph: StudyRuntimeGraphJson): StudyRuntimeGraphJson {
  const visits = [...graph.visits]
    .sort((a, b) => a.sequence_order - b.sequence_order || a.visit_code.localeCompare(b.visit_code))
    .map((visit) => ({
      ...visit,
      allowed_modes: [...visit.allowed_modes].sort(),
      procedures: [...visit.procedures]
        .sort((a, b) => a.procedure_order - b.procedure_order || a.procedure_id.localeCompare(b.procedure_id))
        .map((procedure) => ({
          ...procedure,
          optionality_rule: procedure.optionality_rule ?? {},
          dependency_rule: procedure.dependency_rule ?? {},
          timing_rule: procedure.timing_rule ?? {},
          operational_overrides: procedure.operational_overrides ?? {},
        })),
    }))

  return {
    study_id: graph.study_id,
    organization_id: graph.organization_id,
    visits,
  }
}

export function computeStudyRuntimeGraphHash(graph: StudyRuntimeGraphJson): string {
  const normalized = normalizeStudyRuntimeGraph(graph)
  const serialized = stableSerialize(normalized)
  return createHash('sha256').update(serialized).digest('hex')
}
