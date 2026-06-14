import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import type { SupabaseClient } from '@supabase/supabase-js'
import { createServerClient } from '@/lib/supabase/server'
import { hasActiveOrganizationMembership } from '@/lib/auth/membership-access'
import { getOrganizationMemberships, getSessionUser } from '@/lib/auth/session'
import { canAccessPatientCRM, canManagePatientCRM } from '@/lib/rbac/permissions'
import { syncContactPersonFromPatientLead } from '@/lib/contact-runtime/contact-runtime-actions'
import { linkLeadToSubject } from '@/lib/crm/link-lead-to-subject'
import {
  formOptionalDateTime,
  formOptionalNumber,
  formOptionalText,
  formText,
} from './forms'

export type PatientLeadListRow = {
  id: string
  fullName: string
  phone: string | null
  email: string | null
  preferredContactMethod: string
  studyId: string | null
  studyName: string | null
  stage: string
  contactPermission: string
  recruitmentSource: string | null
  consentToContact: boolean
  nextFollowUpAt: string | null
  assignedUserId: string | null
  linkedSubjectId: string | null
  conditionSummary: string | null
  studyInterestSummary: string | null
  notes: string | null
  updatedAt: string
}

export type PatientLeadDetailModel = {
  lead: PatientLeadListRow | null
  contactPermission: {
    id: string
    allowEmail: boolean
    allowPhone: boolean
    allowSms: boolean
    allowWhatsapp: boolean
    allowCalls: boolean
    permissionStatus: string
    permissionSource: string | null
    grantedAt: string | null
    revokedAt: string | null
    notes: string | null
  } | null
  conditions: {
    id: string
    conditionName: string
    conditionType: string | null
    notes: string | null
  }[]
  studyMatches: {
    id: string
    studyId: string
    studyName: string | null
    matchScore: number
    matchStatus: string
    rationale: string | null
  }[]
  followups: {
    id: string
    title: string
    nextStep: string | null
    dueAt: string | null
    status: string
    priority: string
    notes: string | null
    completedAt: string | null
  }[]
  navigationNotes: {
    id: string
    note: string
    noteKind: string
    createdAt: string
  }[]
  unavailable: string[]
}

export type PatientCRMOverview = {
  leadCount: number
  openFollowupCount: number
  scheduledFollowupCount: number
  attributedLeadCount: number
  missingPermissionCount: number
  upcomingFollowups: {
    id: string
    patientLeadId: string
    patientName: string | null
    title: string
    dueAt: string | null
    status: string
    priority: string
  }[]
  recentLeads: PatientLeadListRow[]
  unavailable: string[]
}

export type PatientLeadListResult = {
  rows: PatientLeadListRow[]
  unavailable: string[]
}

function leadSearchFilter(q: string): string {
  const term = q.trim().replace(/,/g, ' ')
  const escaped = term.replace(/%/g, '\\%').replace(/_/g, '\\_')
  return [
    `full_name.ilike.%${escaped}%`,
    `email.ilike.%${escaped}%`,
    `phone.ilike.%${escaped}%`,
    `recruitment_source.ilike.%${escaped}%`,
    `condition_summary.ilike.%${escaped}%`,
    `study_interest_summary.ilike.%${escaped}%`,
    `notes.ilike.%${escaped}%`,
  ].join(',')
}

async function requirePatientCrmAccess(organizationId: string) {
  const user = await getSessionUser()
  if (!user) {
    redirect('/login')
  }

  const memberships = await getOrganizationMemberships(user.id)
  if (!hasActiveOrganizationMembership(memberships, organizationId)) {
    redirect('/crm')
  }

  if (!canAccessPatientCRM(memberships, organizationId)) {
    redirect('/crm')
  }

  return { user, memberships }
}

async function requirePatientCrmManage(organizationId: string) {
  const { memberships } = await requirePatientCrmAccess(organizationId)
  if (!canManagePatientCRM(memberships, organizationId)) {
    redirect('/crm/patients?result=forbidden')
  }
}

