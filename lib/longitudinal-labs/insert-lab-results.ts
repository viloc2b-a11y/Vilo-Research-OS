import type { SupabaseClient } from '@supabase/supabase-js'
import {
  mapLongitudinalLabResultRow,
  type InsertLabResultInput,
  type LongitudinalLabResultRow,
} from './longitudinal-lab-types'
import { computeBaseline } from './compute-baseline'
import { computeSignals } from './compute-signals'

export type InsertLabResultsArgs = {
  supabase: SupabaseClient
  results: InsertLabResultInput[]
}

export type InsertLabResultsResult = {
  inserted: LongitudinalLabResultRow[]
  signals: ReturnType<typeof computeSignals>
}

export async function insertLabResults(
  args: InsertLabResultsArgs,
): Promise<InsertLabResultsResult> {
  const now = new Date().toISOString()
  const rows = args.results.map((r) => ({
    organization_id: r.organizationId,
    study_id: r.studyId,
    subject_id: r.subjectId,
    visit_id: r.visitId ?? null,
    collection_date: r.collectionDate ?? null,
    result_date: r.resultDate ?? null,
    lab_test_code: r.labTestCode,
    lab_test_name: r.labTestName,
    lab_category: r.labCategory ?? 'labs',
    result_value: r.resultValue ?? null,
    result_unit: r.resultUnit ?? null,
    reference_low: r.referenceLow ?? null,
    reference_high: r.referenceHigh ?? null,
    normal_flag: r.normalFlag ?? null,
    clinically_significant_flag: r.clinicallySignificantFlag ?? null,
    baseline_flag: r.baselineFlag ?? false,
    source_document_id: r.sourceDocumentId ?? null,
    lab_vendor: r.labVendor ?? null,
    metadata: r.metadata ?? {},
    created_at: now,
    updated_at: now,
  }))

  const { data, error } = await args.supabase
    .from('longitudinal_lab_results')
    .insert(rows)
    .select('*')

  if (error || !data) {
    throw new Error(`Failed to insert lab results: ${error?.message ?? 'Unknown error'}`)
  }

  const inserted = data.map((row) =>
    mapLongitudinalLabResultRow(row as Record<string, unknown>),
  )

  const signals = computeSignals(inserted)

  await refreshSubjectTimelines(args.supabase, inserted, now)

  return { inserted, signals }
}

async function refreshSubjectTimelines(
  supabase: SupabaseClient,
  inserted: LongitudinalLabResultRow[],
  now: string,
): Promise<void> {
  const seen = new Set<string>()

  for (const result of inserted) {
    const key = `${result.subjectId}:${result.labTestCode}`
    if (seen.has(key)) continue
    seen.add(key)

    const { data: allResults, error: loadError } = await supabase
      .from('longitudinal_lab_results')
      .select('*')
      .eq('subject_id', result.subjectId)
      .eq('lab_test_code', result.labTestCode)
      .order('collection_date', { ascending: true, nullsFirst: false })
      .order('created_at', { ascending: true })

    if (loadError || !allResults) continue

    const rows = allResults.map((r) =>
      mapLongitudinalLabResultRow(r as Record<string, unknown>),
    )
    const resultIds = rows.map((r) => r.id)
    const lastResult = rows[rows.length - 1]
    const baseline = computeBaseline(rows)

    const timelinePayload: Record<string, unknown> = {
      result_ids: resultIds,
      result_count: resultIds.length,
      latest_result_id: lastResult?.id ?? null,
      baseline_result_id: baseline?.baselineResultId ?? null,
      baseline_value: baseline?.baselineValue ?? null,
      change_from_baseline: baseline?.changeFromBaseline ?? null,
      percent_change_from_baseline: baseline?.percentChangeFromBaseline ?? null,
      updated_at: now,
    }

    const { data: existing } = await supabase
      .from('longitudinal_subject_timelines')
      .select('id')
      .eq('subject_id', result.subjectId)
      .eq('lab_test_code', result.labTestCode)
      .maybeSingle()

    if (existing) {
      await supabase
        .from('longitudinal_subject_timelines')
        .update(timelinePayload)
        .eq('id', String(existing.id))
    } else {
      await supabase.from('longitudinal_subject_timelines').insert({
        organization_id: result.organizationId,
        study_id: result.studyId,
        subject_id: result.subjectId,
        lab_test_code: result.labTestCode,
        lab_test_name: result.labTestName,
        lab_category: result.labCategory,
        ...timelinePayload,
        created_at: now,
      })
    }
  }
}
