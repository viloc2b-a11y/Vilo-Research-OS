import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase/server'
import { completeVisitInstance } from '@/lib/visit-runtime-execution/complete-visit-instance'
import { authorizeVisitRuntimeWrite } from '@/lib/visit-runtime-execution/visit-runtime-auth'

type RouteContext = { params: Promise<{ visitInstanceId: string }> }

export async function POST(req: NextRequest, context: RouteContext) {
  const { visitInstanceId } = await context.params
  let body: { organization_id?: string }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  if (!body.organization_id) {
    return NextResponse.json({ error: 'organization_id is required' }, { status: 400 })
  }

  const auth = await authorizeVisitRuntimeWrite(body.organization_id)
  if (!auth.ok) {
    return NextResponse.json({ error: auth.message }, { status: auth.status })
  }

  const supabase = await createServerClient()
  try {
    const visitInstance = await completeVisitInstance({
      supabase,
      organizationId: body.organization_id,
      visitInstanceId,
      actorId: auth.userId,
    })
    return NextResponse.json({ ok: true, visitInstance })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to complete visit'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
