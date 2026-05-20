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
import type { ManifestData, ResponseSetDetailData } from '@/lib/api/source/read-types'

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
    const envelope = await callSourceRpc(ctx.supabase, 'get_source_response_set_manifest', {
      p_organization_id: query.organization_id,
      p_source_response_set_id: query.source_response_set_id,
    }, ctx.requestId)
    if (envelope.ok && envelope.data) {
      const memberships = await getOrganizationMemberships(ctx.user.id)
      const canViewUnblinded = canViewUnblindedData(memberships, query.organization_id)
      if (!canViewUnblinded) {
        const detailEnvelope = await callSourceRpc(ctx.supabase, 'get_source_response_set', {
          p_organization_id: query.organization_id,
          p_source_response_set_id: query.source_response_set_id,
        }, ctx.requestId)
        if (detailEnvelope.ok && detailEnvelope.data) {
          const visibleDetail = filterResponseSetDetailForBlinding(
            await attachFieldBlindingToDetail(ctx.supabase, detailEnvelope.data as ResponseSetDetailData),
            false,
          )
          const manifest = envelope.data as ManifestData
          const requiredVisible = visibleDetail.fields.filter((field) => field.is_required)
          const visibleActiveFindings = visibleDetail.findings_summary.active
          envelope.data = {
            ...manifest,
            completeness: {
              ...manifest.completeness,
              required_fields_total: requiredVisible.length,
              required_fields_captured_current: requiredVisible.filter((field) =>
                Boolean(field.current_effective),
              ).length,
            },
            counts: {
              ...manifest.counts,
              responses_current: visibleDetail.fields.filter((field) =>
                Boolean(field.current_effective),
              ).length,
              responses_total: visibleDetail.fields.reduce(
                (count, field) => count + (field.history?.length ?? 0),
                0,
              ),
              corrections: visibleDetail.corrections.length,
              addenda: visibleDetail.addenda.length,
              findings_active: visibleActiveFindings.length,
              findings_open: visibleActiveFindings.filter((finding) => finding.status === 'open').length,
              findings_total: visibleActiveFindings.length,
              fields_total: visibleDetail.fields.length,
            },
          }
        }
      }
    }
    return jsonEnvelope(envelope)
  } catch (err) {
    return jsonEnvelope(
      fromRpcThrown(err, { requestId: ctx.requestId, rpc: 'get_source_response_set_manifest' }),
    )
  }
}
