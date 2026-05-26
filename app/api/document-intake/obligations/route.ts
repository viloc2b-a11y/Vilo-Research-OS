import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase/server'
import { authorizeDocumentIntake } from '@/lib/document-intake/document-intake-auth'
import { createComplianceObligations } from '@/lib/document-intake/create-obligation'
import { listPendingComplianceObligations } from '@/lib/document-intake/list-pending-obligations'
import type { CreateObligationInput } from '@/lib/document-intake/obligation-types'

export async function GET(req: NextRequest) {
  const organizationId = req.nextUrl.searchParams.get('organization_id')
  if (!organizationId) {
    return NextResponse.json({ error: 'Missing organization_id' }, { status: 400 })
  }

  const auth = await authorizeDocumentIntake(organizationId)
  if (!auth.ok) {
    return NextResponse.json({ error: auth.message }, { status: auth.status })
  }

  const assignedUserId = req.nextUrl.searchParams.get('assigned_user_id')
  const assignedRole = req.nextUrl.searchParams.get('assigned_role')
  const documentId = req.nextUrl.searchParams.get('document_id')

  const supabase = await createServerClient()
  try {
    const obligations = await listPendingComplianceObligations(supabase, {
      organizationId,
      assignedUserId: assignedUserId || null,
      assignedRole: assignedRole || null,
      documentId: documentId || null,
      limit: 50,
    })
    return NextResponse.json({ ok: true, obligations })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to list obligations'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  let body: {
    organization_id?: string
    document_id?: string
    obligations?: CreateObligationInput[]
  }

  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const organizationId = body.organization_id
  const documentId = body.document_id
  const obligations = body.obligations

  if (!organizationId || !documentId || !obligations?.length) {
    return NextResponse.json(
      { error: 'organization_id, document_id, and obligations are required' },
      { status: 400 },
    )
  }

  const auth = await authorizeDocumentIntake(organizationId)
  if (!auth.ok) {
    return NextResponse.json({ error: auth.message }, { status: auth.status })
  }

  const supabase = await createServerClient()
  try {
    const result = await createComplianceObligations({
      supabase,
      organizationId,
      documentId,
      obligations,
      requestedBy: auth.userId,
    })
    return NextResponse.json({ ok: true, obligations: result.obligations })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to create obligations'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
