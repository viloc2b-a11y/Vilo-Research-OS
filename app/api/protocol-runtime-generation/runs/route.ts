import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase/server'
import { authorizeProtocolRuntimeGenerationRead } from '@/lib/protocol-runtime-generation/protocol-runtime-generation-auth'
import { listGenerationRuns } from '@/lib/protocol-runtime-generation/list-generation-runs'

export async function GET(req: NextRequest) {
  const organizationId = req.nextUrl.searchParams.get('organization_id')
  const protocolVersionId = req.nextUrl.searchParams.get('protocol_version_id')

  if (!organizationId) {
    return NextResponse.json({ error: 'organization_id is required' }, { status: 400 })
  }

  const auth = await authorizeProtocolRuntimeGenerationRead(organizationId)
  if (!auth.ok) return NextResponse.json({ error: auth.message }, { status: auth.status })

  const supabase = await createServerClient()
  try {
    const runs = await listGenerationRuns({
      supabase,
      organizationId,
      protocolVersionId,
      limit: 50,
    })
    return NextResponse.json({ ok: true, runs })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to list generation runs'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

