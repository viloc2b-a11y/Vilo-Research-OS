import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase/server'
import { isDocumentIntelligenceDomain } from '@/lib/document-intelligence/document-domain-mapper'
import { authorizeSourceBlueprintEvidenceWrite } from '@/lib/source-blueprint-evidence/source-blueprint-evidence-auth'
import { extractEvidenceFromIntelligenceDocument } from '@/lib/source-blueprint-evidence/extract-evidence-from-intelligence'

export async function POST(req: NextRequest) {
  let body: {
    organization_id?: string
    study_id?: string
    intelligence_document_id?: string
    usage_domain?: string | null
  }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  if (!body.organization_id || !body.study_id || !body.intelligence_document_id) {
    return NextResponse.json(
      {
        error:
          'organization_id, study_id, and intelligence_document_id are required',
      },
      { status: 400 },
    )
  }

  const auth = await authorizeSourceBlueprintEvidenceWrite(body.organization_id)
  if (!auth.ok) {
    return NextResponse.json({ error: auth.message }, { status: auth.status })
  }

  const supabase = await createServerClient()
  try {
    const result = await extractEvidenceFromIntelligenceDocument(supabase, {
      organizationId: body.organization_id,
      studyId: body.study_id,
      intelligenceDocumentId: body.intelligence_document_id,
      usageDomain:
        body.usage_domain && isDocumentIntelligenceDomain(body.usage_domain)
          ? body.usage_domain
          : 'source_creation',
      createdBy: auth.userId,
    })
    return NextResponse.json({ ok: true, ...result })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Extraction failed'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
