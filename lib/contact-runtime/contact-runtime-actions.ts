import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import type { SupabaseClient } from '@supabase/supabase-js'
import { createServerClient } from '@/lib/supabase/server'
import { hasActiveOrganizationMembership } from '@/lib/auth/membership-access'
import { getOrganizationMemberships, getSessionUser } from '@/lib/auth/session'
import {
  canAccessBusinessDevelopmentCRM,
  canAccessCommunications,
  canAccessPatientCRM,
  canManageBusinessDevelopmentCRM,
  canManageCommunications,
  canManagePatientCRM,
} from '@/lib/rbac/permissions'
import {
  formOptionalText,
  formText,
} from '@/lib/crm/forms'
import {
  splitContactName,
} from './contact-runtime'

function hasContactRuntimeAccess(
  memberships: Awaited<ReturnType<typeof getOrganizationMemberships>>,
  organizationId: string,
): boolean {
  return (
    canAccessPatientCRM(memberships, organizationId)
    || canAccessBusinessDevelopmentCRM(memberships, organizationId)
    || canAccessCommunications(memberships, organizationId)
  )
}

function hasContactRuntimeManage(
  memberships: Awaited<ReturnType<typeof getOrganizationMemberships>>,
  organizationId: string,
): boolean {
  return (
    canManagePatientCRM(memberships, organizationId)
    || canManageBusinessDevelopmentCRM(memberships, organizationId)
    || canManageCommunications(memberships, organizationId)
  )
}

async function requireContactRuntimeAccess(organizationId: string) {
  const user = await getSessionUser()
  if (!user) redirect('/login')
  const memberships = await getOrganizationMemberships(user.id)
  if (!hasActiveOrganizationMembership(memberships, organizationId)) redirect('/crm')
  if (!hasContactRuntimeAccess(memberships, organizationId)) redirect('/crm')
  return { user, memberships }
}

async function requireContactRuntimeManage(organizationId: string) {
  const { memberships } = await requireContactRuntimeAccess(organizationId)
  if (!hasContactRuntimeManage(memberships, organizationId)) {
    redirect('/contacts?result=forbidden')
  }
}

async function revalidateContactRuntime(organizationId: string, paths: string[]) {
  revalidatePath('/contacts')
  revalidatePath('/crm')
  for (const path of paths) revalidatePath(path)
}

async function upsertContactPerson(
  supabase: SupabaseClient,
  input: {
    organizationId: string
    sourcePatientLeadId?: string | null
    sourceBdContactId?: string | null
    fullName: string
    email?: string | null
    phone?: string | null
    alternatePhone?: string | null
    language?: string | null
    notes?: string | null
    status?: string | null
    ownerUserId?: string | null
    backupOwnerUserId?: string | null
  },
) {
  const name = splitContactName(input.fullName)
  const payload = {
    organization_id: input.organizationId,
    source_patient_lead_id: input.sourcePatientLeadId ?? null,
    source_bd_contact_id: input.sourceBdContactId ?? null,
    first_name: name.firstName,
    last_name: name.lastName,
    preferred_name: null,
    email: input.email ?? null,
    phone: input.phone ?? null,
    alternate_phone: input.alternatePhone ?? null,
    language: input.language ?? null,
    notes: input.notes ?? null,
    status: input.status ?? 'active',
    owner_user_id: input.ownerUserId ?? null,
    backup_owner_user_id: input.backupOwnerUserId ?? null,
  }

  const result = input.sourcePatientLeadId
    ? await supabase
        .from('contact_people')
        .upsert(payload, { onConflict: 'organization_id,source_patient_lead_id' })
    : input.sourceBdContactId
      ? await supabase
          .from('contact_people')
          .upsert(payload, { onConflict: 'organization_id,source_bd_contact_id' })
      : await supabase
          .from('contact_people')
          .insert(payload)

  if (result.error) throw new Error(result.error.message)
  return result
}

async function upsertContactOrganization(
  supabase: SupabaseClient,
  input: {
    organizationId: string
    sourceBdCompanyId?: string | null
    organizationName: string
    organizationType: string
    website?: string | null
    phone?: string | null
    email?: string | null
    address?: string | null
    notes?: string | null
    status?: string | null
    ownerUserId?: string | null
    backupOwnerUserId?: string | null
  },
) {
  const payload = {
    organization_id: input.organizationId,
    source_bd_company_id: input.sourceBdCompanyId ?? null,
    organization_name: input.organizationName,
    organization_type: input.organizationType,
    website: input.website ?? null,
    phone: input.phone ?? null,
    email: input.email ?? null,
    address: input.address ?? null,
    notes: input.notes ?? null,
    status: input.status ?? 'active',
    owner_user_id: input.ownerUserId ?? null,
    backup_owner_user_id: input.backupOwnerUserId ?? null,
  }

  const result = input.sourceBdCompanyId
    ? await supabase
        .from('contact_organizations')
        .upsert(payload, { onConflict: 'organization_id,source_bd_company_id' })
    : await supabase
        .from('contact_organizations')
        .insert(payload)

  if (result.error) throw new Error(result.error.message)
  return result
}

