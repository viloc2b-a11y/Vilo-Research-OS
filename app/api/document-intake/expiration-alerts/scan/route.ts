import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase/server'
import { authorizeDocumentIntake } from '@/lib/document-intake/document-intake-auth'
import { runExpirationAlertScan } from '@/lib/document-intake/run-expiration-alert-scan'

export async function POST(req: NextRequest) {
  let body: { organization_id?: string }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const organizationId = body.organization_id
  if (!organizationId) {
    return NextResponse.json({ error: 'organization_id is required' }, { status: 400 })
  }

  const auth = await authorizeDocumentIntake(organizationId)
  if (!auth.ok) {
    return NextResponse.json({ error: auth.message }, { status: auth.status })
  }

  const supabase = await createServerClient()
  try {
    const result = await runExpirationAlertScan({
      supabase,
      organizationId,
      actorId: auth.userId,
    })
    return NextResponse.json({ ok: true, ...result })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to run expiration scan'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
