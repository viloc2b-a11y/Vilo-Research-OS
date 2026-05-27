import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase/server'
import { authorizeRuntimeSourcePublicationRead } from '@/lib/runtime-source-publication/runtime-source-publication-auth'
import { loadRuntimeSourcePublication } from '@/lib/runtime-source-publication/load-runtime-source-publication'

type RouteContext = { params: Promise<{ publicationId: string }> }

export async function GET(req: NextRequest, context: RouteContext) {
  const { publicationId } = await context.params
  const organizationId = req.nextUrl.searchParams.get('organization_id')

  if (!organizationId) {
    return NextResponse.json({ error: 'organization_id is required' }, { status: 400 })
  }

  const auth = await authorizeRuntimeSourcePublicationRead(organizationId)
  if (!auth.ok) return NextResponse.json({ error: auth.message }, { status: auth.status })

  const supabase = await createServerClient()
  try {
    const loaded = await loadRuntimeSourcePublication({ supabase, organizationId, publicationId })
    if (!loaded) return NextResponse.json({ error: 'Publication not found' }, { status: 404 })
    return NextResponse.json({ ok: true, ...loaded })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to load publication'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

