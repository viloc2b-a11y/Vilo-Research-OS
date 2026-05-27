import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase/server'
import { authorizeProtocolRuntimeGenerationRead } from '@/lib/protocol-runtime-generation/protocol-runtime-generation-auth'
import { loadGenerationRun } from '@/lib/protocol-runtime-generation/load-generation-run'

type RouteContext = { params: Promise<{ runId: string }> }

export async function GET(req: NextRequest, context: RouteContext) {
  const { runId } = await context.params
  const organizationId = req.nextUrl.searchParams.get('organization_id')

  if (!organizationId) {
    return NextResponse.json({ error: 'organization_id is required' }, { status: 400 })
  }

  const auth = await authorizeProtocolRuntimeGenerationRead(organizationId)
  if (!auth.ok) return NextResponse.json({ error: auth.message }, { status: auth.status })

  const supabase = await createServerClient()
  try {
    const loaded = await loadGenerationRun({ supabase, organizationId, runId })
    if (!loaded) return NextResponse.json({ error: 'Generation run not found' }, { status: 404 })
    return NextResponse.json({ ok: true, ...loaded })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to load generation run'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

