import { after, NextRequest, NextResponse } from 'next/server'
import { createServerClient, createServiceClient } from '@/lib/supabase/server'
import { authorizeDocumentIntelligenceWrite } from '@/lib/document-intelligence/document-intelligence-auth'
import {
  continueIntelligenceIngestion,
  ingestComplianceDocumentForIntelligence,
} from '@/lib/document-intelligence/ingest-compliance-document'
import { createIngestDeadline } from '@/lib/document-intelligence/ingest-runtime'
import type { IngestComplianceDocumentInput } from '@/lib/document-intelligence/document-intelligence-types'

export const maxDuration = 60

export async function POST(req: NextRequest) {
  let body: IngestComplianceDocumentInput
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  if (!body.organization_id || !body.compliance_document_id || !body.study_id) {
    return NextResponse.json(
      {
        error:
          'organization_id, study_id, and compliance_document_id are required (K1: single study scope only)',
      },
      { status: 400 },
    )
  }

  const auth = await authorizeDocumentIntelligenceWrite(body.organization_id)
  if (!auth.ok) {
    return NextResponse.json({ error: auth.message }, { status: auth.status })
  }

  const supabase = await createServerClient()
  const deadlineAtMs = createIngestDeadline()

  try {
    const result = await ingestComplianceDocumentForIntelligence(
      supabase,
      body,
      auth.userId,
      { deadlineAtMs },
    )

    if (result.status === 'processing') {
      const organizationId = body.organization_id
      const intelligenceDocumentId = result.intelligenceDocumentId
      const ingestionRunId = result.ingestionRunId

      after(async () => {
        try {
          const service = await createServiceClient()
          await continueIntelligenceIngestion(
            service,
            organizationId,
            intelligenceDocumentId,
            ingestionRunId,
          )
        } catch {
          // Run remains started; client may poll document detail for status.
        }
      })

      return NextResponse.json({
        ok: true,
        status: 'processing',
        run_id: ingestionRunId,
        intelligence_document_id: intelligenceDocumentId,
        applied_domains: result.appliedDomains,
        result,
      })
    }

    return NextResponse.json({
      ok: true,
      status: 'completed',
      applied_domains: result.appliedDomains,
      result,
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Ingestion failed'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
