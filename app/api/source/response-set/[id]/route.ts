import { apiError } from '@/lib/api/source/errors'
import { errorEnvelope, fromRpcThrown } from '@/lib/api/source/envelope'
import { requireOrganizationMember, requireSourceApiContext } from '@/lib/api/source/auth'
import { callSourceRpc } from '@/lib/api/source/call-rpc'
import { jsonEnvelope } from '@/lib/api/source/respond'
import { enforceSourceReadIsolation } from '@/lib/api/source/runtime-isolation-enforcement'
import { parseResponseSetReadQuery } from '@/lib/api/source/validate'
import { getOrganizationMemberships } from '@/lib/auth/session'
import {
  assertExternalDtoOnlyResponse,
  assertResponseSetStatusReleasableToExternal,
  mapResponseSetDetailToSourceReviewDto,
  RuntimeIsolationError,
} from '@/lib/external-access'
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

  const isolation = await enforceSourceReadIsolation(ctx, parsed.data.organization_id)
  if (!isolation.ok) return isolation.response

  const query = parsed.data
  try {
    const envelope = await callSourceRpc(ctx.supabase, 'get_source_response_set', {
      p_organization_id: query.organization_id,
      p_source_response_set_id: query.source_response_set_id,
    }, ctx.requestId)

    if (!envelope.ok || !envelope.data) {
      return jsonEnvelope(envelope)
    }

    if (isolation.mode === 'dto_only') {
      try {
        const detail = envelope.data as ResponseSetDetailData
        assertResponseSetStatusReleasableToExternal(detail.response_set.status)
        const dto = mapResponseSetDetailToSourceReviewDto(detail)
        assertExternalDtoOnlyResponse(dto)
        return jsonEnvelope({
          ...envelope,
          data: dto,
          meta: {
            ...envelope.meta,
            projection: 'external_source_review_dto' as const,
          },
        } as typeof envelope)
      } catch (err) {
        if (err instanceof RuntimeIsolationError) {
          return jsonEnvelope(
            errorEnvelope(
              'FORBIDDEN',
              [
                apiError(
                  'FORBIDDEN',
                  err.message,
                  { isolation_code: err.code },
                  null,
                  'api',
                ),
              ],
              { requestId: ctx.requestId },
            ),
            403,
          )
        }
        throw err
      }
    }

    const memberships = await getOrganizationMemberships(ctx.user.id)
    const canViewUnblinded = canViewUnblindedData(memberships, query.organization_id)
    const enriched = await attachFieldBlindingToDetail(
      ctx.supabase,
      envelope.data as ResponseSetDetailData,
    )
    envelope.data = filterResponseSetDetailForBlinding(enriched, canViewUnblinded)
    return jsonEnvelope(envelope)
  } catch (err) {
    return jsonEnvelope(
      fromRpcThrown(err, { requestId: ctx.requestId, rpc: 'get_source_response_set' }),
    )
  }
}
