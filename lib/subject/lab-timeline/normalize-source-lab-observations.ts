import type { LongitudinalLabObservation } from './types'
import {
  deriveLabSeriesKey,
  isLabCandidateField,
  isLabMetaOnlyField,
  makeObservationValue,
  normalizeLabSeriesLabel,
} from './longitudinal-lab-runtime'

function one<T>(value: T | T[] | null | undefined): T | null {
  if (Array.isArray(value)) return value[0] ?? null
  return value ?? null
}

function lower(value: string | null | undefined): string {
  return (value ?? '').trim().toLowerCase()
}

function parseBooleanText(value: string | null): boolean | null {
  if (!value) return null
  const normalized = value.trim().toLowerCase()
  if (['y', 'yes', 'true', '1'].includes(normalized)) return true
  if (['n', 'no', 'false', '0'].includes(normalized)) return false
  return null
}

function parseDateTime(
  valueDate: string | null,
  valueDatetime: string | null,
  collectionDate: string | null,
  collectionTime: string | null,
  visitDate: string | null,
  fallback: string,
): string {
  if (valueDatetime) return valueDatetime
  if (collectionDate && collectionTime) return `${collectionDate}T${collectionTime}`
  if (collectionDate) return collectionDate
  if (visitDate) return visitDate
  if (valueDate) return valueDate
  return fallback
}

function stringifyJson(value: unknown): string | null {
  if (value === null || value === undefined) return null
  if (typeof value === 'string') return value
  try {
    return JSON.stringify(value)
  } catch {
    return String(value)
  }
}

function asNumber(value: string | null): number | null {
  if (value === null || value === '') return null
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : null
}

export type SourceLabSetRow = {
  id: string
  organization_id: string
  study_id: string
  study_subject_id: string
  visit_id: string | null
  procedure_execution_id: string | null
  source_definition_version_id: string
  status: string
  opened_at: string | null
  submitted_at: string | null
  signed_at: string | null
  locked_at: string | null
  visits?: unknown
  study_subjects?: unknown
  studies?: unknown
}

export type SourceLabResponseRow = {
  id: string
  response_set_id: string
  source_field_id: string
  source_definition_version_id: string
  response_sequence: number
  captured_at: string
  value_text: string | null
  value_number: number | null
  value_boolean: boolean | null
  value_date: string | null
  value_datetime: string | null
  value_json: unknown
  unit: string | null
  normalized_value: string | null
  source_fields?: unknown
}

export type PublishedLabFieldRow = {
  phase4a_source_field_id: string
  source_section_id: string
  source_section_name: string | null
  source_type: string | null
  display_label: string | null
  field_name: string | null
}

export type LabVisitRow = {
  id: string
  scheduled_date: string | null
  actual_date: string | null
  completed_at: string | null
  visit_definitions?: unknown
}

function visitLabelFromRow(row: LabVisitRow | null | undefined): { label: string; code: string | null; date: string | null } {
  if (!row) return { label: 'Visit', code: null, date: null }
  const visit = one(row.visit_definitions) as { label?: string; code?: string } | null
  return {
    label: visit?.label ?? visit?.code ?? 'Visit',
    code: visit?.code ?? null,
    date: row.actual_date ?? row.scheduled_date ?? row.completed_at ?? null,
  }
}

function isCoreLabField(fieldKey: string): boolean {
  const key = lower(fieldKey)
  if (!key) return false
  if (isLabMetaOnlyField(key)) return false
  return true
}

function companionKeys(fieldKey: string): string[] {
  const key = lower(fieldKey)
  return [
    `${key}_unit`,
    `${key}_reference_low`,
    `${key}_reference_high`,
    `${key}_abnormal_flag`,
    `${key}_clinically_significant`,
    `${key}_investigator_assessment`,
    `${key}_collection_datetime`,
    `${key}_collection_date`,
    `${key}_collection_time`,
  ]
}

