import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase/server'
import { authorizeDocumentIntake } from '@/lib/document-intake/document-intake-auth'
import { listExpirationAlerts } from '@/lib/document-intake/list-expiration-alerts'

export async function GET(req: NextRequest) {
  const organizationId = req.nextUrl.searchParams.get('organization_id')
  if (!organizationId) {
    return NextResponse.json({ error: 'Missing organization_id' }, { status: 400 })
  }

  const auth = await authorizeDocumentIntake(organizationId)
  if (!auth.ok) {
    return NextResponse.json({ error: auth.message }, { status: auth.status })
  }

  const documentId = req.nextUrl.searchParams.get('document_id')
  const supabase = await createServerClient()

  try {
    const alerts = await listExpirationAlerts(supabase, {
      organizationId,
      documentId: documentId || null,
      limit: 100,
    })
    return NextResponse.json({ ok: true, alerts })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to list expiration alerts'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