export async function loadPatientCRMOverview(
  organizationId: string,
  supabaseClient?: SupabaseClient,
): Promise<PatientCRMOverview> {
  const supabase = supabaseClient ?? (await createServerClient())
  const unavailable: string[] = []

  const [
    leadCountResult,
    openFollowupResult,
    scheduledFollowupResult,
    attributedLeadResult,
    missingPermissionResult,
  ] = await Promise.all([
    supabase
      .from('patient_leads')
      .select('id', { count: 'exact', head: true })
      .eq('organization_id', organizationId)
      .is('archived_at', null),
    supabase
      .from('patient_followups')
      .select('id', { count: 'exact', head: true })
      .eq('organization_id', organizationId)
      .eq('status', 'open'),
    supabase
      .from('patient_followups')
      .select('id', { count: 'exact', head: true })
      .eq('organization_id', organizationId)
      .eq('status', 'open')
      .not('due_at', 'is', null),
    supabase
      .from('patient_leads')
      .select('id', { count: 'exact', head: true })
      .eq('organization_id', organizationId)
      .not('recruitment_source', 'is', null)
      .is('archived_at', null),
    supabase
      .from('patient_leads')
      .select('id', { count: 'exact', head: true })
      .eq('organization_id', organizationId)
      .eq('contact_permission', 'unknown')
      .is('archived_at', null),
  ])

  const [recentLeadsResult, followupsResult] = await Promise.all([
    supabase
      .from('patient_leads')
      .select('id, full_name, phone, email, preferred_contact_method, study_id, stage, contact_permission, recruitment_source, consent_to_contact, next_follow_up_at, assigned_user_id, linked_subject_id, condition_summary, study_interest_summary, notes, updated_at')
      .eq('organization_id', organizationId)
      .is('archived_at', null)
      .order('updated_at', { ascending: false })
      .limit(8),
    supabase
      .from('patient_followups')
      .select('id, patient_lead_id, title, due_at, status, priority, patient_leads(full_name)')
      .eq('organization_id', organizationId)
      .eq('status', 'open')
      .order('due_at', { ascending: true, nullsFirst: false })
      .limit(8),
  ])

  const { data: studies } = await supabase
    .from('studies')
    .select('id, name')
    .eq('organization_id', organizationId)

  const studyNames = new Map((studies ?? []).map((study) => [String(study.id), String(study.name)]))

  const recentLeads = (recentLeadsResult.data ?? []).map((row) => ({
    id: String(row.id),
    fullName: String(row.full_name),
    phone: row.phone ? String(row.phone) : null,
    email: row.email ? String(row.email) : null,
    preferredContactMethod: String(row.preferred_contact_method ?? 'phone'),
    studyId: row.study_id ? String(row.study_id) : null,
    studyName: row.study_id ? studyNames.get(String(row.study_id)) ?? null : null,
    stage: String(row.stage ?? 'lead'),
    contactPermission: String(row.contact_permission ?? 'unknown'),
    recruitmentSource: row.recruitment_source ? String(row.recruitment_source) : null,
    consentToContact: Boolean(row.consent_to_contact),
    nextFollowUpAt: row.next_follow_up_at ? String(row.next_follow_up_at) : null,
    assignedUserId: row.assigned_user_id ? String(row.assigned_user_id) : null,
    linkedSubjectId: row.linked_subject_id ? String(row.linked_subject_id) : null,
    conditionSummary: row.condition_summary ? String(row.condition_summary) : null,
    studyInterestSummary: row.study_interest_summary ? String(row.study_interest_summary) : null,
    notes: row.notes ? String(row.notes) : null,
    updatedAt: String(row.updated_at),
  }))

  const upcomingFollowups = (followupsResult.data ?? []).map((row) => ({
    id: String(row.id),
    patientLeadId: String(row.patient_lead_id),
    patientName: Array.isArray(row.patient_leads)
      ? null
      : row.patient_leads && typeof row.patient_leads === 'object'
        ? String((row.patient_leads as { full_name?: unknown }).full_name ?? '')
        : null,
    title: String(row.title),
    dueAt: row.due_at ? String(row.due_at) : null,
    status: String(row.status ?? 'open'),
    priority: String(row.priority ?? 'normal'),
  }))

  const leadCount = leadCountResult.count ?? 0
  const openFollowupCount = openFollowupResult.count ?? 0
  const scheduledFollowupCount = scheduledFollowupResult.count ?? 0
  const attributedLeadCount = attributedLeadResult.count ?? 0
  const missingPermissionCount = missingPermissionResult.count ?? 0

  const leadError = leadCountResult.error ?? openFollowupResult.error ?? scheduledFollowupResult.error ?? attributedLeadResult.error ?? missingPermissionResult.error
  if (leadError) unavailable.push(leadError.message)

  if (recentLeadsResult.error) unavailable.push(recentLeadsResult.error.message)
  if (followupsResult.error) unavailable.push(followupsResult.error.message)

  return {
    leadCount,
    openFollowupCount,
    scheduledFollowupCount,
    attributedLeadCount,
    missingPermissionCount,
    upcomingFollowups,
    recentLeads,
    unavailable,
  }
}

