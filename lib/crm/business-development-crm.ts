import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import type { SupabaseClient } from '@supabase/supabase-js'
import { createServerClient } from '@/lib/supabase/server'
import { hasActiveOrganizationMembership } from '@/lib/auth/membership-access'
import { getOrganizationMemberships, getSessionUser } from '@/lib/auth/session'
import { canAccessBusinessDevelopmentCRM, canManageBusinessDevelopmentCRM } from '@/lib/rbac/permissions'
import {
  syncContactOrganizationFromBDCompany,
  syncContactPersonFromBDContact,
} from '@/lib/contact-runtime/contact-runtime-actions'
import {
  formOptionalDateTime,
  formOptionalNumber,
  formOptionalText,
  formText,
} from './forms'

export type BDCompanyListRow = {
  id: string
  name: string
  companyType: string
  status: string
  website: string | null
  primaryContactName: string | null
  primaryContactEmail: string | null
  primaryContactPhone: string | null
  notes: string | null
  updatedAt: string
}

export type BDCompanyDetailModel = {
  company: BDCompanyListRow | null
  contacts: {
    id: string
    fullName: string
    roleTitle: string | null
    email: string | null
    phone: string | null
    preferredContactMethod: string
    isPrimary: boolean
    notes: string | null
  }[]
  opportunities: {
    id: string
    title: string
    stage: string
    expectedValue: number | null
    currency: string
    budgetStatus: string | null
    ctaStatus: string | null
    nextFollowUpAt: string | null
    notes: string | null
  }[]
  interactions: {
    id: string
    channel: string
    direction: string
    subject: string | null
    summary: string | null
    happenedAt: string
  }[]
  tasks: {
    id: string
    title: string
    nextStep: string | null
    dueAt: string | null
    status: string
    priority: string
    notes: string | null
  }[]
  unavailable: string[]
}

export type BDOverview = {
  companyCount: number
  opportunityCount: number
  activeOpportunityCount: number
  openTaskCount: number
  recentCompanies: BDCompanyListRow[]
  recentTasks: {
    id: string
    title: string
    dueAt: string | null
    status: string
    priority: string
    companyName: string | null
  }[]
  unavailable: string[]
}

export type BDCompanyListResult = {
  rows: BDCompanyListRow[]
  unavailable: string[]
}

function companySearchFilter(q: string): string {
  const term = q.trim().replace(/,/g, ' ')
  const escaped = term.replace(/%/g, '\\%').replace(/_/g, '\\_')
  return [
    `name.ilike.%${escaped}%`,
    `website.ilike.%${escaped}%`,
    `primary_contact_name.ilike.%${escaped}%`,
    `primary_contact_email.ilike.%${escaped}%`,
    `primary_contact_phone.ilike.%${escaped}%`,
    `notes.ilike.%${escaped}%`,
  ].join(',')
}

async function requireBDAccess(organizationId: string) {
  const user = await getSessionUser()
  if (!user) redirect('/login')
  const memberships = await getOrganizationMemberships(user.id)
  if (!hasActiveOrganizationMembership(memberships, organizationId)) redirect('/crm')
  if (!canAccessBusinessDevelopmentCRM(memberships, organizationId)) redirect('/crm')
  return { user, memberships }
}

async function requireBDManage(organizationId: string) {
  const { memberships } = await requireBDAccess(organizationId)
  if (!canManageBusinessDevelopmentCRM(memberships, organizationId)) {
    redirect('/crm/business-development?result=forbidden')
  }
}

