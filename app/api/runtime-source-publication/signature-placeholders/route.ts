import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase/server'
import { authorizeRuntimeSourcePublicationRead } from '@/lib/runtime-source-publication/runtime-source-publication-auth'
import { listSignaturePlaceholders } from '@/lib/runtime-source-publication/list-signature-placeholders'

export async function GET(req: NextRequest) {
  const organizationId = req.nextUrl.searchParams.get('organization_id')
  const sourcePackageId = req.nextUrl.searchParams.get('source_package_id')

  if (!organizationId || !sourcePackageId) {
    return NextResponse.json(
      { error: 'organization_id and source_package_id are required' },
      { status: 400 },
    )
  }

  const auth = await authorizeRuntimeSourcePublicationRead(organizationId)
  if (!auth.ok) return NextResponse.json({ error: auth.message }, { status: auth.status })

  const supabase = await createServerClient()
  try {
    const placeholders = await listSignaturePlaceholders({ supabase, organizationId, sourcePackageId })
    return NextResponse.json({ ok: true, placeholders })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to list signature placeholders'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