export async function syncContactPersonFromPatientLead(input: {
  organizationId: string
  patientLeadId: string
  fullName: string
  email?: string | null
  phone?: string | null
  notes?: string | null
  stage?: string | null
  ownerUserId?: string | null
}) {
  const supabase = await createServerClient()
  await upsertContactPerson(supabase, {
    organizationId: input.organizationId,
    sourcePatientLeadId: input.patientLeadId,
    fullName: input.fullName,
    email: input.email,
    phone: input.phone,
    notes: input.notes,
    status: input.stage ?? 'active',
    ownerUserId: input.ownerUserId ?? null,
  })

  const { data: person } = await supabase
    .from('contact_people')
    .select('id')
    .eq('organization_id', input.organizationId)
    .eq('source_patient_lead_id', input.patientLeadId)
    .maybeSingle()

  if (person?.id) {
    await supabase.from('contact_roles').upsert([
      { organization_id: input.organizationId, person_id: person.id, role_type: 'patient', active: true },
      { organization_id: input.organizationId, person_id: person.id, role_type: 'candidate', active: true },
    ], { onConflict: 'organization_id,person_id,role_type' })
  }
}

export async function syncContactOrganizationFromBDCompany(input: {
  organizationId: string
  companyId: string
  organizationName: string
  organizationType: string
  website?: string | null
  phone?: string | null
  email?: string | null
  notes?: string | null
  status?: string | null
}) {
  const supabase = await createServerClient()
  await upsertContactOrganization(supabase, {
    organizationId: input.organizationId,
    sourceBdCompanyId: input.companyId,
    organizationName: input.organizationName,
    organizationType: input.organizationType,
    website: input.website,
    phone: input.phone,
    email: input.email,
    notes: input.notes,
    status: input.status,
  })
}

export async function syncContactPersonFromBDContact(input: {
  organizationId: string
  contactId: string
  companyId: string
  fullName: string
  roleTitle?: string | null
  email?: string | null
  phone?: string | null
  preferredContactMethod?: string | null
  notes?: string | null
  companyType?: string | null
}) {
  const supabase = await createServerClient()
  await upsertContactPerson(supabase, {
    organizationId: input.organizationId,
    sourceBdContactId: input.contactId,
    fullName: input.fullName,
    email: input.email,
    phone: input.phone,
    notes: input.notes,
    status: input.preferredContactMethod ?? 'active',
  })

  const { data: person } = await supabase
    .from('contact_people')
    .select('id')
    .eq('organization_id', input.organizationId)
    .eq('source_bd_contact_id', input.contactId)
    .maybeSingle()

  const { data: organization } = await supabase
    .from('contact_organizations')
    .select('id')
    .eq('organization_id', input.organizationId)
    .eq('source_bd_company_id', input.companyId)
    .maybeSingle()

  if (person?.id && organization?.id) {
    await supabase.from('contact_relationships').upsert({
      organization_id: input.organizationId,
      person_id: person.id,
      contact_organization_id: organization.id,
      relationship_type: input.roleTitle || `${input.companyType ?? 'company'} contact`,
      title: input.roleTitle ?? null,
      active: true,
    }, { onConflict: 'organization_id,person_id,contact_organization_id,relationship_type,end_date' })

    const roleType =
      input.companyType === 'sponsor' ? 'sponsor_contact'
      : input.companyType === 'cro' ? 'cro_contact'
      : input.companyType === 'lab' ? 'laboratory_contact'
      : input.companyType === 'physician_network' ? 'physician'
      : input.companyType === 'community_partner' ? 'community_partner'
      : 'vendor_contact'

    await supabase.from('contact_roles').upsert({
      organization_id: input.organizationId,
      person_id: person.id,
      role_type: roleType,
      active: true,
    }, { onConflict: 'organization_id,person_id,role_type' })
  }
}