export async function loadPatientLeadList(
  organizationId: string,
  options?: {
    q?: string | null
    stage?: string | null
    supabaseClient?: SupabaseClient
  },
): Promise<PatientLeadListResult> {
  const supabase = options?.supabaseClient ?? (await createServerClient())
  const unavailable: string[] = []

  let query = supabase
    .from('patient_leads')
      .select('id, full_name, phone, email, preferred_contact_method, study_id, stage, contact_permission, recruitment_source, consent_to_contact, next_follow_up_at, assigned_user_id, linked_subject_id, condition_summary, study_interest_summary, notes, updated_at')
    .eq('organization_id', organizationId)
    .is('archived_at', null)
    .order('updated_at', { ascending: false })
    .limit(50)

  if (options?.stage?.trim()) {
    query = query.eq('stage', options.stage.trim())
  }
  if (options?.q?.trim()) {
    query = query.or(leadSearchFilter(options.q))
  }

  const { data, error } = await query
  if (error) unavailable.push(error.message)

  const { data: studies } = await supabase
    .from('studies')
    .select('id, name')
    .eq('organization_id', organizationId)

  const studyNames = new Map((studies ?? []).map((study) => [String(study.id), String(study.name)]))

  return {
    rows: (data ?? []).map((row) => ({
      id: String(row.id),
      fullName: String(row.full_name),
      phone: row.phone ? String(row.phone) : null,
      email: row.email ? String(row.email) : null,
      preferredContactMethod: String(row.preferred_contact_method ?? 'phone'),
      studyId: row.study_id ? String(row.study_id) : null,
      studyName: row.study_id ? studyNames.get(String(row.study_id)) ?? null : null,
      stage: String(row.stage ?? 'lead'),
      contactPermission: String(row.contact_permission ?? 'unknown'),
      recruitmentSource: row.recruitment_source ? String(row.recruitment_source) : null,
      consentToContact: Boolean(row.consent_to_contact),
      nextFollowUpAt: row.next_follow_up_at ? String(row.next_follow_up_at) : null,
      assignedUserId: row.assigned_user_id ? String(row.assigned_user_id) : null,
      linkedSubjectId: row.linked_subject_id ? String(row.linked_subject_id) : null,
      conditionSummary: row.condition_summary ? String(row.condition_summary) : null,
      studyInterestSummary: row.study_interest_summary ? String(row.study_interest_summary) : null,
      notes: row.notes ? String(row.notes) : null,
      updatedAt: String(row.updated_at),
    })),
    unavailable,
  }
}

