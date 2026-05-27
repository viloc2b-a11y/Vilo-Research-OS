import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase/server'
import { authorizeDocumentIntelligenceWrite } from '@/lib/document-intelligence/document-intelligence-auth'
import { isDocumentIntelligenceDomain } from '@/lib/document-intelligence/document-domain-mapper'
import type { DocumentIntelligenceDomain } from '@/lib/document-intelligence/document-domain-mapper'
import { setActiveDocumentReference } from '@/lib/document-intelligence/set-active-document-reference'

type RouteContext = { params: Promise<{ intelligenceDocumentId: string }> }

/** Sets active reference for search/evidence — does not mutate runtime or published source. */

export async function POST(req: NextRequest, context: RouteContext) {
  const { intelligenceDocumentId } = await context.params
  let body: {
    organization_id?: string
    study_id?: string
    domains?: string[]
    reason?: string | null
  }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  if (!body.organization_id || !body.study_id || !body.domains?.length) {
    return NextResponse.json(
      { error: 'organization_id, study_id, and domains are required' },
      { status: 400 },
    )
  }

  const auth = await authorizeDocumentIntelligenceWrite(body.organization_id)
  if (!auth.ok) {
    return NextResponse.json({ error: auth.message }, { status: auth.status })
  }

  const domains = body.domains.filter((d): d is DocumentIntelligenceDomain =>
    isDocumentIntelligenceDomain(d),
  )
  if (domains.length === 0) {
    return NextResponse.json({ error: 'No valid domains provided' }, { status: 400 })
  }

  const supabase = await createServerClient()
  try {
    const result = await setActiveDocumentReference(supabase, {
      organizationId: body.organization_id,
      studyId: body.study_id,
      intelligenceDocumentId,
      domains,
      actorId: auth.userId,
      reason: body.reason,
    })
    return NextResponse.json({ ok: true, ...result })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to set active reference'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
