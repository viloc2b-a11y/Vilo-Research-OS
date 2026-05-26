import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase/server'
import { authorizeProtocolIntakeWrite } from '@/lib/protocol-intake-runtime/protocol-intake-auth'
import { extractProtocolVersion } from '@/lib/protocol-intake-runtime/run-extraction-pipeline'

type RouteContext = { params: Promise<{ versionId: string }> }

export async function POST(req: NextRequest, context: RouteContext) {
  const { versionId } = await context.params
  let body: { organization_id?: string }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  if (!body.organization_id) {
    return NextResponse.json({ error: 'organization_id is required' }, { status: 400 })
  }

  const auth = await authorizeProtocolIntakeWrite(body.organization_id)
  if (!auth.ok) return NextResponse.json({ error: auth.message }, { status: auth.status })

  const supabase = await createServerClient()
  try {
    const result = await extractProtocolVersion({
      supabase,
      organizationId: body.organization_id,
      versionId,
      actorId: auth.userId,
    })
    return NextResponse.json({ ok: true, ...result })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to extract protocol version'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