export async function loadBDOverview(
  organizationId: string,
  supabaseClient?: SupabaseClient,
): Promise<BDOverview> {
  const supabase = supabaseClient ?? (await createServerClient())
  const unavailable: string[] = []

  const [
    companyCountResult,
    opportunityCountResult,
    activeOpportunityCountResult,
    openTaskCountResult,
  ] = await Promise.all([
    supabase
      .from('bd_companies')
      .select('id', { count: 'exact', head: true })
      .eq('organization_id', organizationId)
      .is('archived_at', null),
    supabase
      .from('bd_opportunities')
      .select('id', { count: 'exact', head: true })
      .eq('organization_id', organizationId)
      .is('archived_at', null),
    supabase
      .from('bd_opportunities')
      .select('id', { count: 'exact', head: true })
      .eq('organization_id', organizationId)
      .is('archived_at', null)
      .in('stage', ['feasibility_sent', 'selected', 'contracting', 'active']),
    supabase
      .from('bd_tasks')
      .select('id', { count: 'exact', head: true })
      .eq('organization_id', organizationId)
      .eq('status', 'open'),
  ])

  const [recentCompaniesResult, recentTasksResult] = await Promise.all([
    supabase
      .from('bd_companies')
      .select('id, name, company_type, status, website, primary_contact_name, primary_contact_email, primary_contact_phone, notes, updated_at')
      .eq('organization_id', organizationId)
      .is('archived_at', null)
      .order('updated_at', { ascending: false })
      .limit(8),
    supabase
      .from('bd_tasks')
      .select('id, title, due_at, status, priority, bd_companies(name)')
      .eq('organization_id', organizationId)
      .eq('status', 'open')
      .order('due_at', { ascending: true, nullsFirst: false })
      .limit(8),
  ])

  if (companyCountResult.error) unavailable.push(companyCountResult.error.message)
  if (opportunityCountResult.error) unavailable.push(opportunityCountResult.error.message)
  if (activeOpportunityCountResult.error) unavailable.push(activeOpportunityCountResult.error.message)
  if (openTaskCountResult.error) unavailable.push(openTaskCountResult.error.message)
  if (recentCompaniesResult.error) unavailable.push(recentCompaniesResult.error.message)
  if (recentTasksResult.error) unavailable.push(recentTasksResult.error.message)

  return {
    companyCount: companyCountResult.count ?? 0,
    opportunityCount: opportunityCountResult.count ?? 0,
    activeOpportunityCount: activeOpportunityCountResult.count ?? 0,
    openTaskCount: openTaskCountResult.count ?? 0,
    recentCompanies: (recentCompaniesResult.data ?? []).map((row) => ({
      id: String(row.id),
      name: String(row.name),
      companyType: String(row.company_type ?? 'other'),
      status: String(row.status ?? 'active'),
      website: row.website ? String(row.website) : null,
      primaryContactName: row.primary_contact_name ? String(row.primary_contact_name) : null,
      primaryContactEmail: row.primary_contact_email ? String(row.primary_contact_email) : null,
      primaryContactPhone: row.primary_contact_phone ? String(row.primary_contact_phone) : null,
      notes: row.notes ? String(row.notes) : null,
      updatedAt: String(row.updated_at),
    })),
    recentTasks: (recentTasksResult.data ?? []).map((row) => ({
      id: String(row.id),
      title: String(row.title),
      dueAt: row.due_at ? String(row.due_at) : null,
      status: String(row.status ?? 'open'),
      priority: String(row.priority ?? 'normal'),
      companyName: Array.isArray(row.bd_companies)
        ? null
        : row.bd_companies && typeof row.bd_companies === 'object'
          ? String((row.bd_companies as { name?: unknown }).name ?? '')
          : null,
    })),
    unavailable,
  }
}

