'use server'

import { createClient } from '@supabase/supabase-js'
import { approveReconciliationSession } from '@/lib/protocol-intake-reconciliation/reconciliation-actions'
import { createRuntimeSourcePackage } from '@/lib/runtime-source-package/create-runtime-source-package'

// Uses service role to bypass auth constraints in this local test environment
function getSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) throw new Error('Missing Supabase env vars')
  return createClient(url, key)
}

export async function approveAndGenerateRuntimeAction(args: {
  organizationId: string
  studyId: string
  protocolVersionId: string
  actorId: string
}) {
  const supabase = getSupabase()
  const result = await approveReconciliationSession({
    supabase,
    organizationId: args.organizationId,
    studyId: args.studyId,
    protocolVersionId: args.protocolVersionId,
    actorId: args.actorId
  })
  
  return {
    runtimeSnapshotId: result.runtimeSnapshotId,
    summary: result.summary
  }
}

export async function createSourcePackageAction(args: {
  organizationId: string
  studyId: string
  compositionSnapshotId: string
  actorId: string
  packageName: string
}) {
  const supabase = getSupabase()
  const result = await createRuntimeSourcePackage({
    supabase,
    generatedBy: args.actorId,
    input: {
      organization_id: args.organizationId,
      study_id: args.studyId,
      composition_snapshot_id: args.compositionSnapshotId,
      package_name: args.packageName
    }
  })

  return {
    sourcePackageId: result.package.id,
    visitShellCount: result.visitShellCount,
    procedureShellCount: result.procedureShellCount
  }
}
