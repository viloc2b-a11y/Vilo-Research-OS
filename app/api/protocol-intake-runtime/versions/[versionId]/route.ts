import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase/server'
import { authorizeProtocolIntakeRead } from '@/lib/protocol-intake-runtime/protocol-intake-auth'
import { loadProtocolVersion } from '@/lib/protocol-intake-runtime/load-protocol-version'

type RouteContext = { params: Promise<{ versionId: string }> }

export async function GET(req: NextRequest, context: RouteContext) {
  const { versionId } = await context.params
  const organizationId = req.nextUrl.searchParams.get('organization_id')

  if (!organizationId) {
    return NextResponse.json({ error: 'organization_id is required' }, { status: 400 })
  }

  const auth = await authorizeProtocolIntakeRead(organizationId)
  if (!auth.ok) return NextResponse.json({ error: auth.message }, { status: auth.status })

  const supabase = await createServerClient()
  try {
    const loaded = await loadProtocolVersion(supabase, organizationId, versionId)
    if (!loaded) return NextResponse.json({ error: 'Protocol version not found' }, { status: 404 })
    return NextResponse.json({ ok: true, ...loaded })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to load protocol version'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

