import { type NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase/server'
import { requireActiveOrganizationAccess } from '@/lib/auth/membership-access'
import { loadSubjectConsents } from '@/lib/consent-runtime/load-subject-consents'
import { mapSubjectConsentVersionRow } from '@/lib/consent-runtime/consent-types'

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const organizationId = searchParams.get('organization_id')
  const studySubjectId = searchParams.get('study_subject_id')

  if (!organizationId) return NextResponse.json({ error: 'organization_id is required' }, { status: 400 })
  if (!studySubjectId) return NextResponse.json({ error: 'study_subject_id is required' }, { status: 400 })

  const auth = await requireActiveOrganizationAccess(organizationId)
  if (!auth.ok) return NextResponse.json({ error: auth.message }, { status: 401 })

  const supabase = await createServerClient()

  try {
    const versions = await loadSubjectConsents({ supabase, organizationId, studySubjectId })
    return NextResponse.json({ versions })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Internal server error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  const body = await request.json() as {
    organization_id?: string
    study_id?: string
    study_subject_id?: string
    consent_type?: string
    consent_version_label?: string
    consent_document_version_id?: string
    reason?: string
  }

  const { organization_id, study_id, study_subject_id, consent_type, consent_version_label } = body

  if (!organization_id) return NextResponse.json({ error: 'organization_id is required' }, { status: 400 })
  if (!study_id) return NextResponse.json({ error: 'study_id is required' }, { status: 400 })
  if (!study_subject_id) return NextResponse.json({ error: 'study_subject_id is required' }, { status: 400 })
  if (!consent_type) return NextResponse.json({ error: 'consent_type is required' }, { status: 400 })
  if (!consent_version_label) return NextResponse.json({ error: 'consent_version_label is required' }, { status: 400 })

  const auth = await requireActiveOrganizationAccess(organization_id)
  if (!auth.ok) return NextResponse.json({ error: auth.message }, { status: 401 })

  const supabase = await createServerClient()

  try {
    const { data, error } = await supabase
      .from('subject_consent_versions')
      .insert({
        organization_id,
        study_id,
        study_subject_id,
        consent_type,
        consent_version_label,
        consent_document_version_id: body.consent_document_version_id ?? null,
        reason: body.reason ?? null,
        status: 'pending',
        created_by: auth.user.id,
      })
      .select()
      .single()

    if (error) throw new Error(error.message)
    const version = mapSubjectConsentVersionRow(data as Record<string, unknown>)
    return NextResponse.json({ version }, { status: 201 })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Internal server error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
