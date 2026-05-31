import type { SupabaseClient } from '@supabase/supabase-js'

type ConsentGuardContext = {
  subjectId: string
  studyId?: string | null
  screeningStartedAt?: string | null
}

type ConsentGuardResult = {
  ok: boolean
  reason?: string
  consentAt?: string | null
}

export async function hasValidConsentBeforeScreening(
  supabase: SupabaseClient,
  input: ConsentGuardContext,
): Promise<ConsentGuardResult> {
  const [legacy, runtime] = await Promise.all([
    loadLegacyConsent(supabase, input.subjectId),
    loadActiveMainConsent(supabase, input.subjectId),
  ])
  const consentAt = runtime?.active_at ?? runtime?.completed_at ?? legacy.consentSignedAt
  if (!consentAt) return { ok: false, reason: 'No active runtime or legacy consent timestamp.' }
  if (!input.screeningStartedAt) return { ok: true, consentAt }
  if (new Date(consentAt).getTime() <= new Date(input.screeningStartedAt).getTime()) {
    return { ok: true, consentAt }
  }
  return { ok: false, reason: 'Consent occurred after screening started.', consentAt }
}

export async function canScreenSubject(
  supabase: SupabaseClient,
  input: ConsentGuardContext,
): Promise<ConsentGuardResult> {
  if (await hasWithdrawnConsent(supabase, input.subjectId, 'all_study')) {
    return { ok: false, reason: 'Subject has withdrawn study consent.' }
  }
  const reconsent = await hasBlockingReconsentRequirement(supabase, input.subjectId)
  if (reconsent) return { ok: false, reason: reconsent }
  return hasValidConsentBeforeScreening(supabase, input)
}

export async function canEnrollSubject(
  supabase: SupabaseClient,
  input: ConsentGuardContext,
): Promise<ConsentGuardResult> {
  const consent = await hasValidConsentBeforeScreening(supabase, input)
  if (!consent.ok) return consent
  if (await hasWithdrawnConsent(supabase, input.subjectId, 'all_study')) {
    return { ok: false, reason: 'Subject has withdrawn study consent.' }
  }
  const reconsent = await hasBlockingReconsentRequirement(supabase, input.subjectId)
  if (reconsent) return { ok: false, reason: reconsent }
  return consent
}

export async function canExecuteVisit(
  supabase: SupabaseClient,
  input: ConsentGuardContext,
): Promise<ConsentGuardResult> {
  if (await hasWithdrawnConsent(supabase, input.subjectId, 'all_study')) {
    return { ok: false, reason: 'Subject has withdrawn all study consent.' }
  }
  if (await hasWithdrawnConsent(supabase, input.subjectId, 'study_treatment')) {
    return { ok: false, reason: 'Subject has withdrawn study treatment consent.' }
  }
  const reconsent = await hasBlockingReconsentRequirement(supabase, input.subjectId)
  if (reconsent) return { ok: false, reason: reconsent }
  const active = await loadActiveMainConsent(supabase, input.subjectId)
  return active ? { ok: true, consentAt: active.active_at ?? active.completed_at } : { ok: false, reason: 'No active consent.' }
}

export async function canExecuteProcedure(
  supabase: SupabaseClient,
  input: ConsentGuardContext & { procedureRequiresHipaa?: boolean },
): Promise<ConsentGuardResult> {
  const visit = await canExecuteVisit(supabase, input)
  if (!visit.ok) return visit
  if (input.procedureRequiresHipaa && !await hasActiveHIPAAAuthorization(supabase, input.subjectId)) {
    return { ok: false, reason: 'Active HIPAA authorization is required.' }
  }
  return visit
}

export async function canCollectOptionalSpecimen(
  supabase: SupabaseClient,
  subjectId: string,
): Promise<ConsentGuardResult> {
  return hasPermission(supabase, subjectId, 'optional_specimen')
}

