import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase/server'
import { authorizeRuntimeSourcePublicationRead } from '@/lib/runtime-source-publication/runtime-source-publication-auth'
import { listRuntimeSourcePublications } from '@/lib/runtime-source-publication/list-runtime-source-publications'

export async function GET(req: NextRequest) {
  const organizationId = req.nextUrl.searchParams.get('organization_id')
  const studyId = req.nextUrl.searchParams.get('study_id')

  if (!organizationId || !studyId) {
    return NextResponse.json({ error: 'organization_id and study_id are required' }, { status: 400 })
  }

  const auth = await authorizeRuntimeSourcePublicationRead(organizationId)
  if (!auth.ok) return NextResponse.json({ error: auth.message }, { status: auth.status })

  const supabase = await createServerClient()
  try {
    const publications = await listRuntimeSourcePublications({ supabase, organizationId, studyId })
    return NextResponse.json({ ok: true, publications })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to list publications'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