export async function loadBDCompanyList(
  organizationId: string,
  options?: {
    q?: string | null
    type?: string | null
    stage?: string | null
    supabaseClient?: SupabaseClient
  },
): Promise<BDCompanyListResult> {
  const supabase = options?.supabaseClient ?? (await createServerClient())
  const unavailable: string[] = []

  let query = supabase
    .from('bd_companies')
    .select('id, name, company_type, status, website, primary_contact_name, primary_contact_email, primary_contact_phone, notes, updated_at')
    .eq('organization_id', organizationId)
    .is('archived_at', null)
    .order('updated_at', { ascending: false })
    .limit(50)

  if (options?.type?.trim()) query = query.eq('company_type', options.type.trim())
  if (options?.stage?.trim()) {
    const stageValue = options.stage.trim()
    query = query
      .or(`status.eq.${stageValue},notes.ilike.%${stageValue}%`)
  }
  if (options?.q?.trim()) query = query.or(companySearchFilter(options.q))

  const { data, error } = await query
  if (error) unavailable.push(error.message)

  return {
    rows: (data ?? []).map((row) => ({
      id: String(row.id),
      name: String(row.name),
      companyType: String(row.company_type ?? 'other'),
      status: String(row.status ?? 'active'),
      website: row.website ? String(row.website) : null,
      primaryContactName: row.primary_contact_name ? String(row.primary_contact_name) : null,
      primaryContactEmail: row.primary_contact_email ? String(row.primary_contact_email) : null,
      primaryContactPhone: row.primary_contact_phone ? String(row.primary_contact_phone) : null,
      notes: row.notes ? String(row.notes) : null,
      updatedAt: String(row.updated_at),
    })),
    unavailable,
  }
}

export async function loadBDCompanyDetail(
  organizationId: string,
  companyId: string,
  supabaseClient?: SupabaseClient,
): Promise<BDCompanyDetailModel> {
  const supabase = supabaseClient ?? (await createServerClient())
  const unavailable: string[] = []

  const { data: company, error: companyError } = await supabase
    .from('bd_companies')
    .select('id, name, company_type, status, website, primary_contact_name, primary_contact_email, primary_contact_phone, notes, updated_at')
    .eq('organization_id', organizationId)
    .eq('id', companyId)
    .maybeSingle()
  if (companyError) unavailable.push(companyError.message)

  const [contactsResult, opportunitiesResult, interactionsResult, tasksResult] = await Promise.all([
    supabase
      .from('bd_contacts')
      .select('id, full_name, role_title, email, phone, preferred_contact_method, is_primary, notes')
      .eq('organization_id', organizationId)
      .eq('company_id', companyId)
      .order('is_primary', { ascending: false })
      .order('created_at', { ascending: false }),
    supabase
      .from('bd_opportunities')
      .select('id, title, stage, expected_value, currency, budget_status, cta_status, next_follow_up_at, notes')
      .eq('organization_id', organizationId)
      .eq('company_id', companyId)
      .is('archived_at', null)
      .order('next_follow_up_at', { ascending: true, nullsFirst: false }),
    supabase
      .from('bd_interactions')
      .select('id, channel, direction, subject, summary, happened_at')
      .eq('organization_id', organizationId)
      .eq('company_id', companyId)
      .order('happened_at', { ascending: false })
      .limit(12),
    supabase
      .from('bd_tasks')
      .select('id, title, next_step, due_at, status, priority, notes')
      .eq('organization_id', organizationId)
      .eq('company_id', companyId)
      .order('due_at', { ascending: true, nullsFirst: false })
      .limit(12),
  ])

  if (contactsResult.error) unavailable.push(contactsResult.error.message)
  if (opportunitiesResult.error) unavailable.push(opportunitiesResult.error.message)
  if (interactionsResult.error) unavailable.push(interactionsResult.error.message)
  if (tasksResult.error) unavailable.push(tasksResult.error.message)

  return {
    company: company
      ? {
          id: String(company.id),
          name: String(company.name),
          companyType: String(company.company_type ?? 'other'),
          status: String(company.status ?? 'active'),
          website: company.website ? String(company.website) : null,
          primaryContactName: company.primary_contact_name ? String(company.primary_contact_name) : null,
          primaryContactEmail: company.primary_contact_email ? String(company.primary_contact_email) : null,
          primaryContactPhone: company.primary_contact_phone ? String(company.primary_contact_phone) : null,
          notes: company.notes ? String(company.notes) : null,
          updatedAt: String(company.updated_at),
        }
      : null,
    contacts: (contactsResult.data ?? []).map((row) => ({
      id: String(row.id),
      fullName: String(row.full_name),
      roleTitle: row.role_title ? String(row.role_title) : null,
      email: row.email ? String(row.email) : null,
      phone: row.phone ? String(row.phone) : null,
      preferredContactMethod: String(row.preferred_contact_method ?? 'email'),
      isPrimary: Boolean(row.is_primary),
      notes: row.notes ? String(row.notes) : null,
    })),
    opportunities: (opportunitiesResult.data ?? []).map((row) => ({
      id: String(row.id),
      title: String(row.title),
      stage: String(row.stage ?? 'lead'),
      expectedValue: row.expected_value != null ? Number(row.expected_value) : null,
      currency: String(row.currency ?? 'USD'),
      budgetStatus: row.budget_status ? String(row.budget_status) : null,
      ctaStatus: row.cta_status ? String(row.cta_status) : null,
      nextFollowUpAt: row.next_follow_up_at ? String(row.next_follow_up_at) : null,
      notes: row.notes ? String(row.notes) : null,
    })),
    interactions: (interactionsResult.data ?? []).map((row) => ({
      id: String(row.id),
      channel: String(row.channel ?? 'note'),
      direction: String(row.direction ?? 'internal'),
      subject: row.subject ? String(row.subject) : null,
      summary: row.summary ? String(row.summary) : null,
      happenedAt: String(row.happened_at),
    })),
    tasks: (tasksResult.data ?? []).map((row) => ({
      id: String(row.id),
      title: String(row.title),
      nextStep: row.next_step ? String(row.next_step) : null,
      dueAt: row.due_at ? String(row.due_at) : null,
      status: String(row.status ?? 'open'),
      priority: String(row.priority ?? 'normal'),
      notes: row.notes ? String(row.notes) : null,
    })),
    unavailable,
  }
}