export async function loadPatientLeadDetail(
  organizationId: string,
  patientLeadId: string,
  supabaseClient?: SupabaseClient,
): Promise<PatientLeadDetailModel> {
  const supabase = supabaseClient ?? (await createServerClient())
  const unavailable: string[] = []

  const { data: lead, error: leadError } = await supabase
    .from('patient_leads')
    .select('id, full_name, phone, email, preferred_contact_method, study_id, stage, contact_permission, recruitment_source, consent_to_contact, next_follow_up_at, assigned_user_id, linked_subject_id, condition_summary, study_interest_summary, notes, updated_at')
    .eq('organization_id', organizationId)
    .eq('id', patientLeadId)
    .maybeSingle()

  if (leadError) unavailable.push(leadError.message)

  const [permissionResult, conditionsResult, matchesResult, followupsResult, notesResult] =
    await Promise.all([
      supabase
        .from('patient_contact_permissions')
        .select('id, allow_email, allow_phone, allow_sms, allow_whatsapp, allow_calls, permission_status, permission_source, granted_at, revoked_at, notes, created_at')
        .eq('organization_id', organizationId)
        .eq('patient_lead_id', patientLeadId)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle(),
      supabase
        .from('patient_conditions')
        .select('id, condition_name, condition_type, notes')
        .eq('organization_id', organizationId)
        .eq('patient_lead_id', patientLeadId)
        .order('condition_name', { ascending: true }),
      supabase
        .from('patient_study_matches')
        .select('id, study_id, match_score, match_status, rationale')
        .eq('organization_id', organizationId)
        .eq('patient_lead_id', patientLeadId)
        .order('match_score', { ascending: false }),
      supabase
        .from('patient_followups')
        .select('id, title, next_step, due_at, status, priority, notes, completed_at')
        .eq('organization_id', organizationId)
        .eq('patient_lead_id', patientLeadId)
        .order('due_at', { ascending: false, nullsFirst: false })
        .limit(12),
      supabase
        .from('patient_navigation_notes')
        .select('id, note, note_kind, created_at')
        .eq('organization_id', organizationId)
        .eq('patient_lead_id', patientLeadId)
        .order('created_at', { ascending: false })
        .limit(12),
    ])

  if (permissionResult.error) unavailable.push(permissionResult.error.message)
  if (conditionsResult.error) unavailable.push(conditionsResult.error.message)
  if (matchesResult.error) unavailable.push(matchesResult.error.message)
  if (followupsResult.error) unavailable.push(followupsResult.error.message)
  if (notesResult.error) unavailable.push(notesResult.error.message)

  const studyId = lead?.study_id ? String(lead.study_id) : null
  let studyName: string | null = null
  if (studyId) {
    const { data: studyRow } = await supabase
      .from('studies')
      .select('name')
      .eq('organization_id', organizationId)
      .eq('id', studyId)
      .maybeSingle()
    studyName = studyRow?.name ? String(studyRow.name) : null
  }

  const studyMatches = (matchesResult.data ?? []).map((row) => ({
    id: String(row.id),
    studyId: String(row.study_id),
    studyName: null as string | null,
    matchScore: Number(row.match_score ?? 0),
    matchStatus: String(row.match_status ?? 'suggested'),
    rationale: row.rationale ? String(row.rationale) : null,
  }))

  if (studyMatches.length > 0) {
    const { data: studyRows } = await supabase
      .from('studies')
      .select('id, name')
      .in('id', studyMatches.map((row) => row.studyId))
    const studyNameMap = new Map((studyRows ?? []).map((row) => [String(row.id), String(row.name)]))
    for (const match of studyMatches) {
      match.studyName = studyNameMap.get(match.studyId) ?? null
    }
  }

  return {
    lead: lead
      ? {
          id: String(lead.id),
          fullName: String(lead.full_name),
          phone: lead.phone ? String(lead.phone) : null,
          email: lead.email ? String(lead.email) : null,
          preferredContactMethod: String(lead.preferred_contact_method ?? 'phone'),
          studyId,
          studyName,
          stage: String(lead.stage ?? 'lead'),
          contactPermission: String(lead.contact_permission ?? 'unknown'),
          recruitmentSource: lead.recruitment_source ? String(lead.recruitment_source) : null,
          consentToContact: Boolean(lead.consent_to_contact),
          nextFollowUpAt: lead.next_follow_up_at ? String(lead.next_follow_up_at) : null,
          assignedUserId: lead.assigned_user_id ? String(lead.assigned_user_id) : null,
          linkedSubjectId: lead.linked_subject_id ? String(lead.linked_subject_id) : null,
          conditionSummary: lead.condition_summary ? String(lead.condition_summary) : null,
          studyInterestSummary: lead.study_interest_summary ? String(lead.study_interest_summary) : null,
          notes: lead.notes ? String(lead.notes) : null,
          updatedAt: String(lead.updated_at),
        }
      : null,
    contactPermission: permissionResult.data
      ? {
          id: String(permissionResult.data.id),
          allowEmail: Boolean(permissionResult.data.allow_email),
          allowPhone: Boolean(permissionResult.data.allow_phone),
          allowSms: Boolean(permissionResult.data.allow_sms),
          allowWhatsapp: Boolean(permissionResult.data.allow_whatsapp),
          allowCalls: Boolean(permissionResult.data.allow_calls),
          permissionStatus: String(permissionResult.data.permission_status ?? 'unknown'),
          permissionSource: permissionResult.data.permission_source ? String(permissionResult.data.permission_source) : null,
          grantedAt: permissionResult.data.granted_at ? String(permissionResult.data.granted_at) : null,
          revokedAt: permissionResult.data.revoked_at ? String(permissionResult.data.revoked_at) : null,
          notes: permissionResult.data.notes ? String(permissionResult.data.notes) : null,
        }
      : null,
    conditions: (conditionsResult.data ?? []).map((row) => ({
      id: String(row.id),
      conditionName: String(row.condition_name),
      conditionType: row.condition_type ? String(row.condition_type) : null,
      notes: row.notes ? String(row.notes) : null,
    })),
    studyMatches,
    followups: (followupsResult.data ?? []).map((row) => ({
      id: String(row.id),
      title: String(row.title),
      nextStep: row.next_step ? String(row.next_step) : null,
      dueAt: row.due_at ? String(row.due_at) : null,
      status: String(row.status ?? 'open'),
      priority: String(row.priority ?? 'normal'),
      notes: row.notes ? String(row.notes) : null,
      completedAt: row.completed_at ? String(row.completed_at) : null,
    })),
    navigationNotes: (notesResult.data ?? []).map((row) => ({
      id: String(row.id),
      note: String(row.note),
      noteKind: String(row.note_kind ?? 'navigation'),
      createdAt: String(row.created_at),
    })),
    unavailable,
  }
}

