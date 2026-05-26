import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase/server'
import { authorizeDocumentIntake } from '@/lib/document-intake/document-intake-auth'
import { cancelComplianceObligation } from '@/lib/document-intake/cancel-obligation'

type RouteContext = { params: Promise<{ obligationId: string }> }

export async function POST(req: NextRequest, context: RouteContext) {
  const { obligationId } = await context.params

  let body: { organization_id?: string; reason?: string }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const organizationId = body.organization_id
  const reason = body.reason?.trim()

  if (!organizationId || !reason) {
    return NextResponse.json({ error: 'organization_id and reason are required' }, { status: 400 })
  }

  const auth = await authorizeDocumentIntake(organizationId)
  if (!auth.ok) {
    return NextResponse.json({ error: auth.message }, { status: auth.status })
  }

  const supabase = await createServerClient()
  try {
    const obligation = await cancelComplianceObligation({
      supabase,
      organizationId,
      obligationId,
      cancelledBy: auth.userId,
      reason,
    })
    return NextResponse.json({ ok: true, obligation })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to cancel obligation'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
