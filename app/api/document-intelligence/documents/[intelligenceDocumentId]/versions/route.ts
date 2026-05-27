import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase/server'
import { authorizeDocumentIntelligenceRead } from '@/lib/document-intelligence/document-intelligence-auth'
import { listDocumentFamilyVersions } from '@/lib/document-intelligence/list-document-family-versions'

type RouteContext = { params: Promise<{ intelligenceDocumentId: string }> }

export async function GET(req: NextRequest, context: RouteContext) {
  const { intelligenceDocumentId } = await context.params
  const organizationId = req.nextUrl.searchParams.get('organization_id')
  const studyId = req.nextUrl.searchParams.get('study_id')

  if (!organizationId || !studyId) {
    return NextResponse.json(
      { error: 'organization_id and study_id are required' },
      { status: 400 },
    )
  }

  const auth = await authorizeDocumentIntelligenceRead(organizationId)
  if (!auth.ok) {
    return NextResponse.json({ error: auth.message }, { status: auth.status })
  }

  const supabase = await createServerClient()
  try {
    const family = await listDocumentFamilyVersions(
      supabase,
      organizationId,
      studyId,
      intelligenceDocumentId,
    )
    return NextResponse.json({ ok: true, ...family })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to load versions'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
