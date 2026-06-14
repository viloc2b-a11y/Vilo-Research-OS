import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase/server'
import { authorizeProtocolReconciliationWrite } from '@/lib/protocol-reconciliation/protocol-reconciliation-auth'
import { resolveProtocolVersionOrg } from '@/lib/protocol-reconciliation/resolve-protocol-version-org'
import { appendReconciliationEvent } from '@/lib/protocol-reconciliation/append-reconciliation-event'
import {
  PROCEDURE_RECONCILIATION_STATUS,
  RECONCILIATION_EVENT_TYPE,
} from '@/lib/protocol-reconciliation/protocol-reconciliation-types'

type RouteContext = { params: Promise<{ versionId: string }> }

export async function POST(req: NextRequest, context: RouteContext) {
  const { versionId } = await context.params

  let body: { organization_id?: string }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  if (!body.organization_id) {
    return NextResponse.json({ error: 'organization_id is required' }, { status: 400 })
  }

  const auth = await authorizeProtocolReconciliationWrite(body.organization_id)
  if (!auth.ok) return NextResponse.json({ error: auth.message }, { status: auth.status })

  const supabase = await createServerClient()

  const versionContext = await resolveProtocolVersionOrg(supabase, body.organization_id, versionId)
  if (!versionContext) {
    return NextResponse.json({ error: 'Protocol version not found' }, { status: 404 })
  }

  const { data: unmatched, error: fetchError } = await supabase
    .from('protocol_procedure_reconciliations')
    .select('id')
    .eq('protocol_version_id', versionId)
    .eq('organization_id', body.organization_id)
    .eq('reconciliation_status', PROCEDURE_RECONCILIATION_STATUS.NEEDS_REVIEW)
    .is('match_confidence', null)

  if (fetchError) {
    return NextResponse.json({ error: fetchError.message }, { status: 500 })
  }

  const ids = (unmatched ?? []).map((r) => String(r.id))

  if (ids.length === 0) {
    return NextResponse.json({ rejectedCount: 0 })
  }

  const { error: updateError } = await supabase
    .from('protocol_procedure_reconciliations')
    .update({ reconciliation_status: PROCEDURE_RECONCILIATION_STATUS.REJECTED })
    .in('id', ids)

  if (updateError) {
    return NextResponse.json({ error: updateError.message }, { status: 500 })
  }

  await appendReconciliationEvent({
    supabase,
    organizationId: body.organization_id,
    protocolVersionId: versionId,
    eventType: RECONCILIATION_EVENT_TYPE.PROCEDURE_BULK_REJECTED,
    actorId: auth.userId,
    procedureReconciliationId: null,
    eventPayload: { count: ids.length, protocol_version_id: versionId },
    stateSnapshot: {
      bulk_action: 'reject_unmatched',
      protocol_version_id: versionId,
      count: ids.length,
    },
  })

  return NextResponse.json({ rejectedCount: ids.length })
}
