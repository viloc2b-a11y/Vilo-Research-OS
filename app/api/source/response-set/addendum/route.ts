import { errorEnvelope, fromRpcThrown } from '@/lib/api/source/envelope'
import { requireOrganizationMember, requireSourceApiContext } from '@/lib/api/source/auth'
import { callSourceRpc } from '@/lib/api/source/call-rpc'
import { jsonEnvelope } from '@/lib/api/source/respond'
import { parseAddendumBody, parseJsonBody } from '@/lib/api/source/validate'

export async function POST(request: Request) {
  const auth = await requireSourceApiContext()
  if (!auth.ok) return auth.response

  const { ctx } = auth
  const raw = await parseJsonBody(request)
  const parsed = parseAddendumBody(raw)
  if (!parsed.ok) {
    return jsonEnvelope(
      errorEnvelope('INVALID_REQUEST', parsed.errors, { requestId: ctx.requestId }),
      400,
    )
  }

  const orgCheck = await requireOrganizationMember(ctx, parsed.data.organization_id)
  if (!orgCheck.ok) return orgCheck.response

  const body = parsed.data
  try {
    const envelope = await callSourceRpc(ctx.supabase, 'add_source_addendum', {
      p_organization_id: body.organization_id,
      p_source_response_set_id: body.source_response_set_id,
      p_source_field_id: body.source_field_id,
      p_value: body.value,
      p_reason: body.reason,
      p_introduced_by_source_definition_version_id: body.introduced_by_source_definition_version_id,
    }, ctx.requestId)
    return jsonEnvelope(envelope)
  } catch (err) {
    return jsonEnvelope(fromRpcThrown(err, { requestId: ctx.requestId, rpc: 'add_source_addendum' }))
  }
}