export async function canUseFutureSamples(
  supabase: SupabaseClient,
  subjectId: string,
): Promise<ConsentGuardResult> {
  return hasPermission(supabase, subjectId, 'future_use_samples')
}

export async function hasActiveHIPAAAuthorization(
  supabase: SupabaseClient,
  subjectId: string,
): Promise<boolean> {
  if (await hasWithdrawnConsent(supabase, subjectId, 'all_study')) return false
  if (await hasWithdrawnConsent(supabase, subjectId, 'hipaa')) return false
  const { data } = await supabase
    .from('subject_consent_versions')
    .select('id')
    .eq('study_subject_id', subjectId)
    .eq('consent_type', 'hipaa_authorization')
    .eq('status', 'active')
    .maybeSingle()
  return Boolean(data)
}

export async function hasWithdrawnConsent(
  supabase: SupabaseClient,
  subjectId: string,
  scope?: string,
): Promise<boolean> {
  let query = supabase
    .from('subject_consent_withdrawals')
    .select('id')
    .eq('study_subject_id', subjectId)
    .limit(1)
  if (scope) query = query.eq('withdrawal_scope', scope)
  const { data } = await query
  return Boolean(data?.length)
}

async function hasPermission(
  supabase: SupabaseClient,
  subjectId: string,
  permissionType: string,
): Promise<ConsentGuardResult> {
  if (await hasWithdrawnConsent(supabase, subjectId, 'all_study')) {
    return { ok: false, reason: 'Subject has withdrawn study consent.' }
  }
  const withdrawalScope = withdrawalScopeForPermission(permissionType)
  if (await hasWithdrawnConsent(supabase, subjectId, withdrawalScope)) {
    return { ok: false, reason: 'Permission has been withdrawn.' }
  }
  const { data } = await supabase
    .from('subject_consent_optional_permissions')
    .select('effective_at')
    .eq('study_subject_id', subjectId)
    .eq('permission_type', permissionType)
    .eq('permission_status', 'granted')
    .maybeSingle()
  return data
    ? { ok: true, consentAt: String(data.effective_at ?? '') }
    : { ok: false, reason: `Optional permission ${permissionType} is not granted.` }
}

function withdrawalScopeForPermission(permissionType: string) {
  if (permissionType === 'optional_specimen') return 'optional_samples'
  if (permissionType === 'future_use_samples') return 'future_use'
  if (permissionType === 'genetic_testing') return 'genetic'
  if (permissionType === 'contact_for_future_research') return 'future_use'
  return permissionType
}

async function hasBlockingReconsentRequirement(
  supabase: SupabaseClient,
  subjectId: string,
): Promise<string | null> {
  const { data } = await supabase
    .from('subject_consent_reconsent_requirements')
    .select('reconsent_status, reason')
    .eq('study_subject_id', subjectId)
    .eq('consent_action_required', true)
    .in('reconsent_status', ['pending', 'overdue'])
    .limit(1)
  const row = data?.[0]
  return row ? String(row.reason ?? 'Subject requires reconsent before continuing.') : null
}

async function loadLegacyConsent(supabase: SupabaseClient, subjectId: string) {
  const { data } = await supabase
    .from('study_subjects')
    .select('consent_signed_at')
    .eq('id', subjectId)
    .maybeSingle()
  return { consentSignedAt: data?.consent_signed_at ? String(data.consent_signed_at) : null }
}

async function loadActiveMainConsent(supabase: SupabaseClient, subjectId: string) {
  const { data } = await supabase
    .from('subject_consent_versions')
    .select('id, active_at, completed_at')
    .eq('study_subject_id', subjectId)
    .in('consent_type', ['initial_consent', 're_consent', 'amendment_consent'])
    .eq('status', 'active')
    .order('active_at', { ascending: false })
    .limit(1)
    .maybeSingle()
  return data as { id: string; active_at: string | null; completed_at: string | null } | null
}
