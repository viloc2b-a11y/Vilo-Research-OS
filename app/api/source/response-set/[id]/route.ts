import { errorEnvelope, fromRpcThrown } from '@/lib/api/source/envelope'
import { requireOrganizationMember, requireSourceApiContext } from '@/lib/api/source/auth'
import { callSourceRpc } from '@/lib/api/source/call-rpc'
import { jsonEnvelope } from '@/lib/api/source/respond'
import { parseResponseSetReadQuery } from '@/lib/api/source/validate'
import { getOrganizationMemberships } from '@/lib/auth/session'
import {
  attachFieldBlindingToDetail,
  filterResponseSetDetailForBlinding,
} from '@/lib/source/blinding'
import { canViewUnblindedData } from '@/lib/rbac/permissions'
import type { ResponseSetDetailData } from '@/lib/api/source/read-types'

type RouteContext = { params: Promise<{ id: string }> }

export async function GET(request: Request, context: RouteContext) {
  const auth = await requireSourceApiContext()
  if (!auth.ok) return auth.response

  const { ctx } = auth
  const { id } = await context.params
  const url = new URL(request.url)
  const parsed = parseResponseSetReadQuery(id, url.searchParams)
  if (!parsed.ok) {
    return jsonEnvelope(
      errorEnvelope('INVALID_REQUEST', parsed.errors, { requestId: ctx.requestId }),
      400,
    )
  }

  const orgCheck = await requireOrganizationMember(ctx, parsed.data.organization_id)
  if (!orgCheck.ok) return orgCheck.response

  const query = parsed.data
  try {
    const envelope = await callSourceRpc(ctx.supabase, 'get_source_response_set', {
      p_organization_id: query.organization_id,
      p_source_response_set_id: query.source_response_set_id,
    }, ctx.requestId)
    if (envelope.ok && envelope.data) {
      const memberships = await getOrganizationMemberships(ctx.user.id)
      const canViewUnblinded = canViewUnblindedData(memberships, query.organization_id)
      const enriched = await attachFieldBlindingToDetail(
        ctx.supabase,
        envelope.data as ResponseSetDetailData,
      )
      envelope.data = filterResponseSetDetailForBlinding(enriched, canViewUnblinded)
    }
    return jsonEnvelope(envelope)
  } catch (err) {
    return jsonEnvelope(
      fromRpcThrown(err, { requestId: ctx.requestId, rpc: 'get_source_response_set' }),
    )
  }
}