export async function createContactPersonAction(formData: FormData): Promise<void> {
  'use server'

  const organizationId = formText(formData, 'organizationId')
  const fullName = formText(formData, 'fullName')
  if (!organizationId || !fullName) redirect('/contacts?result=missing')

  await requireContactRuntimeManage(organizationId)
  const supabase = await createServerClient()
  const { error } = await supabase.from('contact_people').insert({
    organization_id: organizationId,
    first_name: splitContactName(fullName).firstName,
    last_name: splitContactName(fullName).lastName,
    preferred_name: formOptionalText(formData, 'preferredName'),
    email: formOptionalText(formData, 'email'),
    phone: formOptionalText(formData, 'phone'),
    alternate_phone: formOptionalText(formData, 'alternatePhone'),
    language: formOptionalText(formData, 'language'),
    notes: formOptionalText(formData, 'notes'),
    status: formText(formData, 'status') || 'active',
    owner_user_id: formOptionalText(formData, 'ownerUserId'),
    backup_owner_user_id: formOptionalText(formData, 'backupOwnerUserId'),
  })
  if (error) redirect(`/contacts?result=error&reason=${encodeURIComponent(error.message)}`)

  await revalidateContactRuntime(organizationId, ['/contacts'])
  redirect('/contacts?result=person-created')
}

export async function updateContactPersonAction(formData: FormData): Promise<void> {
  'use server'

  const organizationId = formText(formData, 'organizationId')
  const personId = formText(formData, 'personId')
  const fullName = formText(formData, 'fullName')
  if (!organizationId || !personId || !fullName) redirect('/contacts?result=missing')

  await requireContactRuntimeManage(organizationId)
  const supabase = await createServerClient()
  const { error } = await supabase
    .from('contact_people')
    .update({
      first_name: splitContactName(fullName).firstName,
      last_name: splitContactName(fullName).lastName,
      preferred_name: formOptionalText(formData, 'preferredName'),
      email: formOptionalText(formData, 'email'),
      phone: formOptionalText(formData, 'phone'),
      alternate_phone: formOptionalText(formData, 'alternatePhone'),
      language: formOptionalText(formData, 'language'),
      notes: formOptionalText(formData, 'notes'),
      status: formText(formData, 'status') || 'active',
      owner_user_id: formOptionalText(formData, 'ownerUserId'),
      backup_owner_user_id: formOptionalText(formData, 'backupOwnerUserId'),
    })
    .eq('organization_id', organizationId)
    .eq('id', personId)

  if (error) redirect(`/contacts?person=${encodeURIComponent(personId)}&result=error&reason=${encodeURIComponent(error.message)}`)

  await revalidateContactRuntime(organizationId, [`/contacts?person=${encodeURIComponent(personId)}`])
  redirect(`/contacts?person=${encodeURIComponent(personId)}&result=person-saved`)
}

export async function createContactOrganizationAction(formData: FormData): Promise<void> {
  'use server'

  const organizationId = formText(formData, 'organizationId')
  const name = formText(formData, 'organizationName')
  if (!organizationId || !name) redirect('/contacts?result=missing')

  await requireContactRuntimeManage(organizationId)
  const supabase = await createServerClient()
  const { error } = await supabase.from('contact_organizations').insert({
    organization_id: organizationId,
    organization_name: name,
    organization_type: formText(formData, 'organizationType') || 'other',
    website: formOptionalText(formData, 'website'),
    phone: formOptionalText(formData, 'phone'),
    email: formOptionalText(formData, 'email'),
    address: formOptionalText(formData, 'address'),
    notes: formOptionalText(formData, 'notes'),
    status: formText(formData, 'status') || 'active',
    owner_user_id: formOptionalText(formData, 'ownerUserId'),
    backup_owner_user_id: formOptionalText(formData, 'backupOwnerUserId'),
  })
  if (error) redirect(`/contacts?result=error&reason=${encodeURIComponent(error.message)}`)

  await revalidateContactRuntime(organizationId, ['/contacts'])
  redirect('/contacts?result=organization-created')
}

