import { type NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase/server'
import { requireActiveOrganizationAccess } from '@/lib/auth/membership-access'
import { loadIRBApprovals } from '@/lib/regulatory-intelligence/load-irb-approvals'
import { createIRBApproval } from '@/lib/regulatory-intelligence/create-irb-approval'
import type { IRBApprovalRow } from '@/lib/regulatory-intelligence/regulatory-types'

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const organizationId = searchParams.get('organization_id')
  const studyId = searchParams.get('study_id')

  if (!organizationId) {
    return NextResponse.json(
      { error: 'organization_id is required' },
      { status: 400 },
    )
  }

  if (!studyId) {
    return NextResponse.json(
      { error: 'study_id is required' },
      { status: 400 },
    )
  }

  const auth = await requireActiveOrganizationAccess(organizationId)
  if (!auth.ok) {
    return NextResponse.json({ error: auth.message }, { status: 401 })
  }

  const supabase = await createServerClient()

  try {
    const approvals = await loadIRBApprovals({ supabase, organizationId, studyId })
    return NextResponse.json({ approvals })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Internal server error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  const body = await request.json() as {
    organization_id?: string
    input?: Omit<IRBApprovalRow, 'id'>
  }

  const organizationId = body.organization_id

  if (!organizationId) {
    return NextResponse.json(
      { error: 'organization_id is required' },
      { status: 400 },
    )
  }

  if (!body.input) {
    return NextResponse.json(
      { error: 'input is required' },
      { status: 400 },
    )
  }

  const auth = await requireActiveOrganizationAccess(organizationId)
  if (!auth.ok) {
    return NextResponse.json({ error: auth.message }, { status: 401 })
  }

  const supabase = await createServerClient()

  try {
    const approval = await createIRBApproval({
      supabase,
      organizationId,
      input: body.input,
      createdBy: auth.user.id,
    })
    return NextResponse.json({ approval }, { status: 201 })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Internal server error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
