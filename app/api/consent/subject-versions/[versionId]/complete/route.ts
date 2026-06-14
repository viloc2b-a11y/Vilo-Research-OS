import { type NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase/server'
import { requireActiveOrganizationAccess } from '@/lib/auth/membership-access'
import { mapSubjectConsentVersionRow } from '@/lib/consent-runtime/consent-types'

type RouteParams = {
  params: Promise<{ versionId: string }>
}

export async function POST(request: NextRequest, { params }: RouteParams) {
  const { versionId } = await params

  const body = await request.json() as {
    organization_id?: string
    study_subject_id?: string
  }

  const { organization_id, study_subject_id } = body

  if (!organization_id) return NextResponse.json({ error: 'organization_id is required' }, { status: 400 })
  if (!study_subject_id) return NextResponse.json({ error: 'study_subject_id is required' }, { status: 400 })

  const auth = await requireActiveOrganizationAccess(organization_id)
  if (!auth.ok) return NextResponse.json({ error: auth.message }, { status: 401 })

  const supabase = await createServerClient()

  try {
    const now = new Date().toISOString()

    const { data, error } = await supabase
      .from('subject_consent_versions')
      .update({
        status: 'active',
        active_at: now,
        completed_at: now,
      })
      .eq('id', versionId)
      .eq('organization_id', organization_id)
      .eq('study_subject_id', study_subject_id)
      .select()
      .single()

    if (error) throw new Error(error.message)
    const version = mapSubjectConsentVersionRow(data as Record<string, unknown>)
    return NextResponse.json({ version })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Internal server error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
