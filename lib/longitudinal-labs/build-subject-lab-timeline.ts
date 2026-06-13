import type { SupabaseClient } from '@supabase/supabase-js'
import { loadSubjectTimelines } from './load-subject-timelines'
import { loadLabResults } from './load-lab-results'
import { computeBaseline } from './compute-baseline'
import { computeSignals } from './compute-signals'
import type { SubjectLabTestEntry } from './longitudinal-lab-types'

export async function buildSubjectLabTimeline(
  supabase: SupabaseClient,
  organizationId: string,
  subjectId: string,
): Promise<SubjectLabTestEntry[]> {
  const timelineRows = await loadSubjectTimelines(
    supabase,
    organizationId,
    subjectId,
  )

  const tests: SubjectLabTestEntry[] = []

  for (const row of timelineRows) {
    const results = await loadLabResults(
      supabase,
      organizationId,
      subjectId,
      row.labTestCode,
    )

    const baseline = computeBaseline(results)
    const computedSignals = computeSignals(results)

    tests.push({
      labTestCode: row.labTestCode,
      labTestName: row.labTestName,
      labCategory: row.labCategory,
      baselineResult: results.find((r) => r.id === row.baselineResultId) ?? null,
      latestResult: results.find((r) => r.id === row.latestResultId) ?? null,
      resultCount: row.resultCount,
      changeFromBaseline: baseline?.changeFromBaseline ?? null,
      percentChangeFromBaseline: baseline?.percentChangeFromBaseline ?? null,
      signals: computedSignals.filter((s) => s.labTestCode === row.labTestCode),
    })
  }

  return tests
}