async function afterPatientMutation(organizationId: string, path: string[]) {
  revalidatePath('/crm')
  revalidatePath('/crm/patients')
  for (const entry of path) {
    revalidatePath(entry)
  }
}

export async function createPatientLeadAction(formData: FormData): Promise<void> {
  'use server'

  const organizationId = formText(formData, 'organizationId')
  const fullName = formText(formData, 'fullName')
  const studyId = formOptionalText(formData, 'studyId')
  const recruitmentSource = formOptionalText(formData, 'recruitmentSource')
  const phone = formOptionalText(formData, 'phone')
  const email = formOptionalText(formData, 'email')
  const preferredContactMethod = formText(formData, 'preferredContactMethod') || 'phone'
  const contactPermission = formText(formData, 'contactPermission') || 'unknown'
  const conditionSummary = formOptionalText(formData, 'conditionSummary')
  const studyInterestSummary = formOptionalText(formData, 'studyInterestSummary')
  const notes = formOptionalText(formData, 'notes')
  const nextFollowUpAt = formOptionalDateTime(formData, 'nextFollowUpAt')

  if (!organizationId || !fullName) {
    redirect('/crm/patients?result=missing')
  }

  await requirePatientCrmManage(organizationId)
  const supabase = await createServerClient()

  const { data: createdLead, error } = await supabase.from('patient_leads').insert({
    organization_id: organizationId,
    study_id: studyId || null,
    full_name: fullName,
    phone: phone || null,
    email: email || null,
    preferred_contact_method: preferredContactMethod,
    recruitment_source: recruitmentSource || null,
    stage: 'lead',
    contact_permission: contactPermission,
    contact_permission_notes: null,
    consent_to_contact: contactPermission === 'granted',
    condition_summary: conditionSummary || null,
    study_interest_summary: studyInterestSummary || null,
    next_follow_up_at: nextFollowUpAt,
    notes: notes || null,
  }).select('id').single()

  if (error) {
    redirect(`/crm/patients?result=error&reason=${encodeURIComponent(error.message)}`)
  }

  if (createdLead?.id) {
    await syncContactPersonFromPatientLead({
      organizationId,
      patientLeadId: String(createdLead.id),
      fullName,
      email: email || null,
      phone: phone || null,
      notes: notes || null,
      stage: 'lead',
    })
  }

  await afterPatientMutation(organizationId, ['/crm/patients'])
  redirect('/crm/patients?result=created')
}

