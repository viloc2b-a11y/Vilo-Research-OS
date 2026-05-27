import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase/server'
import { isDocumentIntelligenceDomain } from '@/lib/document-intelligence/document-domain-mapper'
import { authorizeSourceBlueprintEvidenceWrite } from '@/lib/source-blueprint-evidence/source-blueprint-evidence-auth'
import { createDraftSuggestions } from '@/lib/source-blueprint-drafting/create-draft-suggestions'

export async function POST(req: NextRequest) {
  let body: {
    organization_id?: string
    study_id?: string
    usage_domain?: string | null
    evidence_ids?: string[] | null
  }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  if (!body.organization_id || !body.study_id) {
    return NextResponse.json(
      { error: 'organization_id and study_id are required' },
      { status: 400 },
    )
  }

  const auth = await authorizeSourceBlueprintEvidenceWrite(body.organization_id)
  if (!auth.ok) return NextResponse.json({ error: auth.message }, { status: auth.status })

  const usageDomain =
    body.usage_domain && isDocumentIntelligenceDomain(body.usage_domain)
      ? body.usage_domain
      : null

  const supabase = await createServerClient()
  try {
    const suggestions = await createDraftSuggestions(supabase, {
      organizationId: body.organization_id,
      studyId: body.study_id,
      usageDomain,
      evidenceIds: Array.isArray(body.evidence_ids) ? body.evidence_ids : null,
      createdBy: auth.userId,
    })
    return NextResponse.json({ ok: true, suggestions })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to create draft suggestions'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
