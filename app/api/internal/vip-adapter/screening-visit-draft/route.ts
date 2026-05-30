import { NextRequest, NextResponse } from 'next/server'
import { authorizeProtocolIntakeWrite } from '@/lib/protocol-intake-runtime/protocol-intake-auth'
import { createServerClient } from '@/lib/supabase/server'
import { generateVipDraft } from '@/lib/vip-adapter'

type RequestBody = {
  organization_id?: string
  study_id?: string
  protocol_runtime_study_id?: string
  protocol_version_id?: string | null
  trace_id?: string
}

export async function POST(req: NextRequest) {
  let body: RequestBody
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  if (!body.organization_id || !body.study_id || !body.protocol_runtime_study_id) {
    return NextResponse.json(
      { error: 'organization_id, study_id, and protocol_runtime_study_id are required' },
      { status: 400 },
    )
  }

  const auth = await authorizeProtocolIntakeWrite(body.organization_id)
  if (!auth.ok) return NextResponse.json({ error: auth.message }, { status: auth.status })

  const supabase = await createServerClient()
  try {
    const result = await generateVipDraft({
      supabase,
      organizationId: body.organization_id,
      studyId: body.study_id,
      protocolRuntimeStudyId: body.protocol_runtime_study_id,
      protocolVersionId: body.protocol_version_id,
      traceId: body.trace_id,
    })

    return NextResponse.json({
      ok: true,
      trace_id: result.traceId,
      vip: result.vip,
      fallback: result.fallback,
      artifact: result.artifact,
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to generate VIP draft'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
