import sys
import os

def main():
    file_path = 'lib/subject/visit-runtime/actions.ts'
    with open(file_path, 'r', encoding='utf-8') as f:
        content = f.read()

    # 1. Update imports
    content = content.replace(
        "import { signProcedure } from '@/lib/visit-runtime/signProcedure'",
        "import { requestProcedureSignature, completeProcedureSignature } from '@/lib/visit-runtime/signProcedure'"
    )

    # 2. Replace signProcedureAction
    old_action = """export async function signProcedureAction(
  _prev: VisitRuntimeActionState,
  formData: FormData,
): Promise<VisitRuntimeActionState> {
  const ctx = await resolveProcedureContext(
    clean(formData.get('procedure_execution_id')),
    clean(formData.get('organization_id')),
  )
  if (!ctx.ok) return { ok: false, message: ctx.error }

  const memberships = await getOrganizationMemberships(ctx.user.id)
  if (!canEditClinicalSource(memberships, ctx.procedure.organization_id)) {
    return { ok: false, message: 'You do not have permission to sign clinical source.' }
  }

  const hasUnblindedSource = await responseSetHasUnblindedSourceFields(ctx.supabase, {
    organizationId: ctx.procedure.organization_id,
    procedureExecutionId: ctx.procedure.id,
  })
  if (hasUnblindedSource && !canViewUnblindedData(memberships, ctx.procedure.organization_id)) {
    return {
      ok: false,
      message: 'This source includes restricted unblinded fields and requires unblinded signing access.',
    }
  }

  const result = await signProcedure({
    supabase: ctx.supabase,
    procedureExecutionId: ctx.procedure.id,
    organizationId: ctx.procedure.organization_id,
    actorUserId: ctx.user.id,
    expectedUpdatedAt: clean(formData.get('expected_updated_at')),
  })
  if (!result.ok) {
    return {
      ok: false,
      message: coordinatorMessageFromError(new Error(result.error), {
        context: 'sign_procedure_action',
      }),
    }
  }

  revalidatePath(`/source/capture/${ctx.procedure.id}`)
  if ('idempotent' in result && result.idempotent) {
    return { ok: true, message: `Procedure already signed${result.signedAt ? ` at ${result.signedAt}` : ''}.` }
  }
  return { ok: true, message: 'Procedure signed and fields locked.' }
}"""

    new_action = """export async function requestProcedureSignatureAction(
  _prev: VisitRuntimeActionState,
  formData: FormData,
): Promise<VisitRuntimeActionState & { requestId?: string, validation?: any }> {
  const ctx = await resolveProcedureContext(
    clean(formData.get('procedure_execution_id')),
    clean(formData.get('organization_id')),
  )
  if (!ctx.ok) return { ok: false, message: ctx.error }

  const memberships = await getOrganizationMemberships(ctx.user.id)
  if (!canEditClinicalSource(memberships, ctx.procedure.organization_id)) {
    return { ok: false, message: 'You do not have permission to sign clinical source.' }
  }

  const hasUnblindedSource = await responseSetHasUnblindedSourceFields(ctx.supabase, {
    organizationId: ctx.procedure.organization_id,
    procedureExecutionId: ctx.procedure.id,
  })
  if (hasUnblindedSource && !canViewUnblindedData(memberships, ctx.procedure.organization_id)) {
    return {
      ok: false,
      message: 'This source includes restricted unblinded fields and requires unblinded signing access.',
    }
  }

  const result = await requestProcedureSignature({
    supabase: ctx.supabase,
    procedureExecutionId: ctx.procedure.id,
    organizationId: ctx.procedure.organization_id,
    actorUserId: ctx.user.id,
    expectedUpdatedAt: clean(formData.get('expected_updated_at')),
  })
  if (!result.ok) {
    return {
      ok: false,
      message: coordinatorMessageFromError(new Error(result.error), {
        context: 'request_procedure_signature_action',
      }),
    }
  }

  if ('idempotent' in result && result.idempotent) {
    return { ok: true, message: `Procedure already signed.` }
  }

  return { ok: true, message: 'Signature requested.', requestId: result.requestId, validation: result.validation }
}

export async function completeProcedureSignatureAction(
  _prev: VisitRuntimeActionState,
  formData: FormData,
): Promise<VisitRuntimeActionState> {
  const ctx = await resolveProcedureContext(
    clean(formData.get('procedure_execution_id')),
    clean(formData.get('organization_id')),
  )
  if (!ctx.ok) return { ok: false, message: ctx.error }

  const validationStr = clean(formData.get('validation'))
  const validation = validationStr ? JSON.parse(validationStr) : undefined

  const result = await completeProcedureSignature({
    supabase: ctx.supabase,
    procedureExecutionId: ctx.procedure.id,
    organizationId: ctx.procedure.organization_id,
    actorUserId: ctx.user.id,
    validation
  })

  if (!result.ok) {
    return {
      ok: false,
      message: coordinatorMessageFromError(new Error(result.error), {
        context: 'complete_procedure_signature_action',
      }),
    }
  }

  revalidatePath(`/source/capture/${ctx.procedure.id}`)
  return { ok: true, message: 'Procedure signed and fields locked.' }
}"""

    content = content.replace(old_action, new_action)

    with open(file_path, 'w', encoding='utf-8') as f:
        f.write(content)

    print("Success")

if __name__ == "__main__":
    main()