export async function updatePatientLeadAction(formData: FormData): Promise<void> {
  'use server'

  const organizationId = formText(formData, 'organizationId')
  const leadId = formText(formData, 'leadId')
  const fullName = formText(formData, 'fullName')
  if (!organizationId || !leadId || !fullName) {
    redirect('/crm/patients?result=missing')
  }

  await requirePatientCrmManage(organizationId)
  const supabase = await createServerClient()
  const { error } = await supabase
    .from('patient_leads')
    .update({
      full_name: fullName,
      phone: formOptionalText(formData, 'phone'),
      email: formOptionalText(formData, 'email'),
      preferred_contact_method: formText(formData, 'preferredContactMethod') || 'phone',
      recruitment_source: formOptionalText(formData, 'recruitmentSource'),
      stage: formText(formData, 'stage') || 'lead',
      contact_permission: formText(formData, 'contactPermission') || 'unknown',
      consent_to_contact: formText(formData, 'contactPermission') === 'granted',
      condition_summary: formOptionalText(formData, 'conditionSummary'),
      study_interest_summary: formOptionalText(formData, 'studyInterestSummary'),
      next_follow_up_at: formOptionalDateTime(formData, 'nextFollowUpAt'),
      notes: formOptionalText(formData, 'notes'),
    })
    .eq('id', leadId)
    .eq('organization_id', organizationId)

  if (error) {
    redirect(`/crm/patients?lead=${encodeURIComponent(leadId)}&result=error&reason=${encodeURIComponent(error.message)}`)
  }

  await syncContactPersonFromPatientLead({
    organizationId,
    patientLeadId: leadId,
    fullName,
    email: formOptionalText(formData, 'email'),
    phone: formOptionalText(formData, 'phone'),
    notes: formOptionalText(formData, 'notes'),
    stage: formText(formData, 'stage') || 'lead',
  })

  await afterPatientMutation(organizationId, [`/crm/patients?lead=${encodeURIComponent(leadId)}`])
  redirect(`/crm/patients?lead=${encodeURIComponent(leadId)}&result=saved`)
}

export async function addPatientFollowupAction(formData: FormData): Promise<void> {
  'use server'

  const organizationId = formText(formData, 'organizationId')
  const patientLeadId = formText(formData, 'patientLeadId')
  const title = formText(formData, 'title')
  if (!organizationId || !patientLeadId || !title) {
    redirect('/crm/patients?result=missing')
  }

  await requirePatientCrmManage(organizationId)
  const supabase = await createServerClient()
  const { error } = await supabase.from('patient_followups').insert({
    organization_id: organizationId,
    patient_lead_id: patientLeadId,
    title,
    next_step: formOptionalText(formData, 'nextStep'),
    due_at: formOptionalDateTime(formData, 'dueAt'),
    status: formText(formData, 'status') || 'open',
    priority: formText(formData, 'priority') || 'normal',
    notes: formOptionalText(formData, 'notes'),
  })
  if (error) {
    redirect(`/crm/patients?lead=${encodeURIComponent(patientLeadId)}&result=error&reason=${encodeURIComponent(error.message)}`)
  }
  await afterPatientMutation(organizationId, [`/crm/patients?lead=${encodeURIComponent(patientLeadId)}`])
  redirect(`/crm/patients?lead=${encodeURIComponent(patientLeadId)}&result=followup-added`)
}