async function afterBDMutation(organizationId: string, paths: string[]) {
  revalidatePath('/crm')
  revalidatePath('/crm/business-development')
  for (const path of paths) revalidatePath(path)
}

export async function createBDCompanyAction(formData: FormData): Promise<void> {
  'use server'
  const organizationId = formText(formData, 'organizationId')
  const name = formText(formData, 'name')
  if (!organizationId || !name) redirect('/crm/business-development?result=missing')

  await requireBDManage(organizationId)
  const supabase = await createServerClient()
  const { data: createdCompany, error } = await supabase.from('bd_companies').insert({
    organization_id: organizationId,
    company_type: formText(formData, 'companyType') || 'other',
    name,
    website: formOptionalText(formData, 'website'),
    primary_contact_name: formOptionalText(formData, 'primaryContactName'),
    primary_contact_email: formOptionalText(formData, 'primaryContactEmail'),
    primary_contact_phone: formOptionalText(formData, 'primaryContactPhone'),
    status: formText(formData, 'status') || 'active',
    notes: formOptionalText(formData, 'notes'),
  }).select('id').single()
  if (error) {
    redirect(`/crm/business-development?result=error&reason=${encodeURIComponent(error.message)}`)
  }

  if (createdCompany?.id) {
    await syncContactOrganizationFromBDCompany({
      organizationId,
      companyId: String(createdCompany.id),
      organizationName: name,
      organizationType: formText(formData, 'companyType') || 'other',
      website: formOptionalText(formData, 'website'),
      phone: formOptionalText(formData, 'primaryContactPhone'),
      email: formOptionalText(formData, 'primaryContactEmail'),
      notes: formOptionalText(formData, 'notes'),
      status: formText(formData, 'status') || 'active',
    })
  }
  await afterBDMutation(organizationId, ['/crm/business-development'])
  redirect('/crm/business-development?result=created')
}

