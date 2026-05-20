import { errorEnvelope, fromRpcThrown } from '@/lib/api/source/envelope'
import { requireOrganizationMember, requireSourceApiContext } from '@/lib/api/source/auth'
import { callSourceRpc } from '@/lib/api/source/call-rpc'
import { jsonEnvelope } from '@/lib/api/source/respond'
import { parseCorrectBody, parseJsonBody } from '@/lib/api/source/validate'
import { apiError } from '@/lib/api/source/errors'
import { getOrganizationMemberships } from '@/lib/auth/session'
import {
  canEditClinicalSource,
  canManageSourceDocuments,
  canManageUnblindedData,
} from '@/lib/rbac/permissions'
import { sourceResponseIsUnblinded } from '@/lib/source/blinding'

export async function POST(request: Request) {
  const auth = await requireSourceApiContext()
  if (!auth.ok) return auth.response

  const { ctx } = auth
  const raw = await parseJsonBody(request)
  const parsed = parseCorrectBody(raw)
  if (!parsed.ok) {
    return jsonEnvelope(
      errorEnvelope('INVALID_REQUEST', parsed.errors, { requestId: ctx.requestId }),
      400,
    )
  }

  const orgCheck = await requireOrganizationMember(ctx, parsed.data.organization_id)
  if (!orgCheck.ok) return orgCheck.response

  const body = parsed.data
  const memberships = await getOrganizationMemberships(ctx.user.id)
  const canMutateSource =
    canManageSourceDocuments(memberships, body.organization_id)
    || canEditClinicalSource(memberships, body.organization_id)
  if (!canMutateSource) {
    return jsonEnvelope(
      errorEnvelope('FORBIDDEN', [
        apiError('FORBIDDEN', 'Your role cannot correct source responses.'),
      ], { requestId: ctx.requestId }),
      403,
    )
  }
  const isUnblinded = await sourceResponseIsUnblinded(ctx.supabase, {
    organizationId: body.organization_id,
    sourceResponseId: body.source_response_id,
  })
  if (isUnblinded && !canManageUnblindedData(memberships, body.organization_id)) {
    return jsonEnvelope(
      errorEnvelope('FORBIDDEN', [
        apiError('FORBIDDEN', 'Your role cannot correct unblinded source fields.'),
      ], { requestId: ctx.requestId }),
      403,
    )
  }
  try {
    const envelope = await callSourceRpc(ctx.supabase, 'correct_source_response', {
      p_organization_id: body.organization_id,
      p_source_response_id: body.source_response_id,
      p_corrected_value: body.corrected_value,
      p_reason: body.correction_reason,
    }, ctx.requestId)
    return jsonEnvelope(envelope)
  } catch (err) {
    return jsonEnvelope(fromRpcThrown(err, { requestId: ctx.requestId, rpc: 'correct_source_response' }))
  }
}
