import { type NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase/server'
import { requireActiveOrganizationAccess } from '@/lib/auth/membership-access'

type RouteContext = { params: Promise<{ studyId: string; versionId: string }> }

const ALLOWED_MANUAL_STATUSES = ['pending', 'submitted', 'irb_review', 'approved'] as const
type ManualStatus = (typeof ALLOWED_MANUAL_STATUSES)[number]

type RequestBody = {
  organization_id: string
  status: ManualStatus
  notes?: string
}

export async function PATCH(req: NextRequest, context: RouteContext): Promise<NextResponse> {
  const { studyId, versionId } = await context.params

  let body: RequestBody
  try {
    body = (await req.json()) as RequestBody
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const { organization_id, status, notes } = body

  if (!organization_id) {
    return NextResponse.json({ error: 'organization_id is required' }, { status: 400 })
  }

  if (!ALLOWED_MANUAL_STATUSES.includes(status)) {
    return NextResponse.json(
      { error: `status must be one of: ${ALLOWED_MANUAL_STATUSES.join(', ')}` },
      { status: 400 },
    )
  }

  const auth = await requireActiveOrganizationAccess(organization_id)
  if (!auth.ok) {
    return NextResponse.json({ error: auth.message }, { status: 401 })
  }

  const supabase = await createServerClient()
  const now = new Date().toISOString()

  const patch: Record<string, unknown> = {
    organization_id,
    study_id: studyId,
    protocol_version_id: versionId,
    status,
    updated_at: now,
  }

  if (status === 'submitted') patch.submitted_at = now
  if (status === 'irb_review') patch.irb_review_at = now
  if (status === 'approved') patch.approved_at = now
  if (notes !== undefined) patch.notes = notes

  const { error } = await supabase
    .from('study_amendment_statuses')
    .upsert(patch, { onConflict: 'protocol_version_id' })

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ ok: true, status })
}
