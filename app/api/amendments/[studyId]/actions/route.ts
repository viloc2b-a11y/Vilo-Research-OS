import { type NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase/server'
import { requireActiveOrganizationAccess } from '@/lib/auth/membership-access'
import { computeAmendmentDiff } from '@/lib/financial-runtime/compute/amendment-diff'
import { generateAmendmentActions } from '@/lib/amendment-runtime/generate-amendment-actions'

type RouteContext = { params: Promise<{ studyId: string }> }

type RequestBody = {
  organization_id: string
  protocol_version_id: string
  subject_count: number
}

export async function POST(req: NextRequest, context: RouteContext) {
  const { studyId } = await context.params

  let body: RequestBody
  try {
    body = (await req.json()) as RequestBody
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const { organization_id, protocol_version_id, subject_count } = body

  if (!organization_id || !protocol_version_id) {
    return NextResponse.json(
      { error: 'organization_id and protocol_version_id are required' },
      { status: 400 },
    )
  }

  const auth = await requireActiveOrganizationAccess(organization_id)
  if (!auth.ok) {
    return NextResponse.json({ error: auth.message }, { status: 401 })
  }

  const supabase = await createServerClient()

  try {
    const diffs = await computeAmendmentDiff({ supabase, studyId })
    const diff = diffs.find((d) => d.versionId === protocol_version_id)

    if (!diff) {
      return NextResponse.json(
        { error: 'Protocol version not found for this study' },
        { status: 404 },
      )
    }

    const actionPlan = generateAmendmentActions(diff, studyId, subject_count ?? 0)
    return NextResponse.json({ actionPlan })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to generate action plan'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
