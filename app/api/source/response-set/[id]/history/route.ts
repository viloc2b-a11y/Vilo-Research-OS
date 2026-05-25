import { errorEnvelope, fromRpcThrown } from '@/lib/api/source/envelope'
import { requireOrganizationMember, requireSourceApiContext } from '@/lib/api/source/auth'
import {
  enforceInternalSourceRoute,
  enforceReplayRoute,
  resolveSourceRuntimeActor,
} from '@/lib/api/source/runtime-isolation-enforcement'
import { callSourceRpc } from '@/lib/api/source/call-rpc'
import { jsonEnvelope } from '@/lib/api/source/respond'
import { parseHistoryQuery } from '@/lib/api/source/validate'
import { getOrganizationMemberships } from '@/lib/auth/session'
import {
  attachFieldBlindingToDetail,
  filterHistoryForBlinding,
} from '@/lib/source/blinding'
import { canViewUnblindedData } from '@/lib/rbac/permissions'
import type { HistoryData, ResponseSetDetailData } from '@/lib/api/source/read-types'

type RouteContext = { params: Promise<{ id: string }> }

export async function GET(request: Request, context: RouteContext) {
  const auth = await requireSourceApiContext()
  if (!auth.ok) return auth.response

  const { ctx } = auth
  const { id } = await context.params
  const url = new URL(request.url)
  const parsed = parseHistoryQuery(id, url.searchParams)
  if (!parsed.ok) {
    return jsonEnvelope(
      errorEnvelope('INVALID_REQUEST', parsed.errors, { requestId: ctx.requestId }),
      400,
    )
  }

  const orgCheck = await requireOrganizationMember(ctx, parsed.data.organization_id)
  if (!orgCheck.ok) return orgCheck.response

  const actor = await resolveSourceRuntimeActor(ctx, parsed.data.organization_id)
  const replayGuard = enforceReplayRoute(ctx, actor)
  if (!replayGuard.ok) return replayGuard.response
  const internal = await enforceInternalSourceRoute(ctx, parsed.data.organization_id)
  if (!internal.ok) return internal.response

  const query = parsed.data
  try {
    const envelope = await callSourceRpc(ctx.supabase, 'get_source_response_set_history', {
      p_organization_id: query.organization_id,
      p_source_response_set_id: query.source_response_set_id,
    }, ctx.requestId)

    if (envelope.ok && envelope.data) {
      const detailEnvelope = await callSourceRpc(ctx.supabase, 'get_source_response_set', {
        p_organization_id: query.organization_id,
        p_source_response_set_id: query.source_response_set_id,
      }, ctx.requestId)
      const memberships = await getOrganizationMemberships(ctx.user.id)
      const canViewUnblinded = canViewUnblindedData(memberships, query.organization_id)
      const detail = detailEnvelope.ok && detailEnvelope.data
        ? await attachFieldBlindingToDetail(ctx.supabase, detailEnvelope.data as ResponseSetDetailData)
        : null
      envelope.data = filterHistoryForBlinding(
        envelope.data as HistoryData,
        detail,
        canViewUnblinded,
      )
    }

    if (query.limit !== null || query.cursor !== null) {
      envelope.meta = {
        ...envelope.meta,
        pagination: {
          limit: query.limit,
          cursor: query.cursor,
          applied: false,
        },
      }
    }

    return jsonEnvelope(envelope)
  } catch (err) {
    return jsonEnvelope(
      fromRpcThrown(err, { requestId: ctx.requestId, rpc: 'get_source_response_set_history' }),
    )
  }
}
