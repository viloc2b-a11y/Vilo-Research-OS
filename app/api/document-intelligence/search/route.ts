import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase/server'
import { authorizeDocumentIntelligenceRead } from '@/lib/document-intelligence/document-intelligence-auth'
import { isDocumentIntelligenceDomain } from '@/lib/document-intelligence/document-domain-mapper'
import { searchDocumentIntelligence } from '@/lib/document-intelligence/search-document-intelligence'

export async function POST(req: NextRequest) {
  let body: {
    organization_id?: string
    study_id?: string | null
    query?: string
    document_classification?: string | null
    domain?: string | null
    limit?: number
    include_superseded?: boolean
  }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  if (!body.organization_id || !body.study_id || !body.query) {
    return NextResponse.json(
      {
        error:
          'organization_id, study_id, and query are required (K1: single study scope only; cross-study search is not available)',
      },
      { status: 400 },
    )
  }

  const auth = await authorizeDocumentIntelligenceRead(body.organization_id)
  if (!auth.ok) {
    return NextResponse.json({ error: auth.message }, { status: auth.status })
  }

  const supabase = await createServerClient()
  try {
    const results = await searchDocumentIntelligence(supabase, {
      organizationId: body.organization_id,
      studyId: body.study_id,
      query: body.query,
      documentClassification: body.document_classification ?? null,
      domain:
        body.domain && isDocumentIntelligenceDomain(body.domain) ? body.domain : null,
      limit: body.limit,
      userId: auth.userId,
      includeSuperseded: body.include_superseded === true,
    })
    return NextResponse.json({ ok: true, results })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Search failed'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
