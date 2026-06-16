import { NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase/server'

export async function GET(req: Request) {
  const supabase = await createServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const studyId = searchParams.get('studyId')
  if (!studyId) return NextResponse.json({ error: 'studyId required' }, { status: 400 })

  const [studyResult, visitDefResult, subjectResult, amendmentResult] = await Promise.allSettled([
    supabase
      .from('studies')
      .select('id, name, status, created_at')
      .eq('id', studyId)
      .maybeSingle(),
    supabase
      .from('visit_definitions')
      .select('id')
      .eq('study_id', studyId),
    supabase
      .from('study_subjects')
      .select('id')
      .eq('study_id', studyId),
    supabase
      .from('amendments')
      .select('id')
      .eq('study_id', studyId),
  ])

  const visitCount =
    visitDefResult.status === 'fulfilled' ? (visitDefResult.value.data?.length ?? null) : null
  const patientCount =
    subjectResult.status === 'fulfilled' ? (subjectResult.value.data?.length ?? null) : null
  const amendmentCount =
    amendmentResult.status === 'fulfilled' ? (amendmentResult.value.data?.length ?? null) : null
  const studyCreatedAt =
    studyResult.status === 'fulfilled' ? studyResult.value.data?.created_at ?? null : null

  let studyYears: number | null = null
  if (studyCreatedAt) {
    const ageMs = Date.now() - new Date(studyCreatedAt).getTime()
    const ageYears = ageMs / (365.25 * 24 * 60 * 60 * 1000)
    studyYears = Math.max(1, Math.round(ageYears + 0.5))
  }

  return NextResponse.json({
    studyId,
    prefill: {
      total_visits: visitCount,
      total_patients: patientCount,
      study_years: studyYears,
      expected_amendments: amendmentCount,
      expected_screen_failures: null,
      expected_cra_changes: null,
      cta_available: false,
    },
    note: 'Values are prefilled from protocol runtime. Verify and adjust before computing chargemaster.',
  })
}
