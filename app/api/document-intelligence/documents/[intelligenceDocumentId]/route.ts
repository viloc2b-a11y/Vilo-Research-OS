import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase/server'
import { authorizeDocumentIntelligenceRead } from '@/lib/document-intelligence/document-intelligence-auth'
import { loadIntelligenceDocument } from '@/lib/document-intelligence/load-intelligence-document'

type RouteContext = { params: Promise<{ intelligenceDocumentId: string }> }

export async function GET(req: NextRequest, context: RouteContext) {
  const { intelligenceDocumentId } = await context.params
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
    const loaded = await loadIntelligenceDocument(
      supabase,
      organizationId,
      intelligenceDocumentId,
      studyId,
    )
    if (!loaded) {
      return NextResponse.json({ error: 'Intelligence document not found' }, { status: 404 })
    }
    return NextResponse.json({ ok: true, ...loaded })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to load document'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
