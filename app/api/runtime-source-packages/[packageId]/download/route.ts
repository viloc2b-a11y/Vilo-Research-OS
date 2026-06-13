import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase/server'
import { loadRuntimeSourcePackage } from '@/lib/runtime-source-package/load-runtime-source-package'
import { authorizeRuntimeSourceRead } from '@/lib/runtime-source-package/runtime-source-auth'

type RouteContext = { params: Promise<{ packageId: string }> }

export async function GET(req: NextRequest, context: RouteContext) {
  const { packageId } = await context.params

  const organizationId = req.nextUrl.searchParams.get('organization_id')
  if (!organizationId) {
    return NextResponse.json({ error: 'organization_id query parameter is required' }, { status: 400 })
  }

  const auth = await authorizeRuntimeSourceRead(organizationId)
  if (!auth.ok) {
    return NextResponse.json({ error: auth.message }, { status: auth.status })
  }

  const supabase = await createServerClient()
  const loaded = await loadRuntimeSourcePackage(supabase, organizationId, packageId)
  if (!loaded) {
    return NextResponse.json({ error: 'Source package not found' }, { status: 404 })
  }

  const { package: pkg, visitShells, procedureShells } = loaded

  const payload = {
    id: pkg.id,
    packageName: pkg.packageName,
    packageVersion: pkg.packageVersion,
    packageStatus: pkg.packageStatus,
    packageHash: pkg.packageHash,
    studyId: pkg.studyId,
    compositionSnapshotId: pkg.compositionSnapshotId,
    packageJson: pkg.packageJson,
    generatedBy: pkg.generatedBy,
    generatedAt: pkg.generatedAt,
    reviewedBy: pkg.reviewedBy,
    reviewedAt: pkg.reviewedAt,
    approvedBy: pkg.approvedBy,
    approvedAt: pkg.approvedAt,
    metadata: pkg.metadata,
    createdAt: pkg.createdAt,
    updatedAt: pkg.updatedAt,
    visitShells: visitShells.map(s => ({
      id: s.id,
      visitCode: s.visitCode,
      visitName: s.visitName,
      visitType: s.visitType,
      sequenceOrder: s.sequenceOrder,
      status: s.status,
      sourceShellJson: s.sourceShellJson,
      createdAt: s.createdAt,
      updatedAt: s.updatedAt,
    })),
    procedureShells: procedureShells.map(s => ({
      id: s.id,
      visitShellId: s.visitShellId,
      procedureCode: s.procedureCode,
      procedureName: s.procedureName,
      procedureOrder: s.procedureOrder,
      required: s.required,
      blueprintVersionId: s.blueprintVersionId,
      status: s.status,
      sourceShellJson: s.sourceShellJson,
      createdAt: s.createdAt,
      updatedAt: s.updatedAt,
    })),
  }

  const body = JSON.stringify(payload, null, 2)

  return new NextResponse(body, {
    status: 200,
    headers: {
      'Content-Type': 'application/json',
      'Content-Disposition': `attachment; filename="runtime-source-package-${packageId}.json"`,
    },
  })
}