export async function updateContactOrganizationAction(formData: FormData): Promise<void> {
  'use server'

  const organizationId = formText(formData, 'organizationId')
  const contactOrganizationId = formText(formData, 'contactOrganizationId')
  const name = formText(formData, 'organizationName')
  if (!organizationId || !contactOrganizationId || !name) redirect('/contacts?result=missing')

  await requireContactRuntimeManage(organizationId)
  const supabase = await createServerClient()
  const { error } = await supabase
    .from('contact_organizations')
    .update({
      organization_name: name,
      organization_type: formText(formData, 'organizationType') || 'other',
      website: formOptionalText(formData, 'website'),
      phone: formOptionalText(formData, 'phone'),
      email: formOptionalText(formData, 'email'),
      address: formOptionalText(formData, 'address'),
      notes: formOptionalText(formData, 'notes'),
      status: formText(formData, 'status') || 'active',
      owner_user_id: formOptionalText(formData, 'ownerUserId'),
      backup_owner_user_id: formOptionalText(formData, 'backupOwnerUserId'),
    })
    .eq('organization_id', organizationId)
    .eq('id', contactOrganizationId)

  if (error) redirect(`/contacts?organization=${encodeURIComponent(contactOrganizationId)}&result=error&reason=${encodeURIComponent(error.message)}`)

  await revalidateContactRuntime(organizationId, [`/contacts?organization=${encodeURIComponent(contactOrganizationId)}`])
  redirect(`/contacts?organization=${encodeURIComponent(contactOrganizationId)}&result=organization-saved`)
}

export async function createContactRelationshipAction(formData: FormData): Promise<void> {
  'use server'

  const organizationId = formText(formData, 'organizationId')
  const personId = formText(formData, 'personId')
  const contactOrganizationId = formText(formData, 'contactOrganizationId')
  if (!organizationId || !personId || !contactOrganizationId) redirect('/contacts?result=missing')

  await requireContactRuntimeManage(organizationId)
  const supabase = await createServerClient()
  const { error } = await supabase.from('contact_relationships').insert({
    organization_id: organizationId,
    person_id: personId,
    contact_organization_id: contactOrganizationId,
    relationship_type: formText(formData, 'relationshipType') || 'related',
    title: formOptionalText(formData, 'title'),
    start_date: formOptionalText(formData, 'startDate'),
    end_date: formOptionalText(formData, 'endDate'),
    active: formText(formData, 'active') !== 'off',
  })
  if (error) redirect(`/contacts?person=${encodeURIComponent(personId)}&result=error&reason=${encodeURIComponent(error.message)}`)

  await revalidateContactRuntime(organizationId, [`/contacts?person=${encodeURIComponent(personId)}`])
  redirect(`/contacts?person=${encodeURIComponent(personId)}&result=relationship-added`)
}

export async function createContactRoleAction(formData: FormData): Promise<void> {
  'use server'

  const organizationId = formText(formData, 'organizationId')
  const personId = formText(formData, 'personId')
  const roleType = formText(formData, 'roleType')
  if (!organizationId || !personId || !roleType) redirect('/contacts?result=missing')

  await requireContactRuntimeManage(organizationId)
  const supabase = await createServerClient()
  const { error } = await supabase.from('contact_roles').upsert({
    organization_id: organizationId,
    person_id: personId,
    role_type: roleType,
    active: formText(formData, 'active') !== 'off',
  }, { onConflict: 'organization_id,person_id,role_type' })
  if (error) redirect(`/contacts?person=${encodeURIComponent(personId)}&result=error&reason=${encodeURIComponent(error.message)}`)

  await revalidateContactRuntime(organizationId, [`/contacts?person=${encodeURIComponent(personId)}`])
  redirect(`/contacts?person=${encodeURIComponent(personId)}&result=role-added`)
}

export async function createReferralRelationshipAction(formData: FormData): Promise<void> {
  'use server'

  const organizationId = formText(formData, 'organizationId')
  const receivingSiteId = formText(formData, 'receivingSiteId')
  if (!organizationId || !receivingSiteId) redirect('/contacts?result=missing')

  await requireContactRuntimeManage(organizationId)
  const supabase = await createServerClient()
  const { error } = await supabase.from('contact_referral_relationships').insert({
    organization_id: organizationId,
    referring_person_id: formOptionalText(formData, 'referringPersonId'),
    referring_organization_id: formOptionalText(formData, 'referringOrganizationId'),
    receiving_site_id: receivingSiteId,
    active: formText(formData, 'active') !== 'off',
    notes: formOptionalText(formData, 'notes'),
    referrals_generated: Number(formOptionalText(formData, 'referralsGenerated') ?? 0),
    enrollments_generated: Number(formOptionalText(formData, 'enrollmentsGenerated') ?? 0),
    randomizations_generated: Number(formOptionalText(formData, 'randomizationsGenerated') ?? 0),
  })
  if (error) redirect(`/contacts?result=error&reason=${encodeURIComponent(error.message)}`)

  await revalidateContactRuntime(organizationId, ['/contacts'])
  redirect('/contacts?result=referral-added')
}
