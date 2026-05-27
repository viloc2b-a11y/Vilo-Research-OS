import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase/server'
import { listPendingOperationalSignatures } from '@/lib/operational-signatures'
import { authorizeOperationalSignatureRead } from '@/lib/operational-signatures/operational-signature-auth'

export async function GET(req: NextRequest) {
  const searchParams = req.nextUrl.searchParams
  const organizationId = searchParams.get('organization_id')?.trim()
  const studyId = searchParams.get('study_id')?.trim() || null

  if (!organizationId) {
    return NextResponse.json({ error: 'organization_id is required' }, { status: 400 })
  }

  const auth = await authorizeOperationalSignatureRead(organizationId)
  if (!auth.ok) return NextResponse.json({ error: auth.message }, { status: auth.status })

  const supabase = await createServerClient()
  try {
    const requests = await listPendingOperationalSignatures(supabase, {
      organizationId,
      studyId,
    })
    return NextResponse.json({ ok: true, requests })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to list pending signatures'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