export async function addPatientNavigationNoteAction(formData: FormData): Promise<void> {
  'use server'

  const organizationId = formText(formData, 'organizationId')
  const patientLeadId = formText(formData, 'patientLeadId')
  const note = formText(formData, 'note')
  if (!organizationId || !patientLeadId || !note) {
    redirect('/crm/patients?result=missing')
  }

  await requirePatientCrmManage(organizationId)
  const supabase = await createServerClient()
  const { error } = await supabase.from('patient_navigation_notes').insert({
    organization_id: organizationId,
    patient_lead_id: patientLeadId,
    note,
    note_kind: formText(formData, 'noteKind') || 'navigation',
  })
  if (error) {
    redirect(`/crm/patients?lead=${encodeURIComponent(patientLeadId)}&result=error&reason=${encodeURIComponent(error.message)}`)
  }
  await afterPatientMutation(organizationId, [`/crm/patients?lead=${encodeURIComponent(patientLeadId)}`])
  redirect(`/crm/patients?lead=${encodeURIComponent(patientLeadId)}&result=note-added`)
}

export async function addPatientStudyMatchAction(formData: FormData): Promise<void> {
  'use server'

  const organizationId = formText(formData, 'organizationId')
  const patientLeadId = formText(formData, 'patientLeadId')
  const studyId = formText(formData, 'studyId')
  if (!organizationId || !patientLeadId || !studyId) {
    redirect('/crm/patients?result=missing')
  }

  await requirePatientCrmManage(organizationId)
  const supabase = await createServerClient()
  const { error } = await supabase.from('patient_study_matches').insert({
    organization_id: organizationId,
    patient_lead_id: patientLeadId,
    study_id: studyId,
    match_score: formOptionalNumber(formData, 'matchScore') ?? 0,
    match_status: formText(formData, 'matchStatus') || 'suggested',
    rationale: formOptionalText(formData, 'rationale'),
  })
  if (error) {
    redirect(`/crm/patients?lead=${encodeURIComponent(patientLeadId)}&result=error&reason=${encodeURIComponent(error.message)}`)
  }
  await afterPatientMutation(organizationId, [`/crm/patients?lead=${encodeURIComponent(patientLeadId)}`])
  redirect(`/crm/patients?lead=${encodeURIComponent(patientLeadId)}&result=match-added`)
}

export async function linkLeadToSubjectAction(formData: FormData): Promise<void> {
  'use server'

  const organizationId = formText(formData, 'organizationId')
  const patientLeadId = formText(formData, 'patientLeadId')
  const studySubjectId = formText(formData, 'studySubjectId')
  if (!organizationId || !patientLeadId || !studySubjectId) {
    redirect('/crm/patients?result=missing')
  }

  const { user } = await requirePatientCrmAccess(organizationId)
  if (!canManagePatientCRM(
    await getOrganizationMemberships(user.id),
    organizationId,
  )) {
    redirect('/crm/patients?result=forbidden')
  }

  const supabase = await createServerClient()
  const result = await linkLeadToSubject({
    supabase,
    organizationId,
    leadId: patientLeadId,
    studySubjectId,
    actorId: user.id,
  })
  if (!result.ok) {
    redirect(`/crm/patients?lead=${encodeURIComponent(patientLeadId)}&result=error&reason=${encodeURIComponent(result.error)}`)
  }
  await afterPatientMutation(organizationId, [`/crm/patients?lead=${encodeURIComponent(patientLeadId)}`])
  redirect(`/crm/patients?lead=${encodeURIComponent(patientLeadId)}&result=subject-linked`)
}
