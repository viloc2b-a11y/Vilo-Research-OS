import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase/server'
import { publishBlueprintVersion } from '@/lib/procedure-library/publish-blueprint-version'
import { authorizeProcedureLibraryWrite } from '@/lib/procedure-library/procedure-library-auth'

type RouteContext = { params: Promise<{ procedureId: string }> }

export async function POST(req: NextRequest, context: RouteContext) {
  const { procedureId } = await context.params

  let body: { version_id?: string }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const versionId = body.version_id
  if (!versionId) {
    return NextResponse.json({ error: 'version_id is required' }, { status: 400 })
  }

  const auth = await authorizeProcedureLibraryWrite(null)
  if (!auth.ok) {
    return NextResponse.json({ error: auth.message }, { status: auth.status })
  }

  const supabase = await createServerClient()
  try {
    const result = await publishBlueprintVersion({
      supabase,
      procedureId,
      versionId,
    })
    return NextResponse.json({ ok: true, ...result })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to publish blueprint version'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
