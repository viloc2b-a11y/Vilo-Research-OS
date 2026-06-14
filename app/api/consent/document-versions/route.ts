import { type NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase/server'
import { requireActiveOrganizationAccess } from '@/lib/auth/membership-access'
import { loadConsentDocumentVersions } from '@/lib/consent-runtime/load-consent-document-versions'
import { mapConsentDocumentVersionRow } from '@/lib/consent-runtime/consent-types'

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const organizationId = searchParams.get('organization_id')
  const studyId = searchParams.get('study_id')

  if (!organizationId) return NextResponse.json({ error: 'organization_id is required' }, { status: 400 })
  if (!studyId) return NextResponse.json({ error: 'study_id is required' }, { status: 400 })

  const auth = await requireActiveOrganizationAccess(organizationId)
  if (!auth.ok) return NextResponse.json({ error: auth.message }, { status: 401 })

  const supabase = await createServerClient()

  try {
    const versions = await loadConsentDocumentVersions({ supabase, organizationId, studyId })
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
    consent_type?: string
    version_number?: number
    version_label?: string
    effective_date?: string
    expiration_date?: string
    reconsent_required?: boolean
    irb_approval_date?: string
    status?: string
  }

  const { organization_id, study_id, consent_type, version_number, effective_date } = body

  if (!organization_id) return NextResponse.json({ error: 'organization_id is required' }, { status: 400 })
  if (!study_id) return NextResponse.json({ error: 'study_id is required' }, { status: 400 })
  if (!consent_type) return NextResponse.json({ error: 'consent_type is required' }, { status: 400 })
  if (version_number == null) return NextResponse.json({ error: 'version_number is required' }, { status: 400 })
  if (!effective_date) return NextResponse.json({ error: 'effective_date is required' }, { status: 400 })

  const auth = await requireActiveOrganizationAccess(organization_id)
  if (!auth.ok) return NextResponse.json({ error: auth.message }, { status: 401 })

  const supabase = await createServerClient()

  try {
    const { data, error } = await supabase
      .from('consent_document_versions')
      .insert({
        organization_id,
        study_id,
        consent_type,
        version_number,
        version_label: body.version_label ?? null,
        effective_date,
        expiration_date: body.expiration_date ?? null,
        reconsent_required: body.reconsent_required ?? false,
        irb_approval_date: body.irb_approval_date ?? null,
        status: body.status ?? 'draft',
        language: 'en',
        created_by: auth.user.id,
      })
      .select()
      .single()

    if (error) throw new Error(error.message)
    const version = mapConsentDocumentVersionRow(data as Record<string, unknown>)
    return NextResponse.json({ version }, { status: 201 })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Internal server error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
