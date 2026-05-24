import { errorEnvelope, fromRpcThrown } from '@/lib/api/source/envelope'
import { requireOrganizationMember, requireSourceApiContext } from '@/lib/api/source/auth'
import { callSourceRpc } from '@/lib/api/source/call-rpc'
import { jsonEnvelope } from '@/lib/api/source/respond'
import { parseJsonBody, parseOpenBody } from '@/lib/api/source/validate'
import { observeSourceApiOpenResult } from '@/lib/observability/hooks/observe-source-api'

export async function POST(request: Request) {
  const auth = await requireSourceApiContext()
  if (!auth.ok) return auth.response

  const { ctx } = auth
  const raw = await parseJsonBody(request)
  const parsed = parseOpenBody(raw)
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
    const envelope = await callSourceRpc(ctx.supabase, 'open_source_response_set', {
      p_organization_id: body.organization_id,
      p_study_id: body.study_id,
      p_study_version_id: body.study_version_id,
      p_study_subject_id: body.study_subject_id,
      p_visit_id: body.visit_id,
      p_procedure_execution_id: body.procedure_execution_id,
      p_source_definition_version_id: body.source_definition_version_id,
    }, ctx.requestId)
    observeSourceApiOpenResult({
      scope: {
        supabase: ctx.supabase,
        organizationId: body.organization_id,
        studyId: body.study_id,
        studySubjectId: body.study_subject_id,
        visitId: body.visit_id,
        procedureExecutionId: body.procedure_execution_id,
        actorUserId: ctx.user.id,
      },
      envelope,
    })
    return jsonEnvelope(envelope)
  } catch (err) {
    return jsonEnvelope(fromRpcThrown(err, { requestId: ctx.requestId, rpc: 'open_source_response_set' }))
  }
}
