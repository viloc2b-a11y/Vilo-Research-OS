import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase/server'
import { authorizeDocumentIntake } from '@/lib/document-intake/document-intake-auth'
import { resolveExpirationAlert } from '@/lib/document-intake/resolve-expiration-alert'

type RouteContext = { params: Promise<{ alertId: string }> }

export async function POST(req: NextRequest, context: RouteContext) {
  const { alertId } = await context.params

  let body: { organization_id?: string; resolution_note?: string }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const organizationId = body.organization_id
  const resolutionNote = body.resolution_note?.trim()

  if (!organizationId || !resolutionNote) {
    return NextResponse.json(
      { error: 'organization_id and resolution_note are required' },
      { status: 400 },
    )
  }

  const auth = await authorizeDocumentIntake(organizationId)
  if (!auth.ok) {
    return NextResponse.json({ error: auth.message }, { status: auth.status })
  }

  const supabase = await createServerClient()
  try {
    const alert = await resolveExpirationAlert({
      supabase,
      organizationId,
      alertId,
      resolvedBy: auth.userId,
      resolutionNote,
    })
    return NextResponse.json({ ok: true, alert })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to resolve expiration alert'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
