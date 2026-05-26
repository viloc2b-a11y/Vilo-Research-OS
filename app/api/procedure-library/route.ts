import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase/server'
import { createProcedure } from '@/lib/procedure-library/create-procedure'
import { listProcedures } from '@/lib/procedure-library/list-procedures'
import {
  authorizeProcedureLibraryRead,
  authorizeProcedureLibraryWrite,
} from '@/lib/procedure-library/procedure-library-auth'
import type { CreateProcedureInput } from '@/lib/procedure-library/procedure-types'

export async function GET(req: NextRequest) {
  const organizationId = req.nextUrl.searchParams.get('organization_id')
  const auth = await authorizeProcedureLibraryRead(organizationId)
  if (!auth.ok) {
    return NextResponse.json({ error: auth.message }, { status: auth.status })
  }

  const supabase = await createServerClient()
  try {
    const procedures = await listProcedures(supabase, {
      organizationId,
      libraryScope: (req.nextUrl.searchParams.get('library_scope') as 'global' | 'organization' | 'all') ?? 'all',
      status: req.nextUrl.searchParams.get('status'),
      category: req.nextUrl.searchParams.get('category'),
      search: req.nextUrl.searchParams.get('search'),
      limit: 200,
    })
    return NextResponse.json({ ok: true, procedures })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to list procedures'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  let body: CreateProcedureInput
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const auth = await authorizeProcedureLibraryWrite(body.organization_id ?? null)
  if (!auth.ok) {
    return NextResponse.json({ error: auth.message }, { status: auth.status })
  }

  const supabase = await createServerClient()
  try {
    const procedure = await createProcedure({
      supabase,
      input: body,
      createdBy: auth.userId,
    })
    return NextResponse.json({ ok: true, procedure })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to create procedure'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
