import { type NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase/server'
import { requireActiveOrganizationAccess } from '@/lib/auth/membership-access'
import { loadInvestigatorCredentials } from '@/lib/regulatory-intelligence/load-investigator-credentials'
import { createInvestigatorCredential } from '@/lib/regulatory-intelligence/create-investigator-credential'
import type { InvestigatorCredentialRow } from '@/lib/regulatory-intelligence/regulatory-types'

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const organizationId = searchParams.get('organization_id')
  const userId = searchParams.get('user_id') ?? undefined
  const studyId = searchParams.get('study_id') ?? undefined

  if (!organizationId) {
    return NextResponse.json(
      { error: 'organization_id is required' },
      { status: 400 },
    )
  }

  const auth = await requireActiveOrganizationAccess(organizationId)
  if (!auth.ok) {
    return NextResponse.json({ error: auth.message }, { status: 401 })
  }

  const supabase = await createServerClient()

  try {
    const credentials = await loadInvestigatorCredentials({
      supabase,
      organizationId,
      userId,
      studyId,
    })
    return NextResponse.json({ credentials })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Internal server error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  const body = await request.json() as {
    organization_id?: string
    input?: Omit<InvestigatorCredentialRow, 'id'>
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
    const credential = await createInvestigatorCredential({
      supabase,
      organizationId,
      input: body.input,
      createdBy: auth.user.id,
    })
    return NextResponse.json({ credential }, { status: 201 })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Internal server error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
