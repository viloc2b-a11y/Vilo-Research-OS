import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase/server'
import { authorizeSourceBlueprintEvidenceWrite } from '@/lib/source-blueprint-evidence/source-blueprint-evidence-auth'
import { EvidenceReviewStateError } from '@/lib/source-blueprint-evidence/accept-source-blueprint-evidence'
import { mapSourceBlueprintEvidence } from '@/lib/source-blueprint-evidence/map-source-blueprint-evidence'
import type {
  LineageElementType,
  TraceOrigin,
} from '@/lib/source-blueprint-evidence/source-lineage-types'

/** Evidence mapping only — does not update or publish blueprint content. */

type RouteContext = { params: Promise<{ evidenceId: string }> }

export async function POST(req: NextRequest, context: RouteContext) {
  const { evidenceId } = await context.params
  let body: {
    organization_id?: string
    study_id?: string
    mapped_procedure_library_id?: string
    mapped_blueprint_version_id?: string
    mapping_notes?: string | null
    lineage?: Array<{
      element_type: string
      element_key: string
      element_label?: string | null
      trace_origin: string
      coordinator_notes?: string | null
    }>
  }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  if (
    !body.organization_id ||
    !body.study_id ||
    !body.mapped_procedure_library_id ||
    !body.mapped_blueprint_version_id
  ) {
    return NextResponse.json(
      {
        error:
          'organization_id, study_id, mapped_procedure_library_id, and mapped_blueprint_version_id are required',
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
    const evidence = await mapSourceBlueprintEvidence({
      supabase,
      organizationId: body.organization_id,
      studyId: body.study_id,
      evidenceId,
      actorId: auth.userId,
      mappedProcedureLibraryId: body.mapped_procedure_library_id,
      mappedBlueprintVersionId: body.mapped_blueprint_version_id,
      mappingNotes: body.mapping_notes,
      lineage: (body.lineage ?? []).map((row) => ({
        elementType: row.element_type as LineageElementType,
        elementKey: row.element_key,
        elementLabel: row.element_label,
        traceOrigin: row.trace_origin as TraceOrigin,
        coordinatorNotes: row.coordinator_notes,
      })),
    })
    return NextResponse.json({ ok: true, evidence })
  } catch (error) {
    if (error instanceof EvidenceReviewStateError) {
      return NextResponse.json({ error: error.message }, { status: 409 })
    }
    const message = error instanceof Error ? error.message : 'Mapping failed'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
