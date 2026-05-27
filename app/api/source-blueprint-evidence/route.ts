import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase/server'
import { authorizeSourceBlueprintEvidenceRead } from '@/lib/source-blueprint-evidence/source-blueprint-evidence-auth'
import { listSourceBlueprintEvidence } from '@/lib/source-blueprint-evidence/list-source-blueprint-evidence'
import type { EvidenceKind, EvidenceStatus } from '@/lib/source-blueprint-evidence/source-blueprint-evidence-types'
import { isDocumentIntelligenceDomain } from '@/lib/document-intelligence/document-domain-mapper'

export async function GET(req: NextRequest) {
  const organizationId = req.nextUrl.searchParams.get('organization_id')
  const studyId = req.nextUrl.searchParams.get('study_id')
  const evidenceStatus = req.nextUrl.searchParams.get('evidence_status') as EvidenceStatus | null
  const evidenceKind = req.nextUrl.searchParams.get('evidence_kind') as EvidenceKind | null
  const usageDomain = req.nextUrl.searchParams.get('usage_domain')
  const intelligenceDocumentId = req.nextUrl.searchParams.get('intelligence_document_id')

  if (!organizationId || !studyId) {
    return NextResponse.json(
      { error: 'organization_id and study_id are required (single-study scope)' },
      { status: 400 },
    )
  }

  const auth = await authorizeSourceBlueprintEvidenceRead(organizationId)
  if (!auth.ok) {
    return NextResponse.json({ error: auth.message }, { status: auth.status })
  }

  const supabase = await createServerClient()
  try {
    const evidence = await listSourceBlueprintEvidence(supabase, {
      organizationId,
      studyId,
      evidenceStatus: evidenceStatus || null,
      evidenceKind: evidenceKind || null,
      usageDomain:
        usageDomain && isDocumentIntelligenceDomain(usageDomain) ? usageDomain : null,
      intelligenceDocumentId,
    })
    return NextResponse.json({ ok: true, evidence })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to list evidence'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
