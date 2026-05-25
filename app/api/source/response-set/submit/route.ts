import { errorEnvelope, fromRpcThrown } from '@/lib/api/source/envelope'
import { requireOrganizationMember, requireSourceApiContext } from '@/lib/api/source/auth'
import { enforceInternalSourceRoute } from '@/lib/api/source/runtime-isolation-enforcement'
import { callSourceRpc } from '@/lib/api/source/call-rpc'
import { jsonEnvelope } from '@/lib/api/source/respond'
import { parseJsonBody, parseSubmitBody } from '@/lib/api/source/validate'
import { apiError } from '@/lib/api/source/errors'
import { getOrganizationMemberships } from '@/lib/auth/session'
import {
  canEditClinicalSource,
  canManageSourceDocuments,
  canManageUnblindedData,
} from '@/lib/rbac/permissions'
import { responseSetHasCurrentUnblindedDrafts } from '@/lib/source/blinding'
import { observeSourceApiSubmitResult } from '@/lib/observability/hooks/observe-source-api'

export async function POST(request: Request) {
  const auth = await requireSourceApiContext()
  if (!auth.ok) return auth.response

  const { ctx } = auth
  const raw = await parseJsonBody(request)
  const parsed = parseSubmitBody(raw)
  if (!parsed.ok) {
    return jsonEnvelope(
      errorEnvelope('INVALID_REQUEST', parsed.errors, { requestId: ctx.requestId }),
      400,
    )
  }

  const orgCheck = await requireOrganizationMember(ctx, parsed.data.organization_id)
  if (!orgCheck.ok) return orgCheck.response

  const internal = await enforceInternalSourceRoute(ctx, parsed.data.organization_id)
  if (!internal.ok) return internal.response

  const body = parsed.data
  const memberships = await getOrganizationMemberships(ctx.user.id)
  const canMutateSource =
    canManageSourceDocuments(memberships, body.organization_id)
    || canEditClinicalSource(memberships, body.organization_id)
  if (!canMutateSource) {
    return jsonEnvelope(
      errorEnvelope('FORBIDDEN', [
        apiError('FORBIDDEN', 'Your role cannot submit source documents.'),
      ], { requestId: ctx.requestId }),
      403,
    )
  }
  const hasUnblindedDrafts = await responseSetHasCurrentUnblindedDrafts(ctx.supabase, {
    organizationId: body.organization_id,
    responseSetId: body.source_response_set_id,
  })
  if (hasUnblindedDrafts && !canManageUnblindedData(memberships, body.organization_id)) {
    return jsonEnvelope(
      errorEnvelope('FORBIDDEN', [
        apiError('FORBIDDEN', 'Your role cannot submit unblinded source fields.'),
      ], { requestId: ctx.requestId }),
      403,
    )
  }
  try {
    const envelope = await callSourceRpc(ctx.supabase, 'submit_source_response_set', {
      p_organization_id: body.organization_id,
      p_source_response_set_id: body.source_response_set_id,
      p_submit_reason: body.submit_reason,
    }, ctx.requestId)
    void observeSourceApiSubmitResult({
      supabase: ctx.supabase,
      organizationId: body.organization_id,
      sourceResponseSetId: body.source_response_set_id,
      actorUserId: ctx.user.id,
      envelope,
    })
    return jsonEnvelope(envelope)
  } catch (err) {
    return jsonEnvelope(
      fromRpcThrown(err, { requestId: ctx.requestId, rpc: 'submit_source_response_set' }),
    )
  }
}
