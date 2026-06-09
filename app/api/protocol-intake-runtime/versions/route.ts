import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase/server'
import { authorizeProtocolIntakeWrite } from '@/lib/protocol-intake-runtime/protocol-intake-auth'
import { createProtocolVersion } from '@/lib/protocol-intake-runtime/create-protocol-version'
import { createAmendmentLink } from '@/lib/protocol-intake-runtime/create-amendment-link'
import { extractProtocolVersion } from '@/lib/protocol-intake-runtime/run-extraction-pipeline'
import type { CreateProtocolVersionInput } from '@/lib/protocol-intake-runtime/protocol-intake-types'

export async function POST(req: NextRequest) {
  let body: CreateProtocolVersionInput & {
    amendment_link?: { previous_version_id: string; summary?: string }
    run_extraction_after_create?: boolean
  }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  if (!body.organization_id || !body.protocol_runtime_study_id || !body.version_label || !body.source_document_id) {
    return NextResponse.json(
      { error: 'organization_id, protocol_runtime_study_id, version_label, and source_document_id are required' },
      { status: 400 },
    )
  }

  const auth = await authorizeProtocolIntakeWrite(body.organization_id)
  if (!auth.ok) return NextResponse.json({ error: auth.message }, { status: auth.status })

  const supabase = await createServerClient()
  try {
    const version = await createProtocolVersion({ supabase, input: body, createdBy: auth.userId })

    if (body.amendment_link?.previous_version_id) {
      await createAmendmentLink({
        supabase,
        input: {
          organization_id: body.organization_id,
          protocol_runtime_study_id: body.protocol_runtime_study_id,
          previous_protocol_version_id: body.amendment_link.previous_version_id,
          new_protocol_version_id: version.id,
          amendment_type: 'protocol_amendment',
          amendment_summary: body.amendment_link.summary ?? null,
        },
        createdBy: auth.userId,
      })
    }

    if (body.run_extraction_after_create) {
      try {
        const extraction = await extractProtocolVersion({
          supabase,
          organizationId: body.organization_id,
          versionId: version.id,
          actorId: auth.userId,
        })
        return NextResponse.json({ ok: true, version, extraction })
      } catch (extractionError) {
        const extractionMessage =
          extractionError instanceof Error
            ? extractionError.message
            : 'Extraction started but did not complete'
        return NextResponse.json({
          ok: true,
          version,
          extraction_error: extractionMessage,
        })
      }
    }

    return NextResponse.json({ ok: true, version })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to create protocol version'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

