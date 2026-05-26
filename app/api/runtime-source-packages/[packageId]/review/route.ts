import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase/server'
import { reviewRuntimeSourcePackage } from '@/lib/runtime-source-package/review-runtime-source-package'
import { authorizeRuntimeSourceWrite } from '@/lib/runtime-source-package/runtime-source-auth'

type RouteContext = { params: Promise<{ packageId: string }> }

export async function POST(req: NextRequest, context: RouteContext) {
  const { packageId } = await context.params

  let body: { organization_id?: string }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const organizationId = body.organization_id
  if (!organizationId) {
    return NextResponse.json({ error: 'organization_id is required' }, { status: 400 })
  }

  const auth = await authorizeRuntimeSourceWrite(organizationId)
  if (!auth.ok) {
    return NextResponse.json({ error: auth.message }, { status: auth.status })
  }

  const supabase = await createServerClient()
  try {
    const packageRow = await reviewRuntimeSourcePackage({
      supabase,
      organizationId,
      packageId,
      reviewedBy: auth.userId,
    })
    return NextResponse.json({ ok: true, package: packageRow })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to review source package'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
