import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase/server'
import { createBlueprintVersion } from '@/lib/procedure-library/create-blueprint-version'
import { loadProcedureBlueprint } from '@/lib/procedure-library/load-blueprint'
import {
  authorizeProcedureLibraryRead,
  authorizeProcedureLibraryWrite,
} from '@/lib/procedure-library/procedure-library-auth'
import type { CreateBlueprintVersionInput } from '@/lib/procedure-library/procedure-types'

type RouteContext = { params: Promise<{ procedureId: string }> }

export async function GET(_req: NextRequest, context: RouteContext) {
  const { procedureId } = await context.params
  const auth = await authorizeProcedureLibraryRead(null)
  if (!auth.ok) {
    return NextResponse.json({ error: auth.message }, { status: auth.status })
  }

  const supabase = await createServerClient()
  try {
    const loaded = await loadProcedureBlueprint(supabase, procedureId)
    if (!loaded) {
      return NextResponse.json({ error: 'Procedure not found' }, { status: 404 })
    }
    return NextResponse.json({ ok: true, ...loaded })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to load blueprint'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

export async function POST(req: NextRequest, context: RouteContext) {
  const { procedureId } = await context.params

  let body: CreateBlueprintVersionInput
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const auth = await authorizeProcedureLibraryWrite(null)
  if (!auth.ok) {
    return NextResponse.json({ error: auth.message }, { status: auth.status })
  }

  const supabase = await createServerClient()
  try {
    const version = await createBlueprintVersion({
      supabase,
      procedureId,
      input: body,
      createdBy: auth.userId,
    })
    return NextResponse.json({ ok: true, version })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to create blueprint version'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
