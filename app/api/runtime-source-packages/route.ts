import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase/server'
import { createRuntimeSourcePackage } from '@/lib/runtime-source-package/create-runtime-source-package'
import { listRuntimeSourcePackages } from '@/lib/runtime-source-package/list-runtime-source-packages'
import {
  authorizeRuntimeSourceRead,
  authorizeRuntimeSourceWrite,
} from '@/lib/runtime-source-package/runtime-source-auth'
import type { CreateRuntimeSourcePackageInput } from '@/lib/runtime-source-package/source-package-types'

export async function GET(req: NextRequest) {
  const organizationId = req.nextUrl.searchParams.get('organization_id')
  const studyId = req.nextUrl.searchParams.get('study_id')

  if (!organizationId || !studyId) {
    return NextResponse.json({ error: 'organization_id and study_id are required' }, { status: 400 })
  }

  const auth = await authorizeRuntimeSourceRead(organizationId)
  if (!auth.ok) {
    return NextResponse.json({ error: auth.message }, { status: auth.status })
  }

  const supabase = await createServerClient()
  try {
    const packages = await listRuntimeSourcePackages(supabase, organizationId, studyId)
    return NextResponse.json({ ok: true, packages })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to list source packages'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  let body: CreateRuntimeSourcePackageInput
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  if (!body.organization_id || !body.study_id || !body.composition_snapshot_id || !body.package_name) {
    return NextResponse.json(
      {
        error: 'organization_id, study_id, composition_snapshot_id, and package_name are required',
      },
      { status: 400 },
    )
  }

  const auth = await authorizeRuntimeSourceWrite(body.organization_id)
  if (!auth.ok) {
    return NextResponse.json({ error: auth.message }, { status: auth.status })
  }

  const supabase = await createServerClient()
  try {
    const result = await createRuntimeSourcePackage({
      supabase,
      input: body,
      generatedBy: auth.userId,
    })
    return NextResponse.json({
      ok: true,
      package_id: result.package.id,
      package_hash: result.packageHash,
      package: result.package,
      visit_shell_count: result.visitShellCount,
      procedure_shell_count: result.procedureShellCount,
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to create source package'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
