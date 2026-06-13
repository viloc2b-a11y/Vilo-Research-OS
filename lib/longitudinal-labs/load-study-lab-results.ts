import type { SupabaseClient } from '@supabase/supabase-js'
import {
  mapLongitudinalLabResultRow,
  type LabSignal,
  type LongitudinalLabResultRow,
} from './longitudinal-lab-types'
import { computeSignals } from './compute-signals'

export type StudyLabFilterParams = {
  search?: string
  subjectId?: string
  visitId?: string
  labTestCode?: string
  labCategory?: string
  dateFrom?: string
  dateTo?: string
  signalKinds?: string[]
  limit?: number
  offset?: number
}

export type LabResultWithSignals = {
  id: string
  subjectId: string
  subjectNumber: string | null
  visitId: string | null
  visitName: string | null
  collectionDate: string | null
  resultDate: string | null
  labTestCode: string
  labTestName: string
  labCategory: string
  resultValue: number | null
  resultUnit: string | null
  referenceLow: number | null
  referenceHigh: number | null
  normalFlag: boolean | null
  clinicallySignificantFlag: boolean | null
  baselineFlag: boolean
  signals: LabSignal[]
}

export type StudyLabResponse = {
  results: LabResultWithSignals[]
  totalCount: number
  filterOptions: {
    labTests: string[]
    labCategories: string[]
  }
}

export async function loadStudyLabResults(
  supabase: SupabaseClient,
  studyId: string,
  organizationId: string,
  filters: StudyLabFilterParams = {},
): Promise<StudyLabResponse> {
  const limit = filters.limit ?? 500
  const offset = filters.offset ?? 0

  let query = supabase
    .from('longitudinal_lab_results')
    .select(
      `
      *,
      study_subjects(subject_identifier),
      visit_runtime_instances(visit_name)
    `,
      { count: 'exact' },
    )
    .eq('study_id', studyId)
    .eq('organization_id', organizationId)

  if (filters.search) {
    const term = `%${filters.search}%`
    query = query.or(
      `lab_test_name.ilike.${term},lab_test_code.ilike.${term}`,
    )
  }

  if (filters.subjectId) {
    query = query.eq('subject_id', filters.subjectId)
  }

  if (filters.visitId) {
    query = query.eq('visit_id', filters.visitId)
  }

  if (filters.labTestCode) {
    query = query.eq('lab_test_code', filters.labTestCode)
  }

  if (filters.labCategory) {
    query = query.eq('lab_category', filters.labCategory)
  }

  if (filters.dateFrom) {
    query = query.gte('collection_date', filters.dateFrom)
  }

  if (filters.dateTo) {
    query = query.lte('collection_date', filters.dateTo)
  }

  const { data, error, count } = await query
    .order('collection_date', { ascending: false, nullsFirst: false })
    .range(offset, offset + limit - 1)

  if (error) {
    throw new Error(`Failed to load study lab results: ${error.message}`)
  }

  const raw = (data ?? []) as Record<string, unknown>[]
  const results = raw.map(mapLongitudinalLabResultRow)
  const signalsById = computeSignalsForResults(results)

  const enriched: LabResultWithSignals[] = raw.map((row, idx) => {
    const result = results[idx]
    const subject = row.study_subjects as
      | { subject_identifier: string }
      | null
      | undefined
    const visit = row.visit_runtime_instances as
      | { visit_name: string }
      | null
      | undefined

    return {
      id: result.id,
      subjectId: result.subjectId,
      subjectNumber: subject?.subject_identifier ?? null,
      visitId: result.visitId,
      visitName: visit?.visit_name ?? null,
      collectionDate: result.collectionDate,
      resultDate: result.resultDate,
      labTestCode: result.labTestCode,
      labTestName: result.labTestName,
      labCategory: result.labCategory,
      resultValue: result.resultValue,
      resultUnit: result.resultUnit,
      referenceLow: result.referenceLow,
      referenceHigh: result.referenceHigh,
      normalFlag: result.normalFlag,
      clinicallySignificantFlag: result.clinicallySignificantFlag,
      baselineFlag: result.baselineFlag,
      signals: signalsById.get(result.id) ?? [],
    }
  })

  let finalResults = enriched

  if (filters.signalKinds && filters.signalKinds.length > 0) {
    const kindSet = new Set(filters.signalKinds)
    finalResults = enriched.filter((r) =>
      r.signals.some((s) => kindSet.has(s.kind)),
    )
  }

  const { data: distinctTests } = await supabase
    .from('longitudinal_lab_results')
    .select('lab_test_code')
    .eq('study_id', studyId)
    .eq('organization_id', organizationId)

  const labTests = [
    ...new Set(
      (distinctTests ?? []).map(
        (r: Record<string, unknown>) => r.lab_test_code as string,
      ),
    ),
  ].sort()

  const { data: distinctCategories } = await supabase
    .from('longitudinal_lab_results')
    .select('lab_category')
    .eq('study_id', studyId)
    .eq('organization_id', organizationId)

  const labCategories = [
    ...new Set(
      (distinctCategories ?? []).map(
        (r: Record<string, unknown>) => r.lab_category as string,
      ),
    ),
  ].sort()

  return {
    results: finalResults,
    totalCount: count ?? finalResults.length,
    filterOptions: {
      labTests,
      labCategories,
    },
  }
}

function computeSignalsForResults(
  results: LongitudinalLabResultRow[],
): Map<string, LabSignal[]> {
  const grouped = new Map<string, LongitudinalLabResultRow[]>()

  for (const r of results) {
    const key = `${r.subjectId}:${r.labTestCode}`
    const list = grouped.get(key) ?? []
    list.push(r)
    grouped.set(key, list)
  }

  const signalsByResultId = new Map<string, LabSignal[]>()

  for (const [, group] of grouped) {
    const groupSignals = computeSignals(group)
    for (const signal of groupSignals) {
      const existing = signalsByResultId.get(signal.resultId) ?? []
      existing.push(signal)
      signalsByResultId.set(signal.resultId, existing)
    }
  }

  return signalsByResultId
}
