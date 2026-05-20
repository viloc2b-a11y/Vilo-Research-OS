import type { SubjectConMed } from '@/lib/subject/clinical-profile/types'

const RECENT_CHANGE_DAYS = 14

export type ConMedSummaryCounts = {
  active: number
  discontinued: number
  onHold: number
  missingDocumentation: number
  recentChanges: number
}

function daysAgo(iso: string, ref: Date): number {
  const t = new Date(iso).getTime()
  if (Number.isNaN(t)) return Number.POSITIVE_INFINITY
  return (ref.getTime() - t) / (1000 * 60 * 60 * 24)
}

export function isConMedMissingDocumentation(row: SubjectConMed): boolean {
  return !row.source_attribution?.trim() || !row.start_date
}

export function summarizeConMeds(rows: SubjectConMed[], refDate = new Date()): ConMedSummaryCounts {
  let active = 0
  let discontinued = 0
  let onHold = 0
  let missingDocumentation = 0
  let recentChanges = 0

  for (const row of rows) {
    if (row.status === 'active') active += 1
    else if (row.status === 'discontinued') discontinued += 1
    else if (row.status === 'on_hold') onHold += 1

    if (isConMedMissingDocumentation(row)) missingDocumentation += 1

    const updatedDays = daysAgo(row.updated_at, refDate)
    const createdDays = daysAgo(row.created_at, refDate)
    if (updatedDays <= RECENT_CHANGE_DAYS || createdDays <= RECENT_CHANGE_DAYS) {
      recentChanges += 1
    }
  }

  return { active, discontinued, onHold, missingDocumentation, recentChanges }
}

export function conMedDisplayName(row: SubjectConMed): string {
  return row.medication_library?.medication_name ?? row.custom_medication_name ?? 'Unspecified medication'
}

export function conMedIndicationLabel(row: SubjectConMed): string | null {
  if (row.indication_text?.trim()) return row.indication_text.trim()
  const fromHistory =
    row.indication_history?.pathology_library?.common_name ??
    row.indication_history?.custom_condition_name
  return fromHistory?.trim() ?? null
}
