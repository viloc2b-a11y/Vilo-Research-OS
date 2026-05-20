import { errorEnvelope, fromRpcThrown } from '@/lib/api/source/envelope'
import { requireOrganizationMember, requireSourceApiContext } from '@/lib/api/source/auth'
import { callSourceRpc } from '@/lib/api/source/call-rpc'
import { jsonEnvelope } from '@/lib/api/source/respond'
import { parseJsonBody, parseSaveDraftBody } from '@/lib/api/source/validate'
import { apiError } from '@/lib/api/source/errors'
import { getOrganizationMemberships } from '@/lib/auth/session'
import {
  canEditClinicalSource,
  canManageSourceDocuments,
  canManageUnblindedData,
} from '@/lib/rbac/permissions'
import { responseItemsContainUnblindedFields } from '@/lib/source/blinding'

export async function POST(request: Request) {
  const auth = await requireSourceApiContext()
  if (!auth.ok) return auth.response

  const { ctx } = auth
  const raw = await parseJsonBody(request)
  const parsed = parseSaveDraftBody(raw)
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
        apiError('FORBIDDEN', 'Your role cannot mutate source documents.'),
      ], { requestId: ctx.requestId }),
      403,
    )
  }
  const containsUnblinded = await responseItemsContainUnblindedFields(
    ctx.supabase,
    body.responses.map((response) => response.source_field_id),
  )
  if (containsUnblinded && !canManageUnblindedData(memberships, body.organization_id)) {
    return jsonEnvelope(
      errorEnvelope('FORBIDDEN', [
        apiError('FORBIDDEN', 'Your role cannot save unblinded source fields.'),
      ], { requestId: ctx.requestId }),
      403,
    )
  }
  try {
    const envelope = await callSourceRpc(ctx.supabase, 'save_source_draft', {
      p_organization_id: body.organization_id,
      p_source_response_set_id: body.source_response_set_id,
      p_responses: body.responses,
    }, ctx.requestId)
    return jsonEnvelope(envelope)
  } catch (err) {
    return jsonEnvelope(fromRpcThrown(err, { requestId: ctx.requestId, rpc: 'save_source_draft' }))
  }
}