export async function updateBDCompanyAction(formData: FormData): Promise<void> {
  'use server'
  const organizationId = formText(formData, 'organizationId')
  const companyId = formText(formData, 'companyId')
  const name = formText(formData, 'name')
  if (!organizationId || !companyId || !name) redirect('/crm/business-development?result=missing')

  await requireBDManage(organizationId)
  const supabase = await createServerClient()
  const { error } = await supabase
    .from('bd_companies')
    .update({
      company_type: formText(formData, 'companyType') || 'other',
      name,
      website: formOptionalText(formData, 'website'),
      primary_contact_name: formOptionalText(formData, 'primaryContactName'),
      primary_contact_email: formOptionalText(formData, 'primaryContactEmail'),
      primary_contact_phone: formOptionalText(formData, 'primaryContactPhone'),
      status: formText(formData, 'status') || 'active',
      notes: formOptionalText(formData, 'notes'),
    })
    .eq('organization_id', organizationId)
    .eq('id', companyId)

  if (error) {
    redirect(`/crm/business-development?company=${encodeURIComponent(companyId)}&result=error&reason=${encodeURIComponent(error.message)}`)
  }

  await syncContactOrganizationFromBDCompany({
    organizationId,
    companyId,
    organizationName: name,
    organizationType: formText(formData, 'companyType') || 'other',
    website: formOptionalText(formData, 'website'),
    phone: formOptionalText(formData, 'primaryContactPhone'),
    email: formOptionalText(formData, 'primaryContactEmail'),
    notes: formOptionalText(formData, 'notes'),
    status: formText(formData, 'status') || 'active',
  })
  await afterBDMutation(organizationId, [`/crm/business-development?company=${encodeURIComponent(companyId)}`])
  redirect(`/crm/business-development?company=${encodeURIComponent(companyId)}&result=saved`)
}

export async function createBDOpportunityAction(formData: FormData): Promise<void> {
  'use server'
  const organizationId = formText(formData, 'organizationId')
  const companyId = formText(formData, 'companyId')
  const title = formText(formData, 'title')
  if (!organizationId || !companyId || !title) redirect('/crm/business-development?result=missing')

  await requireBDManage(organizationId)
  const supabase = await createServerClient()
  const { error } = await supabase.from('bd_opportunities').insert({
    organization_id: organizationId,
    company_id: companyId,
    study_id: formOptionalText(formData, 'studyId'),
    title,
    stage: formText(formData, 'stage') || 'lead',
    expected_value: formOptionalNumber(formData, 'expectedValue'),
    currency: formText(formData, 'currency') || 'USD',
    budget_status: formOptionalText(formData, 'budgetStatus'),
    cta_status: formOptionalText(formData, 'ctaStatus'),
    next_follow_up_at: formOptionalDateTime(formData, 'nextFollowUpAt'),
    notes: formOptionalText(formData, 'notes'),
  })
  if (error) {
    redirect(`/crm/business-development?company=${encodeURIComponent(companyId)}&result=error&reason=${encodeURIComponent(error.message)}`)
  }
  await afterBDMutation(organizationId, [`/crm/business-development?company=${encodeURIComponent(companyId)}`])
  redirect(`/crm/business-development?company=${encodeURIComponent(companyId)}&result=opportunity-added`)
}

export async function createBDTaskAction(formData: FormData): Promise<void> {
  'use server'
  const organizationId = formText(formData, 'organizationId')
  const companyId = formText(formData, 'companyId')
  const title = formText(formData, 'title')
  if (!organizationId || !companyId || !title) redirect('/crm/business-development?result=missing')

  await requireBDManage(organizationId)
  const supabase = await createServerClient()
  const { error } = await supabase.from('bd_tasks').insert({
    organization_id: organizationId,
    company_id: companyId,
    contact_id: formOptionalText(formData, 'contactId'),
    opportunity_id: formOptionalText(formData, 'opportunityId'),
    title,
    next_step: formOptionalText(formData, 'nextStep'),
    due_at: formOptionalDateTime(formData, 'dueAt'),
    status: formText(formData, 'status') || 'open',
    priority: formText(formData, 'priority') || 'normal',
    notes: formOptionalText(formData, 'notes'),
  })
  if (error) {
    redirect(`/crm/business-development?company=${encodeURIComponent(companyId)}&result=error&reason=${encodeURIComponent(error.message)}`)
  }
  await afterBDMutation(organizationId, [`/crm/business-development?company=${encodeURIComponent(companyId)}`])
  redirect(`/crm/business-development?company=${encodeURIComponent(companyId)}&result=task-added`)
}

