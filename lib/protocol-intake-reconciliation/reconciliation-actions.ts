import type { SupabaseClient } from '@supabase/supabase-js'
import { initializeReconciliationFromCandidates } from '@/lib/protocol-reconciliation/initialize-reconciliation-from-candidates'
import { approveVisitReconciliation } from '@/lib/protocol-reconciliation/approve-visit-reconciliation'
import { rejectVisitReconciliation } from '@/lib/protocol-reconciliation/reject-visit-reconciliation'
import { approveProcedureReconciliation } from '@/lib/protocol-reconciliation/approve-procedure-reconciliation'
import { rejectProcedureReconciliation } from '@/lib/protocol-reconciliation/reject-procedure-reconciliation'
import { generateStudyRuntimeFromReconciliation } from '@/lib/protocol-runtime-generation/generate-study-runtime-from-reconciliation'
import { appendReconciliationEvent } from '@/lib/protocol-reconciliation/append-reconciliation-event'
import { RECONCILIATION_EVENT_TYPE } from '@/lib/protocol-reconciliation/protocol-reconciliation-types'

export async function initializeReconciliationSession(args: {
  supabase: SupabaseClient
  organizationId: string
  protocolVersionId: string
  createdBy: string
}) {
  return initializeReconciliationFromCandidates({
    supabase: args.supabase,
    organizationId: args.organizationId,
    protocolVersionId: args.protocolVersionId,
    createdBy: args.createdBy
  })
}

export async function updateVisitCandidateStatus(args: {
  supabase: SupabaseClient
  organizationId: string
  protocolVersionId: string
  visitReconciliationId: string
  status: 'approved' | 'rejected'
  actorId: string
}) {
  if (args.status === 'approved') {
    return approveVisitReconciliation({
      supabase: args.supabase,
      organizationId: args.organizationId,
      visitReconciliationId: args.visitReconciliationId,
      actorId: args.actorId
    })
  } else {
    return rejectVisitReconciliation({
      supabase: args.supabase,
      organizationId: args.organizationId,
      visitReconciliationId: args.visitReconciliationId,
      actorId: args.actorId
    })
  }
}

export async function updateProcedureCandidateStatus(args: {
  supabase: SupabaseClient
  organizationId: string
  protocolVersionId: string
  procedureReconciliationId: string
  status: 'approved' | 'rejected'
  actorId: string
}) {
  if (args.status === 'approved') {
    return approveProcedureReconciliation({
      supabase: args.supabase,
      organizationId: args.organizationId,
      procedureReconciliationId: args.procedureReconciliationId,
      actorId: args.actorId
    })
  } else {
    return rejectProcedureReconciliation({
      supabase: args.supabase,
      organizationId: args.organizationId,
      procedureReconciliationId: args.procedureReconciliationId,
      actorId: args.actorId
    })
  }
}

export async function approveReconciliationSession(args: {
  supabase: SupabaseClient
  organizationId: string
  studyId: string
  protocolVersionId: string
  actorId: string
}) {
  const [visits, procedures] = await Promise.all([
    args.supabase
      .from('protocol_visit_reconciliations')
      .select('id, reconciliation_status')
      .eq('protocol_version_id', args.protocolVersionId)
      .eq('organization_id', args.organizationId)
      .in('reconciliation_status', ['needs_review', 'draft']),
    args.supabase
      .from('protocol_procedure_reconciliations')
      .select('id, reconciliation_status')
      .eq('protocol_version_id', args.protocolVersionId)
      .eq('organization_id', args.organizationId)
      .in('reconciliation_status', ['needs_review', 'draft', 'manual_mapping_required'])
  ])
  
  if (visits.error) throw new Error(visits.error.message)
  if (procedures.error) throw new Error(procedures.error.message)
  
  if (visits.data.length > 0 || procedures.data.length > 0) {
    throw new Error('Approval blocked: Some candidates still require review.')
  }
  
  // Write immutable event to protocol_reconciliation_events
  await appendReconciliationEvent({
    supabase: args.supabase,
    organizationId: args.organizationId,
    protocolVersionId: args.protocolVersionId,
    eventType: RECONCILIATION_EVENT_TYPE.VISIT_APPROVED, // Closest semantic event for the whole protocol
    actorId: args.actorId,
    eventPayload: { action: 'session_approved' },
    stateSnapshot: {
      status: 'approved',
      snapshot: 'approved_snapshot_hash',
    } // In a real implementation this might hash the entire protocol state
  })

  // Trigger runtime generation
  const runtimeResult = await generateStudyRuntimeFromReconciliation({
    supabase: args.supabase,
    organizationId: args.organizationId,
    protocolVersionId: args.protocolVersionId,
    studyId: args.studyId,
    actorId: args.actorId
  })
  
  return {
    status: 'approved',
    runtimeSnapshotId: runtimeResult.runtimeSnapshotId,
    summary: runtimeResult.summary
  }
}
