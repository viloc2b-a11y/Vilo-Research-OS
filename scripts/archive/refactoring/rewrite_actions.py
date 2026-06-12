import sys

def main():
    file_path = 'lib/subject/visits/progress-note/actions.ts'
    with open(file_path, 'r', encoding='utf-8') as f:
        content = f.read()

    # Add import
    import_stmt = "import { requestOperationalSignature } from '@/lib/operations/signature-actions'\n"
    if 'requestOperationalSignature' not in content:
        content = content.replace(
            "import { mapRuntimeDbErrorToCoordinatorMessage } from '@/lib/concurrency/db-errors'",
            "import { mapRuntimeDbErrorToCoordinatorMessage } from '@/lib/concurrency/db-errors'\n" + import_stmt
        )

    # 1. Replace Coordinator
    old_coord = """export async function signCoordinatorProgressNoteAction(input: {
  visitId: string
  organizationId: string
  expectedUpdatedAt?: string | null
}): Promise<VisitCloseoutActionResult> {
  const { visitId, organizationId, expectedUpdatedAt } = input
  if (!UUID_RE.test(visitId)) return { ok: false, error: 'Invalid visit id.' }

  const access = await assertVisitWrite(visitId, organizationId)
  if (!access.ok) return access

  const user = await getSessionUser()
  if (!user) return { ok: false, error: 'Sign in required.' }

  const memberships = await getOrganizationMemberships(user.id)
  if (!canEditClinicalSource(memberships, organizationId)) {
    return { ok: false, error: 'You do not have permission to sign clinical source.' }
  }

  const supabase = await createServerClient()

  const hasUnblindedProcedures = await visitHasUnblindedProcedures(supabase, visitId, organizationId)
  if (hasUnblindedProcedures && !canViewUnblindedData(memberships, organizationId)) {
    return { ok: false, error: 'This visit includes unblinded source material and requires unblinded access to sign.' }
  }

  const runtimeValidation = await validateVisitProcedures({ supabase, visitId, organizationId })
  if (!runtimeValidation.ok) {
    return { ok: false, error: runtimeValidation.error }
  }

  const { data: note } = await supabase
    .from('visit_progress_notes')
    .select('id, note_text, updated_at')
    .eq('visit_id', visitId)
    .maybeSingle()

  if (expectedUpdatedAt && note?.updated_at !== expectedUpdatedAt) {
    return { ok: false, error: 'This visit or source was updated elsewhere. Please refresh before signing.' }
  }

  if (!note?.note_text?.trim()) {
    return { ok: false, error: 'Add a progress note before signing.' }
  }

  const guards = await loadVisitCloseoutGuards(
    visitId,
    organizationId,
    note.note_text,
    false,
  )
  if (guards.coordinatorSignBlocked) {
    return { ok: false, error: guards.coordinatorBlockReasons.join(' ') }
  }

  const signedName = await resolveSignerName(user.id)

  const { data: rpcResult, error: rpcError } = await supabase.rpc(
    'sign_visit_coordinator_closeout',
    {
      p_organization_id: organizationId,
      p_visit_id: visitId,
      p_actor_name: signedName,
    },
  )

  if (rpcError) return { ok: false, error: mapRuntimeDbErrorToCoordinatorMessage(rpcError, rpcError.message) }
  const rpc = rpcResult as { ok?: boolean; error?: string | null } | null
  if (!rpc?.ok) {
    const err = rpc?.error ?? 'Coordinator sign-off failed.'
    return {
      ok: false,
      error: /refresh|changed|blocking|submitted/i.test(err) ? `${err} ${STALE_WRITE_USER_MESSAGE}` : mapRuntimeDbErrorToCoordinatorMessage(err, err),
    }
  }

  revalidateVisitPaths(access.studyId, access.subjectId, visitId)
  return { ok: true }
}"""

    new_coord = """export async function requestCoordinatorCloseoutSignatureAction(input: {
  visitId: string
  organizationId: string
  expectedUpdatedAt?: string | null
}): Promise<VisitCloseoutActionResult & { requestId?: string }> {
  const { visitId, organizationId, expectedUpdatedAt } = input
  if (!UUID_RE.test(visitId)) return { ok: false, error: 'Invalid visit id.' }

  const access = await assertVisitWrite(visitId, organizationId)
  if (!access.ok) return access

  const user = await getSessionUser()
  if (!user) return { ok: false, error: 'Sign in required.' }

  const memberships = await getOrganizationMemberships(user.id)
  if (!canEditClinicalSource(memberships, organizationId)) {
    return { ok: false, error: 'You do not have permission to sign clinical source.' }
  }

  const supabase = await createServerClient()

  const hasUnblindedProcedures = await visitHasUnblindedProcedures(supabase, visitId, organizationId)
  if (hasUnblindedProcedures && !canViewUnblindedData(memberships, organizationId)) {
    return { ok: false, error: 'This visit includes unblinded source material and requires unblinded access to sign.' }
  }

  const runtimeValidation = await validateVisitProcedures({ supabase, visitId, organizationId })
  if (!runtimeValidation.ok) {
    return { ok: false, error: runtimeValidation.error }
  }

  const { data: note } = await supabase
    .from('visit_progress_notes')
    .select('id, note_text, updated_at')
    .eq('visit_id', visitId)
    .maybeSingle()

  if (expectedUpdatedAt && note?.updated_at !== expectedUpdatedAt) {
    return { ok: false, error: 'This visit or source was updated elsewhere. Please refresh before signing.' }
  }

  if (!note?.note_text?.trim()) {
    return { ok: false, error: 'Add a progress note before signing.' }
  }

  const guards = await loadVisitCloseoutGuards(
    visitId,
    organizationId,
    note.note_text,
    false,
  )
  if (guards.coordinatorSignBlocked) {
    return { ok: false, error: guards.coordinatorBlockReasons.join(' ') }
  }

  const req = await requestOperationalSignature({
    organizationId,
    studyId: access.studyId,
    subjectId: access.subjectId,
    visitId,
    artifactType: 'visit_closeout',
    artifactId: visitId,
    requiredRole: 'coordinator',
    signatureMeaning: 'I attest that all visit procedures are accurate and complete.'
  })

  if (!req.ok || !req.requestId) return { ok: false, error: 'Failed to request signature.' }

  const { error: updErr } = await supabase.from('visit_progress_notes').update({
    coordinator_signature_request_id: req.requestId
  }).eq('visit_id', visitId)

  if (updErr) return { ok: false, error: mapRuntimeDbErrorToCoordinatorMessage(updErr, updErr.message) }

  return { ok: true, requestId: req.requestId }
}

export async function completeCoordinatorCloseoutSignatureAction(input: {
  visitId: string
  organizationId: string
}): Promise<VisitCloseoutActionResult> {
  const access = await assertVisitWrite(input.visitId, input.organizationId)
  if (!access.ok) return access

  const user = await getSessionUser()
  if (!user) return { ok: false, error: 'Sign in required.' }

  const supabase = await createServerClient()
  
  const { data: note } = await supabase.from('visit_progress_notes').select('coordinator_signature_request_id').eq('visit_id', input.visitId).single()
  if (!note?.coordinator_signature_request_id) return { ok: false, error: 'No signature request found.' }

  const { data: req } = await supabase.from('operational_signature_requests').select('status').eq('id', note.coordinator_signature_request_id).single()
  if (req?.status !== 'signed') return { ok: false, error: 'Signature is not signed yet.' }

  const signedName = await resolveSignerName(user.id)

  const { data: rpcResult, error: rpcError } = await supabase.rpc(
    'sign_visit_coordinator_closeout',
    {
      p_organization_id: input.organizationId,
      p_visit_id: input.visitId,
      p_actor_name: signedName,
    },
  )

  if (rpcError) return { ok: false, error: mapRuntimeDbErrorToCoordinatorMessage(rpcError, rpcError.message) }
  const rpc = rpcResult as { ok?: boolean; error?: string | null } | null
  if (!rpc?.ok) {
    const err = rpc?.error ?? 'Coordinator sign-off failed.'
    return {
      ok: false,
      error: /refresh|changed|blocking|submitted/i.test(err) ? `${err} ${STALE_WRITE_USER_MESSAGE}` : mapRuntimeDbErrorToCoordinatorMessage(err, err),
    }
  }

  revalidateVisitPaths(access.studyId, access.subjectId, input.visitId)
  return { ok: true }
}"""

    content = content.replace(old_coord, new_coord)

    # 2. Replace Investigator
    old_inv = """export async function signInvestigatorReviewAction(input: {
  visitId: string
  organizationId: string
  investigatorRole: InvestigatorRole
  expectedUpdatedAt?: string | null
}): Promise<VisitCloseoutActionResult> {
  const { visitId, organizationId, investigatorRole, expectedUpdatedAt } = input
  if (!UUID_RE.test(visitId)) return { ok: false, error: 'Invalid visit id.' }
  if (
    investigatorRole !== 'principal_investigator'
    && investigatorRole !== 'sub_investigator'
  ) {
    return { ok: false, error: 'Select an investigator role.' }
  }

  const access = await assertVisitWrite(visitId, organizationId)
  if (!access.ok) return access

  const user = await getSessionUser()
  if (!user) return { ok: false, error: 'Sign in required.' }

  // F-07 fix: enforce investigator role server-side
  // Only pi_sub_i, admin, or owner may sign as investigator.
  const memberships = await getOrganizationMemberships(user.id)
  const orgMembership = memberships.find((m) => m.organization_id === organizationId)
  const allRoles = orgMembership
    ? [orgMembership.role, ...orgMembership.roles].filter(Boolean)
    : []
  const hasInvestigatorRole = allRoles.some((r) => canSignClinicalSourceForRole(r))
  if (!hasInvestigatorRole) {
    return {
      ok: false,
      error:
        'Investigator review requires the pi_sub_i, admin, or owner site role. Contact your site administrator.',
    }
  }

  const supabase = await createServerClient()

  const hasUnblindedProcedures = await visitHasUnblindedProcedures(supabase, visitId, organizationId)
  if (hasUnblindedProcedures && !canViewUnblindedData(memberships, organizationId)) {
    return { ok: false, error: 'This visit includes unblinded source material and requires unblinded access to sign.' }
  }

  const runtimeValidation = await validateVisitProcedures({ supabase, visitId, organizationId })
  if (!runtimeValidation.ok) {
    return { ok: false, error: runtimeValidation.error }
  }

  const { data: visit } = await supabase
    .from('visits')
    .select('visit_review_status')
    .eq('id', visitId)
    .maybeSingle()

  if (
    visit?.visit_review_status !== 'coordinator_signed'
    && visit?.visit_review_status !== 'investigator_signed'
  ) {
    return { ok: false, error: 'Coordinator must sign the progress note first.' }
  }

  const { data: note } = await supabase
    .from('visit_progress_notes')
    .select('note_text, coordinator_signature_status, updated_at')
    .eq('visit_id', visitId)
    .maybeSingle()

  if (expectedUpdatedAt && note?.updated_at !== expectedUpdatedAt) {
    return { ok: false, error: 'This visit or source was updated elsewhere. Please refresh before signing.' }
  }

  const guards = await loadVisitCloseoutGuards(
    visitId,
    organizationId,
    note?.note_text,
    note?.coordinator_signature_status === 'signed',
  )
  if (guards.investigatorSignBlocked) {
    return { ok: false, error: guards.investigatorBlockReasons.join(' ') }
  }

  const signedName = await resolveSignerName(user.id)

  const { data: rpcResult, error: rpcError } = await supabase.rpc(
    'sign_visit_investigator_closeout',
    {
      p_organization_id: organizationId,
      p_visit_id: visitId,
      p_investigator_role: investigatorRole,
      p_actor_name: signedName,
    },
  )

  if (rpcError) return { ok: false, error: mapRuntimeDbErrorToCoordinatorMessage(rpcError, rpcError.message) }
  const rpc = rpcResult as { ok?: boolean; error?: string | null } | null
  if (!rpc?.ok) {
    return { ok: false, error: mapRuntimeDbErrorToCoordinatorMessage(rpc?.error, 'Investigator sign-off failed.') }
  }

  const coupling = await applyVisitCompletionCoupling(visitId, organizationId)

  revalidateVisitPaths(access.studyId, access.subjectId, visitId)
  return {
    ok: true,
    visitAutoCompleted: coupling.autoCompleted,
  }
}"""

    new_inv = """export async function requestInvestigatorCloseoutSignatureAction(input: {
  visitId: string
  organizationId: string
  investigatorRole: InvestigatorRole
  expectedUpdatedAt?: string | null
}): Promise<VisitCloseoutActionResult & { requestId?: string }> {
  const { visitId, organizationId, investigatorRole, expectedUpdatedAt } = input
  if (!UUID_RE.test(visitId)) return { ok: false, error: 'Invalid visit id.' }
  if (
    investigatorRole !== 'principal_investigator'
    && investigatorRole !== 'sub_investigator'
  ) {
    return { ok: false, error: 'Select an investigator role.' }
  }

  const access = await assertVisitWrite(visitId, organizationId)
  if (!access.ok) return access

  const user = await getSessionUser()
  if (!user) return { ok: false, error: 'Sign in required.' }

  const memberships = await getOrganizationMemberships(user.id)
  const orgMembership = memberships.find((m) => m.organization_id === organizationId)
  const allRoles = orgMembership
    ? [orgMembership.role, ...orgMembership.roles].filter(Boolean)
    : []
  const hasInvestigatorRole = allRoles.some((r) => canSignClinicalSourceForRole(r))
  if (!hasInvestigatorRole) {
    return {
      ok: false,
      error:
        'Investigator review requires the pi_sub_i, admin, or owner site role. Contact your site administrator.',
    }
  }

  const supabase = await createServerClient()

  const hasUnblindedProcedures = await visitHasUnblindedProcedures(supabase, visitId, organizationId)
  if (hasUnblindedProcedures && !canViewUnblindedData(memberships, organizationId)) {
    return { ok: false, error: 'This visit includes unblinded source material and requires unblinded access to sign.' }
  }

  const runtimeValidation = await validateVisitProcedures({ supabase, visitId, organizationId })
  if (!runtimeValidation.ok) {
    return { ok: false, error: runtimeValidation.error }
  }

  const { data: visit } = await supabase
    .from('visits')
    .select('visit_review_status')
    .eq('id', visitId)
    .maybeSingle()

  if (
    visit?.visit_review_status !== 'coordinator_signed'
    && visit?.visit_review_status !== 'investigator_signed'
  ) {
    return { ok: false, error: 'Coordinator must sign the progress note first.' }
  }

  const { data: note } = await supabase
    .from('visit_progress_notes')
    .select('note_text, coordinator_signature_status, updated_at')
    .eq('visit_id', visitId)
    .maybeSingle()

  if (expectedUpdatedAt && note?.updated_at !== expectedUpdatedAt) {
    return { ok: false, error: 'This visit or source was updated elsewhere. Please refresh before signing.' }
  }

  const guards = await loadVisitCloseoutGuards(
    visitId,
    organizationId,
    note?.note_text,
    note?.coordinator_signature_status === 'signed',
  )
  if (guards.investigatorSignBlocked) {
    return { ok: false, error: guards.investigatorBlockReasons.join(' ') }
  }

  const req = await requestOperationalSignature({
    organizationId,
    studyId: access.studyId,
    subjectId: access.subjectId,
    visitId,
    artifactType: 'visit_closeout',
    artifactId: visitId,
    requiredRole: investigatorRole,
    signatureMeaning: 'I attest that I have reviewed the visit and all procedures.'
  })

  if (!req.ok || !req.requestId) return { ok: false, error: 'Failed to request signature.' }

  const { error: updErr } = await supabase.from('visit_progress_notes').update({
    investigator_signature_request_id: req.requestId
  }).eq('visit_id', visitId)

  if (updErr) return { ok: false, error: mapRuntimeDbErrorToCoordinatorMessage(updErr, updErr.message) }

  return { ok: true, requestId: req.requestId }
}

export async function completeInvestigatorCloseoutSignatureAction(input: {
  visitId: string
  organizationId: string
  investigatorRole: InvestigatorRole
}): Promise<VisitCloseoutActionResult> {
  const access = await assertVisitWrite(input.visitId, input.organizationId)
  if (!access.ok) return access

  const user = await getSessionUser()
  if (!user) return { ok: false, error: 'Sign in required.' }

  const supabase = await createServerClient()
  
  const { data: note } = await supabase.from('visit_progress_notes').select('investigator_signature_request_id').eq('visit_id', input.visitId).single()
  if (!note?.investigator_signature_request_id) return { ok: false, error: 'No signature request found.' }

  const { data: req } = await supabase.from('operational_signature_requests').select('status').eq('id', note.investigator_signature_request_id).single()
  if (req?.status !== 'signed') return { ok: false, error: 'Signature is not signed yet.' }

  const signedName = await resolveSignerName(user.id)

  const { data: rpcResult, error: rpcError } = await supabase.rpc(
    'sign_visit_investigator_closeout',
    {
      p_organization_id: input.organizationId,
      p_visit_id: input.visitId,
      p_investigator_role: input.investigatorRole,
      p_actor_name: signedName,
    },
  )

  if (rpcError) return { ok: false, error: mapRuntimeDbErrorToCoordinatorMessage(rpcError, rpcError.message) }
  const rpc = rpcResult as { ok?: boolean; error?: string | null } | null
  if (!rpc?.ok) {
    return { ok: false, error: mapRuntimeDbErrorToCoordinatorMessage(rpc?.error, 'Investigator sign-off failed.') }
  }

  const coupling = await applyVisitCompletionCoupling(input.visitId, input.organizationId)

  revalidateVisitPaths(access.studyId, access.subjectId, input.visitId)
  return {
    ok: true,
    visitAutoCompleted: coupling.autoCompleted,
  }
}"""

    content = content.replace(old_inv, new_inv)

    with open(file_path, 'w', encoding='utf-8') as f:
        f.write(content)

    print("Success")

if __name__ == "__main__":
    main()
