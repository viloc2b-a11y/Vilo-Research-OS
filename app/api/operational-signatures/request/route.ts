import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase/server'
import {
  OperationalSignatureStateError,
  createOperationalSignatureRequest,
  isOperationalSignatureMeaning,
} from '@/lib/operational-signatures'
import { authorizeOperationalSignatureWrite } from '@/lib/operational-signatures/operational-signature-auth'

export async function POST(req: NextRequest) {
  let body: {
    organization_id?: string
    study_id?: string
    subject_id?: string | null
    visit_id?: string | null
    source_package_id?: string | null
    published_source_id?: string | null
    locked_snapshot_id?: string | null
    artifact_type?: string
    artifact_id?: string
    required_role?: string
    signature_meaning?: string
    metadata?: Record<string, unknown>
  }

  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  if (
    !body.organization_id ||
    !body.study_id ||
    !body.artifact_type ||
    !body.artifact_id ||
    !body.required_role ||
    !body.signature_meaning
  ) {
    return NextResponse.json(
      {
        error:
          'organization_id, study_id, artifact_type, artifact_id, required_role, and signature_meaning are required',
      },
      { status: 400 },
    )
  }
  if (!isOperationalSignatureMeaning(body.signature_meaning)) {
    return NextResponse.json({ error: 'Unsupported signature_meaning' }, { status: 400 })
  }

  const auth = await authorizeOperationalSignatureWrite(body.organization_id)
  if (!auth.ok) return NextResponse.json({ error: auth.message }, { status: auth.status })

  const supabase = await createServerClient()
  try {
    const request = await createOperationalSignatureRequest(supabase, {
      organizationId: body.organization_id,
      studyId: body.study_id,
      subjectId: body.subject_id ?? null,
      visitId: body.visit_id ?? null,
      sourcePackageId: body.source_package_id ?? null,
      publishedSourceId: body.published_source_id ?? null,
      lockedSnapshotId: body.locked_snapshot_id ?? null,
      artifactType: body.artifact_type,
      artifactId: body.artifact_id,
      requiredRole: body.required_role,
      signatureMeaning: body.signature_meaning,
      requestedBy: auth.userId,
      metadata: body.metadata,
    })
    return NextResponse.json({ ok: true, request })
  } catch (error) {
    if (error instanceof OperationalSignatureStateError) {
      return NextResponse.json({ error: error.message }, { status: 409 })
    }
    const message =
      error instanceof Error ? error.message : 'Failed to create operational signature request'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
