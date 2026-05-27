import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase/server'
import { authorizeDocumentIntelligenceRead } from '@/lib/document-intelligence/document-intelligence-auth'
import { listIntelligenceDocuments } from '@/lib/document-intelligence/list-intelligence-documents'

export async function GET(req: NextRequest) {
  const organizationId = req.nextUrl.searchParams.get('organization_id')
  const studyId = req.nextUrl.searchParams.get('study_id')

  if (!organizationId || !studyId) {
    return NextResponse.json(
      { error: 'organization_id and study_id are required (K1: single study scope only)' },
      { status: 400 },
    )
  }

  const auth = await authorizeDocumentIntelligenceRead(organizationId)
  if (!auth.ok) {
    return NextResponse.json({ error: auth.message }, { status: auth.status })
  }

  const supabase = await createServerClient()
  try {
    const documents = await listIntelligenceDocuments(supabase, organizationId, studyId)
    return NextResponse.json({ ok: true, documents })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to list documents'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
