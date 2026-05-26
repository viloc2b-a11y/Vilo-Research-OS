import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase/server'
import { authorizeProtocolIntakeRead } from '@/lib/protocol-intake-runtime/protocol-intake-auth'
import { loadProtocolRuntimeStudy } from '@/lib/protocol-intake-runtime/load-protocol-runtime-study'

type RouteContext = { params: Promise<{ studyRuntimeId: string }> }

export async function GET(req: NextRequest, context: RouteContext) {
  const { studyRuntimeId } = await context.params
  const organizationId = req.nextUrl.searchParams.get('organization_id')

  if (!organizationId) {
    return NextResponse.json({ error: 'organization_id is required' }, { status: 400 })
  }

  const auth = await authorizeProtocolIntakeRead(organizationId)
  if (!auth.ok) return NextResponse.json({ error: auth.message }, { status: auth.status })

  const supabase = await createServerClient()
  try {
    const loaded = await loadProtocolRuntimeStudy(supabase, organizationId, studyRuntimeId)
    if (!loaded) return NextResponse.json({ error: 'Protocol runtime study not found' }, { status: 404 })
    return NextResponse.json({ ok: true, ...loaded })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to load protocol runtime study'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

