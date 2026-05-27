import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase/server'
import {
  authorizeRuntimeSourcePublicationWrite,
} from '@/lib/runtime-source-publication/runtime-source-publication-auth'
import type { PublishRuntimeSourcePackageInput } from '@/lib/runtime-source-publication/runtime-source-publication-types'
import { publishRuntimeSourcePackage, PackageNotApprovedError } from '@/lib/runtime-source-publication/publish-runtime-source-package'

export async function POST(req: NextRequest) {
  let body: PublishRuntimeSourcePackageInput
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  if (!body.organization_id || !body.study_id || !body.source_package_id) {
    return NextResponse.json(
      { error: 'organization_id, study_id, and source_package_id are required' },
      { status: 400 },
    )
  }

  const auth = await authorizeRuntimeSourcePublicationWrite(body.organization_id)
  if (!auth.ok) return NextResponse.json({ error: auth.message }, { status: auth.status })

  const supabase = await createServerClient()
  try {
    const publication = await publishRuntimeSourcePackage({
      supabase,
      organizationId: body.organization_id,
      studyId: body.study_id,
      sourcePackageId: body.source_package_id,
      actorId: auth.userId,
    })
    return NextResponse.json({ ok: true, publication })
  } catch (error) {
    if (error instanceof PackageNotApprovedError) {
      return NextResponse.json({ error: error.message }, { status: 409 })
    }
    const message = error instanceof Error ? error.message : 'Failed to publish source package'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