function genericCompanionKeys(): string[] {
  return [
    'unit',
    'result_unit',
    'reference_low',
    'reference_high',
    'abnormal_flag',
    'lab_abnormal_flag',
    'clinically_significant',
    'lab_clinically_significant',
    'investigator_assessment',
    'collection_datetime',
    'lab_collection_datetime',
    'collection_date',
    'collection_time',
  ]
}

export function normalizeSourceLabObservations(input: {
  sets: SourceLabSetRow[]
  responses: SourceLabResponseRow[]
  publishedFields: PublishedLabFieldRow[]
  visitsById: Map<string, LabVisitRow>
}): LongitudinalLabObservation[] {
  const fieldById = new Map(
    input.publishedFields.map((row) => [
      row.phase4a_source_field_id,
      {
        sectionName: row.source_section_name ?? null,
        sourceType: row.source_type ?? null,
      },
    ]),
  )

  const responsesBySet = new Map<string, SourceLabResponseRow[]>()
  for (const response of input.responses) {
    const list = responsesBySet.get(response.response_set_id) ?? []
    list.push(response)
    responsesBySet.set(response.response_set_id, list)
  }

  const observations: LongitudinalLabObservation[] = []

  for (const set of input.sets) {
    const visit = input.visitsById.get(set.visit_id ?? '') ?? null
    const visitMeta = visitLabelFromRow(visit)
    const responseRows = (responsesBySet.get(set.id) ?? []).slice().sort((a, b) => {
      const bySequence = a.response_sequence - b.response_sequence
      if (bySequence !== 0) return bySequence
      return a.captured_at.localeCompare(b.captured_at)
    })

    if (responseRows.length === 0) continue

    const labRows = responseRows.filter((row) => {
      const field = one(row.source_fields) as { field_key?: string; label?: string } | null
      const meta = fieldById.get(row.source_field_id) ?? null
      return isLabCandidateField(field?.field_key ?? '', field?.label ?? null, meta?.sectionName ?? null, meta?.sourceType ?? null)
    })

    if (labRows.length === 0) continue

    const coreRows = labRows.filter((row) => {
      const field = one(row.source_fields) as { field_key?: string } | null
      return isCoreLabField(field?.field_key ?? '')
    })

    if (coreRows.length === 0) continue

    const coreSeriesKeys = new Set(
      coreRows.map((row) => {
        const field = one(row.source_fields) as { field_key?: string; label?: string } | null
        return deriveLabSeriesKey(field?.field_key ?? '')
      }),
    )
    const singleCoreKey = coreSeriesKeys.size === 1 ? [...coreSeriesKeys][0] : null

    for (const coreRow of coreRows) {
      const field = one(coreRow.source_fields) as { field_key?: string; label?: string } | null
      const fieldKey = lower(field?.field_key)
      if (!fieldKey) continue

      const seriesKey = deriveLabSeriesKey(fieldKey)
      const fieldLabel = field?.label ?? fieldKey
      const meta = fieldById.get(coreRow.source_field_id) ?? null

      const companions = new Map<string, SourceLabResponseRow>()
      for (const row of labRows) {
        if (row.id === coreRow.id) continue
        const rowField = one(row.source_fields) as { field_key?: string; label?: string } | null
        const rowKey = lower(rowField?.field_key)
        if (!rowKey) continue

        const derived = deriveLabSeriesKey(rowKey)
        const matchesSeries =
          derived === seriesKey ||
          companionKeys(fieldKey).includes(rowKey) ||
          genericCompanionKeys().includes(rowKey) ||
          (singleCoreKey !== null && isLabMetaOnlyField(rowKey))

        if (matchesSeries) {
          companions.set(rowKey, row)
        }
      }

      const lookup = (keys: string[]): SourceLabResponseRow | null => {
        for (const key of keys) {
          const found = companions.get(lower(key))
          if (found) return found
        }
        return null
      }

      const value = makeObservationValue({
        value_text: coreRow.value_text,
        value_number: coreRow.value_number,
        value_boolean: coreRow.value_boolean,
        value_date: coreRow.value_date,
        value_datetime: coreRow.value_datetime,
        value_json: coreRow.value_json,
      })

      const collectionDateTimeRow =
        lookup(companionKeys(fieldKey).filter((key) => key.endsWith('_collection_datetime'))) ??
        lookup(['collection_datetime', 'lab_collection_datetime'])
      const collectionDateRow = lookup(companionKeys(fieldKey).filter((key) => key.endsWith('_collection_date'))) ?? lookup(['collection_date'])
      const collectionTimeRow = lookup(companionKeys(fieldKey).filter((key) => key.endsWith('_collection_time'))) ?? lookup(['collection_time'])
      const unitRow = lookup(companionKeys(fieldKey).filter((key) => key.endsWith('_unit'))) ?? lookup(['result_unit', 'unit'])
      const referenceLowRow =
        lookup(companionKeys(fieldKey).filter((key) => key.endsWith('_reference_low'))) ?? lookup(['reference_low'])
      const referenceHighRow =
        lookup(companionKeys(fieldKey).filter((key) => key.endsWith('_reference_high'))) ?? lookup(['reference_high'])
      const abnormalRow =
        lookup(companionKeys(fieldKey).filter((key) => key.endsWith('_abnormal_flag'))) ?? lookup(['abnormal_flag', 'lab_abnormal_flag'])
      const clinicallySignificantRow =
        lookup(companionKeys(fieldKey).filter((key) => key.endsWith('_clinically_significant'))) ??
        lookup(['clinically_significant', 'lab_clinically_significant'])
      const assessmentRow =
        lookup(companionKeys(fieldKey).filter((key) => key.endsWith('_investigator_assessment'))) ??
        lookup(['investigator_assessment'])

      observations.push({
        subjectId: set.study_subject_id,
        studyId: set.study_id,
        responseSetId: set.id,
        responseId: coreRow.id,
        sourceFieldId: coreRow.source_field_id,
        sourceDefinitionVersionId: set.source_definition_version_id,
        visitId: set.visit_id,
        visitLabel: visitMeta.label,
        visitCode: visitMeta.code,
        collectionAt: parseDateTime(
          coreRow.value_date,
          coreRow.value_datetime,
          collectionDateTimeRow?.value_datetime ?? collectionDateTimeRow?.value_text ?? collectionDateRow?.value_date ?? collectionDateRow?.value_text ?? null,
          collectionTimeRow?.value_text ?? null,
          visitMeta.date,
          coreRow.captured_at,
        ),
        capturedAt: coreRow.captured_at,
        seriesKey,
        labName: normalizeLabSeriesLabel(fieldLabel, fieldKey),
        labCategory: meta?.sectionName ?? 'labs',
        fieldKey,
        fieldLabel: normalizeLabSeriesLabel(fieldLabel, fieldKey),
        sourceSectionId: input.publishedFields.find((item) => item.phase4a_source_field_id === coreRow.source_field_id)?.source_section_id ?? null,
        sourceSectionName: meta?.sectionName ?? null,
        sourceType: meta?.sourceType ?? null,
        value,
        unit: unitRow?.unit ?? unitRow?.value_text ?? coreRow.unit ?? null,
        referenceLow: referenceLowRow?.value_number ?? asNumber(referenceLowRow?.value_text ?? null),
        referenceHigh: referenceHighRow?.value_number ?? asNumber(referenceHighRow?.value_text ?? null),
        abnormalFlag:
          abnormalRow?.value_text ??
          (abnormalRow?.value_boolean != null ? (abnormalRow.value_boolean ? 'yes' : 'no') : null),
        clinicallySignificant:
          clinicallySignificantRow?.value_boolean ??
          parseBooleanText(clinicallySignificantRow?.value_text ?? null),
        investigatorAssessment:
          assessmentRow?.value_text ?? stringifyJson(assessmentRow?.value_json),
        sourceStatus: set.status,
      })
    }
  }

  return observations.sort((a, b) => {
    const byCollection = (a.collectionAt ?? '').localeCompare(b.collectionAt ?? '')
    if (byCollection !== 0) return byCollection
    return a.responseId.localeCompare(b.responseId)
  })
}
