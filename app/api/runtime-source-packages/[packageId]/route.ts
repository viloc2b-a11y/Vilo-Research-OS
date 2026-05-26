import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase/server'
import { loadRuntimeSourcePackage } from '@/lib/runtime-source-package/load-runtime-source-package'
import { authorizeRuntimeSourceRead } from '@/lib/runtime-source-package/runtime-source-auth'

type RouteContext = { params: Promise<{ packageId: string }> }

export async function GET(req: NextRequest, context: RouteContext) {
  const { packageId } = await context.params
  const organizationId = req.nextUrl.searchParams.get('organization_id')

  if (!organizationId) {
    return NextResponse.json({ error: 'organization_id is required' }, { status: 400 })
  }

  const auth = await authorizeRuntimeSourceRead(organizationId)
  if (!auth.ok) {
    return NextResponse.json({ error: auth.message }, { status: auth.status })
  }

  const supabase = await createServerClient()
  try {
    const loaded = await loadRuntimeSourcePackage(supabase, organizationId, packageId)
    if (!loaded) {
      return NextResponse.json({ error: 'Source package not found' }, { status: 404 })
    }
    return NextResponse.json({ ok: true, ...loaded })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to load source package'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
