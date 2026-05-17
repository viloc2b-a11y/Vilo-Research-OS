import { errorEnvelope, fromRpcThrown } from '@/lib/api/source/envelope'
import { requireOrganizationMember, requireSourceApiContext } from '@/lib/api/source/auth'
import { callSourceRpc } from '@/lib/api/source/call-rpc'
import { jsonEnvelope } from '@/lib/api/source/respond'
import { parseJsonBody, parseSubmitBody } from '@/lib/api/source/validate'

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

  const body = parsed.data
  try {
    const envelope = await callSourceRpc(ctx.supabase, 'submit_source_response_set', {
      p_organization_id: body.organization_id,
      p_source_response_set_id: body.source_response_set_id,
      p_submit_reason: body.submit_reason,
    }, ctx.requestId)
    return jsonEnvelope(envelope)
  } catch (err) {
    return jsonEnvelope(
      fromRpcThrown(err, { requestId: ctx.requestId, rpc: 'submit_source_response_set' }),
    )
  }
}
