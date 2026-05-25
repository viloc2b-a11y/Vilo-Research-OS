import { errorEnvelope, fromRpcThrown } from '@/lib/api/source/envelope'
import { requireOrganizationMember, requireSourceApiContext } from '@/lib/api/source/auth'
import { enforceInternalSourceRoute } from '@/lib/api/source/runtime-isolation-enforcement'
import { callSourceRpc } from '@/lib/api/source/call-rpc'
import { jsonEnvelope } from '@/lib/api/source/respond'
import { parseJsonBody, parseWaiveBody } from '@/lib/api/source/validate'

export async function POST(request: Request) {
  const auth = await requireSourceApiContext()
  if (!auth.ok) return auth.response

  const { ctx } = auth
  const raw = await parseJsonBody(request)
  const parsed = parseWaiveBody(raw)
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
  try {
    const envelope = await callSourceRpc(ctx.supabase, 'waive_source_validation_finding', {
      p_organization_id: body.organization_id,
      p_finding_id: body.finding_id,
      p_waiver_reason: body.comment,
    }, ctx.requestId)
    return jsonEnvelope(envelope)
  } catch (err) {
    return jsonEnvelope(
      fromRpcThrown(err, { requestId: ctx.requestId, rpc: 'waive_source_validation_finding' }),
    )
  }
}