export async function createBDContactAction(formData: FormData): Promise<void> {
  'use server'
  const organizationId = formText(formData, 'organizationId')
  const companyId = formText(formData, 'companyId')
  const fullName = formText(formData, 'fullName')
  if (!organizationId || !companyId || !fullName) redirect('/crm/business-development?result=missing')

  await requireBDManage(organizationId)
  const supabase = await createServerClient()
  const { data: createdContact, error } = await supabase.from('bd_contacts').insert({
    organization_id: organizationId,
    company_id: companyId,
    full_name: fullName,
    role_title: formOptionalText(formData, 'roleTitle'),
    email: formOptionalText(formData, 'email'),
    phone: formOptionalText(formData, 'phone'),
    preferred_contact_method: formText(formData, 'preferredContactMethod') || 'email',
    is_primary: formText(formData, 'isPrimary') === 'on',
    notes: formOptionalText(formData, 'notes'),
  }).select('id').single()
  if (error) {
    redirect(`/crm/business-development?company=${encodeURIComponent(companyId)}&result=error&reason=${encodeURIComponent(error.message)}`)
  }

  const { data: company } = await supabase
    .from('bd_companies')
    .select('name, company_type')
    .eq('organization_id', organizationId)
    .eq('id', companyId)
    .maybeSingle()

  if (createdContact?.id) {
    await syncContactPersonFromBDContact({
      organizationId,
      contactId: String(createdContact.id),
      companyId,
      fullName,
      roleTitle: formOptionalText(formData, 'roleTitle'),
      email: formOptionalText(formData, 'email'),
      phone: formOptionalText(formData, 'phone'),
      preferredContactMethod: formText(formData, 'preferredContactMethod') || 'email',
      notes: formOptionalText(formData, 'notes'),
      companyType: company?.company_type ? String(company.company_type) : null,
    })
  }
  await afterBDMutation(organizationId, [`/crm/business-development?company=${encodeURIComponent(companyId)}`])
  redirect(`/crm/business-development?company=${encodeURIComponent(companyId)}&result=contact-added`)
}

export async function createBDInteractionAction(formData: FormData): Promise<void> {
  'use server'
  const organizationId = formText(formData, 'organizationId')
  const companyId = formText(formData, 'companyId')
  if (!organizationId || !companyId) redirect('/crm/business-development?result=missing')

  await requireBDManage(organizationId)
  const supabase = await createServerClient()
  const { error } = await supabase.from('bd_interactions').insert({
    organization_id: organizationId,
    company_id: companyId,
    contact_id: formOptionalText(formData, 'contactId'),
    opportunity_id: formOptionalText(formData, 'opportunityId'),
    channel: formText(formData, 'channel') || 'note',
    direction: formText(formData, 'direction') || 'internal',
    subject: formOptionalText(formData, 'subject'),
    summary: formOptionalText(formData, 'summary'),
    body: formOptionalText(formData, 'body'),
    happened_at: formOptionalDateTime(formData, 'happenedAt') || undefined,
  })
  if (error) {
    redirect(`/crm/business-development?company=${encodeURIComponent(companyId)}&result=error&reason=${encodeURIComponent(error.message)}`)
  }
  await afterBDMutation(organizationId, [`/crm/business-development?company=${encodeURIComponent(companyId)}`])
  redirect(`/crm/business-development?company=${encodeURIComponent(companyId)}&result=interaction-added`)
}
