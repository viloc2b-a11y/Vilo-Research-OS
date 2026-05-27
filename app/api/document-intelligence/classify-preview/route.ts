import { NextRequest, NextResponse } from 'next/server'
import { authorizeDocumentIntelligenceRead } from '@/lib/document-intelligence/document-intelligence-auth'
import { classifyDocumentIntelligence } from '@/lib/document-intelligence/classify-document-intelligence'
import { resolveAppliedDomains } from '@/lib/document-intelligence/document-domain-mapper'

export async function GET(req: NextRequest) {
  const organizationId = req.nextUrl.searchParams.get('organization_id')
  const filename = req.nextUrl.searchParams.get('filename')
  const classification = req.nextUrl.searchParams.get('classification')
  const textSample = req.nextUrl.searchParams.get('text_sample') ?? ''

  if (!organizationId || !filename) {
    return NextResponse.json(
      { error: 'organization_id and filename are required' },
      { status: 400 },
    )
  }

  const auth = await authorizeDocumentIntelligenceRead(organizationId)
  if (!auth.ok) {
    return NextResponse.json({ error: auth.message }, { status: auth.status })
  }

  const result = classifyDocumentIntelligence({
    filename,
    textSample: textSample.slice(0, 2000),
    metadataClassification: classification,
  })

  return NextResponse.json({
    ok: true,
    classification: result,
    serverDefaultDomains: resolveAppliedDomains(
      classification ?? result.classification,
      null,
    ),
  })
}
