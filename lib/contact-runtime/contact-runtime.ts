import type { SupabaseClient } from '@supabase/supabase-js'
import { createServerClient } from '@/lib/supabase/server'

export type ContactPersonRecord = {
  id: string
  organizationId: string
  firstName: string
  lastName: string
  preferredName: string | null
  email: string | null
  phone: string | null
  alternatePhone: string | null
  language: string | null
  notes: string | null
  status: string
  ownerUserId: string | null
  backupOwnerUserId: string | null
  sourcePatientLeadId: string | null
  sourceBdContactId: string | null
  createdAt: string
  updatedAt: string
}

export type ContactOrganizationRecord = {
  id: string
  organizationId: string
  organizationName: string
  organizationType: string
  website: string | null
  phone: string | null
  email: string | null
  address: string | null
  notes: string | null
  status: string
  ownerUserId: string | null
  backupOwnerUserId: string | null
  sourceBdCompanyId: string | null
  createdAt: string
  updatedAt: string
}

export type ContactRoleRecord = {
  id: string
  organizationId: string
  personId: string
  roleType: string
  active: boolean
}

export type ContactRelationshipRecord = {
  id: string
  organizationId: string
  personId: string
  contactOrganizationId: string
  relationshipType: string
  title: string | null
  startDate: string | null
  endDate: string | null
  active: boolean
}

export type ContactReferralRecord = {
  id: string
  organizationId: string
  referringPersonId: string | null
  referringOrganizationId: string | null
  receivingSiteId: string
  active: boolean
  notes: string | null
  referralsGenerated: number
  enrollmentsGenerated: number
  randomizationsGenerated: number
}

export type ContactTaskRecord = {
  id: string
  title: string
  nextStep: string | null
  dueAt: string | null
  status: string
  priority: string
  notes: string | null
  ownerUserId: string | null
  personId: string | null
  organizationId: string | null
  sourceThreadId: string | null
  sourceMessageId: string | null
  sourceKind: 'patient_followup' | 'bd_task'
}

export type ContactThreadRecord = {
  id: string
  threadKey: string
  subject: string | null
  sensitivity: string
  reviewStatus: string
  lastMessageAt: string | null
  lastMessageDirection: string | null
  personId: string | null
  organizationId: string | null
  sourcePatientLeadId: string | null
  sourceBdCompanyId: string | null
  sourceBdContactId: string | null
  sourceBdOpportunityId: string | null
  studyId: string | null
  studySubjectId: string | null
}

export type ContactTimelineItem = {
  id: string
  kind: 'communication' | 'task' | 'note' | 'referral'
  communicationType: string
  direction: string
  subject: string | null
  summary: string | null
  linkedEmailThreadId: string | null
  linkedTaskId: string | null
  createdAt: string
}

export type ContactRuntimeWorkspace = {
  people: ContactPersonRecord[]
  organizations: ContactOrganizationRecord[]
  roles: ContactRoleRecord[]
  relationships: ContactRelationshipRecord[]
  referrals: ContactReferralRecord[]
  tasks: ContactTaskRecord[]
  threads: ContactThreadRecord[]
  recentActivity: ContactTimelineItem[]
  patientViewPeople: ContactPersonRecord[]
  bdViewOrganizations: ContactOrganizationRecord[]
  selectedPerson: ContactPersonDetail | null
  selectedOrganization: ContactOrganizationDetail | null
  unavailable: string[]
}

export type ContactPersonDetail = ContactPersonRecord & {
  displayName: string
  roles: string[]
  organizations: {
    id: string
    name: string
    relationshipType: string
    title: string | null
  }[]
  communications: ContactTimelineItem[]
  tasks: ContactTaskRecord[]
  referrals: ContactReferralRecord[]
}

export type ContactOrganizationDetail = ContactOrganizationRecord & {
  displayName: string
  contacts: {
    id: string
    displayName: string
    roleTypes: string[]
    relationshipType: string
    title: string | null
  }[]
  communications: ContactTimelineItem[]
  tasks: ContactTaskRecord[]
  referrals: ContactReferralRecord[]
}

export type ContactRuntimeLoadOptions = {
  q?: string | null
  mode?: 'people' | 'organizations' | 'patient' | 'business-development'
  personId?: string | null
  organizationId?: string | null
  supabaseClient?: SupabaseClient
}

const PATIENT_ROLE_SET = new Set(['patient', 'candidate', 'subject'])
const BD_ORG_ROLE_SET = new Set(['sponsor_contact', 'cro_contact', 'vendor_contact', 'laboratory_contact', 'physician', 'investigator', 'referral_partner', 'community_partner'])
const BD_ORG_TYPE_SET = new Set(['sponsor', 'cro', 'lab', 'biobank', 'vendor', 'physician_network', 'community_partner', 'other'])

export function splitContactName(fullName: string): { firstName: string; lastName: string } {
  const normalized = fullName.trim().replace(/\s+/g, ' ')
  if (!normalized) return { firstName: '', lastName: '' }
  const [firstName, ...rest] = normalized.split(' ')
  return {
    firstName,
    lastName: rest.join(' '),
  }
}

export function displayContactName(person: Pick<ContactPersonRecord, 'firstName' | 'lastName' | 'preferredName'>): string {
  return (person.preferredName?.trim() || `${person.firstName} ${person.lastName}`.trim() || 'Untitled contact').trim()
}

function normalizeSearchValue(value: string | null | undefined): string {
  return (value ?? '').toLowerCase().trim()
}

function includesSearch(haystack: string | null | undefined, needle: string): boolean {
  if (!needle) return true
  return normalizeSearchValue(haystack).includes(needle)
}

function matchesSearchFields(values: Array<string | null | undefined>, needle: string): boolean {
  if (!needle) return true
  return values.some((value) => includesSearch(value, needle))
}

function personRoleSet(personId: string, roles: ContactRoleRecord[]): string[] {
  return roles.filter((role) => role.personId === personId && role.active).map((role) => role.roleType)
}

function personOrgLinks(
  personId: string,
  relationships: ContactRelationshipRecord[],
  organizations: ContactOrganizationRecord[],
) {
  const orgMap = new Map(organizations.map((org) => [org.id, org]))
  return relationships
    .filter((relationship) => relationship.personId === personId && relationship.active)
    .map((relationship) => ({
      id: relationship.contactOrganizationId,
      name: orgMap.get(relationship.contactOrganizationId)?.organizationName ?? relationship.contactOrganizationId,
      organizationName: orgMap.get(relationship.contactOrganizationId)?.organizationName ?? relationship.contactOrganizationId,
      organizationType: orgMap.get(relationship.contactOrganizationId)?.organizationType ?? 'other',
      relationshipType: relationship.relationshipType,
      title: relationship.title,
    }))
}

function organizationContacts(
  organizationId: string,
  relationships: ContactRelationshipRecord[],
  people: ContactPersonRecord[],
  roles: ContactRoleRecord[],
) {
  const personMap = new Map(people.map((person) => [person.id, person]))
  return relationships
    .filter((relationship) => relationship.contactOrganizationId === organizationId && relationship.active)
    .map((relationship) => {
      const person = personMap.get(relationship.personId)
      return {
        id: relationship.personId,
        displayName: person ? displayContactName(person) : relationship.personId,
        roleTypes: person ? personRoleSet(person.id, roles) : [],
        relationshipType: relationship.relationshipType,
        title: relationship.title,
      }
    })
}

function buildPersonTimeline(
  person: ContactPersonRecord,
  threads: ContactThreadRecord[],
  tasks: ContactTaskRecord[],
  referrals: ContactReferralRecord[],
): ContactTimelineItem[] {
  const personThreads = threads.filter((thread) =>
    thread.personId === person.id
    || thread.sourcePatientLeadId === person.sourcePatientLeadId
    || thread.sourceBdContactId === person.sourceBdContactId,
  )
  const personTasks = tasks.filter((task) =>
    task.personId === person.id
    || task.personId === null && (
      task.sourceKind === 'patient_followup' && threadMatchesSource(task.sourceThreadId, threads, 'patient', person.sourcePatientLeadId)
    ),
  )
  const personReferrals = referrals.filter((referral) =>
    referral.referringPersonId === person.id,
  )

  return [
    ...personThreads.map((thread) => ({
      id: `thread:${thread.id}`,
      kind: 'communication' as const,
      communicationType: 'email',
      direction: thread.lastMessageDirection ?? 'draft',
      subject: thread.subject,
      summary: thread.reviewStatus,
      linkedEmailThreadId: thread.id,
      linkedTaskId: null,
      createdAt: thread.lastMessageAt ?? thread.id,
    })),
    ...personTasks.map((task) => ({
      id: `task:${task.id}`,
      kind: 'task' as const,
      communicationType: 'task',
      direction: 'internal',
      subject: task.title,
      summary: task.nextStep,
      linkedEmailThreadId: task.sourceThreadId,
      linkedTaskId: task.id,
      createdAt: task.dueAt ?? task.id,
    })),
    ...personReferrals.map((referral) => ({
      id: `referral:${referral.id}`,
      kind: 'referral' as const,
      communicationType: 'referral',
      direction: 'internal',
      subject: 'Referral relationship',
      summary: referral.notes,
      linkedEmailThreadId: null,
      linkedTaskId: null,
      createdAt: referral.id,
    })),
  ].sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)))
}

function threadMatchesSource(
  sourceThreadId: string | null,
  threads: ContactThreadRecord[],
  mode: 'patient' | 'bd',
  sourceId: string | null,
): boolean {
  if (!sourceThreadId || !sourceId) return false
  const thread = threads.find((item) => item.id === sourceThreadId)
  if (!thread) return false
  return mode === 'patient'
    ? thread.sourcePatientLeadId === sourceId
    : thread.sourceBdContactId === sourceId || thread.sourceBdCompanyId === sourceId
}

export function buildContactRuntimeWorkspace(input: {
  people: ContactPersonRecord[]
  organizations: ContactOrganizationRecord[]
  roles: ContactRoleRecord[]
  relationships: ContactRelationshipRecord[]
  referrals: ContactReferralRecord[]
  tasks: ContactTaskRecord[]
  threads: ContactThreadRecord[]
  q?: string | null
  mode?: 'people' | 'organizations' | 'patient' | 'business-development'
  personId?: string | null
  organizationId?: string | null
}): ContactRuntimeWorkspace {
  const needle = normalizeSearchValue(input.q)
  const people = input.people.filter((person) => {
    if (input.mode === 'business-development') {
      const roleTypes = personRoleSet(person.id, input.roles)
      const orgs = personOrgLinks(person.id, input.relationships, input.organizations)
      return roleTypes.some((role) => BD_ORG_ROLE_SET.has(role))
        || orgs.some((org) => BD_ORG_TYPE_SET.has(org.organizationType))
        || matchesSearchFields([
          displayContactName(person),
          person.email,
          person.phone,
          person.notes,
          ...roleTypes,
          ...orgs.map((org) => org.organizationName),
        ], needle)
    }
    if (input.mode === 'patient') {
      const roleTypes = personRoleSet(person.id, input.roles)
      return roleTypes.some((role) => PATIENT_ROLE_SET.has(role))
        || matchesSearchFields([
          displayContactName(person),
          person.email,
          person.phone,
          person.notes,
          ...roleTypes,
        ], needle)
    }
    return matchesSearchFields([
      displayContactName(person),
      person.email,
      person.phone,
      person.notes,
      person.language,
      person.status,
      ...personRoleSet(person.id, input.roles),
    ], needle)
  })

  const organizations = input.organizations.filter((organization) => {
    if (input.mode === 'patient') return false
    if (input.mode === 'business-development') {
      return matchesSearchFields([
        organization.organizationName,
        organization.organizationType,
        organization.website,
        organization.email,
        organization.phone,
        organization.address,
        organization.notes,
      ], needle)
    }
    return matchesSearchFields([
      organization.organizationName,
      organization.organizationType,
      organization.website,
      organization.email,
      organization.phone,
      organization.address,
      organization.notes,
    ], needle)
  })

  const recentActivity = buildUnifiedActivity(
    people,
    organizations,
    input.roles,
    input.relationships,
    input.referrals,
    input.tasks,
    input.threads,
  ).filter((item) => matchesSearchFields([item.subject, item.summary, item.communicationType, item.direction], needle))

  const patientViewPeople = input.people.filter((person) =>
    personRoleSet(person.id, input.roles).some((role) => PATIENT_ROLE_SET.has(role)),
  )
  const bdViewOrganizations = input.organizations.filter((org) =>
    BD_ORG_TYPE_SET.has(org.organizationType) || matchesSearchFields([org.organizationName, org.notes], needle),
  )

  const selectedPersonId = input.personId ?? (input.mode === 'organizations' ? null : people[0]?.id ?? null)
  const selectedOrganizationId = input.organizationId ?? (input.mode === 'people' || input.mode === 'patient' ? null : organizations[0]?.id ?? null)

  const selectedPerson = selectedPersonId
    ? buildContactPersonDetail(input.people.find((person) => person.id === selectedPersonId) ?? null, {
        roles: input.roles,
        relationships: input.relationships,
        organizations: input.organizations,
        tasks: input.tasks,
        threads: input.threads,
        referrals: input.referrals,
      })
    : null

  const selectedOrganization = selectedOrganizationId
    ? buildContactOrganizationDetail(input.organizations.find((org) => org.id === selectedOrganizationId) ?? null, {
        people: input.people,
        roles: input.roles,
        relationships: input.relationships,
        tasks: input.tasks,
        threads: input.threads,
        referrals: input.referrals,
      })
    : null

  return {
    people,
    organizations,
    roles: input.roles,
    relationships: input.relationships,
    referrals: input.referrals,
    tasks: input.tasks,
    threads: input.threads,
    recentActivity,
    patientViewPeople,
    bdViewOrganizations,
    selectedPerson,
    selectedOrganization,
    unavailable: [],
  }
}

function buildUnifiedActivity(
  people: ContactPersonRecord[],
  organizations: ContactOrganizationRecord[],
  roles: ContactRoleRecord[],
  relationships: ContactRelationshipRecord[],
  referrals: ContactReferralRecord[],
  tasks: ContactTaskRecord[],
  threads: ContactThreadRecord[],
): ContactTimelineItem[] {
  const personMap = new Map(people.map((person) => [person.id, person]))
  const orgMap = new Map(organizations.map((org) => [org.id, org]))

  const communicationItems = threads.map((thread) => {
    const person = thread.personId ? personMap.get(thread.personId) : null
    const organization = thread.organizationId ? orgMap.get(thread.organizationId) : null
    const subject = thread.subject ?? (person ? displayContactName(person) : organization?.organizationName ?? 'Thread')
    return {
      id: `thread:${thread.id}`,
      kind: 'communication' as const,
      communicationType: 'email',
      direction: thread.lastMessageDirection ?? 'draft',
      subject,
      summary: `${thread.reviewStatus} · ${thread.sensitivity}`,
      linkedEmailThreadId: thread.id,
      linkedTaskId: null,
      createdAt: thread.lastMessageAt ?? thread.id,
    }
  })

  const taskItems = tasks.map((task) => ({
    id: `task:${task.id}`,
    kind: 'task' as const,
    communicationType: 'task',
    direction: 'internal',
    subject: task.title,
    summary: task.nextStep ?? task.status,
    linkedEmailThreadId: task.sourceThreadId,
    linkedTaskId: task.id,
    createdAt: task.dueAt ?? task.id,
  }))

  const referralItems = referrals.map((referral) => {
    const person = referral.referringPersonId ? personMap.get(referral.referringPersonId) : null
    const organization = referral.referringOrganizationId ? orgMap.get(referral.referringOrganizationId) : null
    return {
      id: `referral:${referral.id}`,
      kind: 'referral' as const,
      communicationType: 'referral',
      direction: 'internal',
      subject: 'Referral relationship',
      summary: [person ? displayContactName(person) : null, organization?.organizationName ?? null].filter(Boolean).join(' · ') || referral.notes,
      linkedEmailThreadId: null,
      linkedTaskId: null,
      createdAt: referral.id,
    }
  })

  return [...communicationItems, ...taskItems, ...referralItems].sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)))
}

function buildContactPersonDetail(
  person: ContactPersonRecord | null,
  context: {
    roles: ContactRoleRecord[]
    relationships: ContactRelationshipRecord[]
    organizations: ContactOrganizationRecord[]
    tasks: ContactTaskRecord[]
    threads: ContactThreadRecord[]
    referrals: ContactReferralRecord[]
  },
): ContactPersonDetail | null {
  if (!person) return null
  return {
    ...person,
    displayName: displayContactName(person),
    roles: personRoleSet(person.id, context.roles),
    organizations: personOrgLinks(person.id, context.relationships, context.organizations),
    communications: buildPersonTimeline(person, context.threads, context.tasks, context.referrals),
    tasks: context.tasks.filter((task) => task.personId === person.id || task.sourceKind === 'patient_followup' && task.sourceThreadId != null),
    referrals: context.referrals.filter((referral) => referral.referringPersonId === person.id),
  }
}

function buildContactOrganizationDetail(
  organization: ContactOrganizationRecord | null,
  context: {
    people: ContactPersonRecord[]
    roles: ContactRoleRecord[]
    relationships: ContactRelationshipRecord[]
    tasks: ContactTaskRecord[]
    threads: ContactThreadRecord[]
    referrals: ContactReferralRecord[]
  },
): ContactOrganizationDetail | null {
  if (!organization) return null
  const contacts = organizationContacts(organization.id, context.relationships, context.people, context.roles)
  return {
    ...organization,
    displayName: organization.organizationName,
    contacts,
    communications: context.threads
      .filter((thread) => thread.organizationId === organization.id || thread.sourceBdCompanyId === organization.sourceBdCompanyId)
      .map((thread) => ({
        id: `thread:${thread.id}`,
        kind: 'communication' as const,
        communicationType: 'email',
        direction: thread.lastMessageDirection ?? 'draft',
        subject: thread.subject,
        summary: `${thread.reviewStatus} · ${thread.sensitivity}`,
        linkedEmailThreadId: thread.id,
        linkedTaskId: null,
        createdAt: thread.lastMessageAt ?? thread.id,
      }))
      .sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt))),
    tasks: context.tasks.filter((task) => task.organizationId === organization.id),
    referrals: context.referrals.filter((referral) => referral.referringOrganizationId === organization.id),
  }
}

export async function loadContactRuntimeWorkspace(
  organizationId: string,
  options?: ContactRuntimeLoadOptions,
): Promise<ContactRuntimeWorkspace> {
  const supabase = options?.supabaseClient ?? (await createServerClient())
  const unavailable: string[] = []

  const [
    peopleResult,
    organizationsResult,
    rolesResult,
    relationshipsResult,
    referralsResult,
    tasksResult,
    bdTasksResult,
    threadsResult,
  ] = await Promise.all([
    supabase
      .from('contact_people')
      .select('id, organization_id, source_patient_lead_id, source_bd_contact_id, first_name, last_name, preferred_name, email, phone, alternate_phone, language, notes, status, owner_user_id, backup_owner_user_id, created_at, updated_at')
      .eq('organization_id', organizationId)
      .order('updated_at', { ascending: false })
      .limit(200),
    supabase
      .from('contact_organizations')
      .select('id, organization_id, source_bd_company_id, organization_name, organization_type, website, phone, email, address, notes, status, owner_user_id, backup_owner_user_id, created_at, updated_at')
      .eq('organization_id', organizationId)
      .order('updated_at', { ascending: false })
      .limit(200),
    supabase
      .from('contact_roles')
      .select('id, organization_id, person_id, role_type, active')
      .eq('organization_id', organizationId)
      .order('created_at', { ascending: false })
      .limit(400),
    supabase
      .from('contact_relationships')
      .select('id, organization_id, person_id, contact_organization_id, relationship_type, title, start_date, end_date, active')
      .eq('organization_id', organizationId)
      .order('created_at', { ascending: false })
      .limit(400),
    supabase
      .from('contact_referral_relationships')
      .select('id, organization_id, referring_person_id, referring_organization_id, receiving_site_id, active, notes, referrals_generated, enrollments_generated, randomizations_generated')
      .eq('organization_id', organizationId)
      .order('created_at', { ascending: false })
      .limit(200),
    supabase
      .from('patient_followups')
      .select('id, title, next_step, due_at, status, priority, notes, owner_user_id, contact_person_id, contact_organization_id, source_communication_thread_id, source_communication_message_id')
      .eq('organization_id', organizationId)
      .order('due_at', { ascending: true, nullsFirst: false })
      .limit(200),
    supabase
    .from('bd_tasks')
      .select('id, title, next_step, due_at, status, priority, notes, owner_user_id, contact_person_id, contact_organization_id, source_communication_thread_id, source_communication_message_id, company_id, contact_id')
      .eq('organization_id', organizationId)
      .order('due_at', { ascending: true, nullsFirst: false })
      .limit(200),
    supabase
      .from('communications_threads')
      .select('id, thread_key, subject, sensitivity, review_status, last_message_at, last_message_direction, patient_lead_id, bd_company_id, bd_contact_id, bd_opportunity_id, study_id, study_subject_id, contact_person_id, contact_organization_id')
      .eq('organization_id', organizationId)
      .order('last_message_at', { ascending: false, nullsFirst: false })
      .limit(200),
  ])

  if (peopleResult.error) unavailable.push(peopleResult.error.message)
  if (organizationsResult.error) unavailable.push(organizationsResult.error.message)
  if (rolesResult.error) unavailable.push(rolesResult.error.message)
  if (relationshipsResult.error) unavailable.push(relationshipsResult.error.message)
  if (referralsResult.error) unavailable.push(referralsResult.error.message)
  if (tasksResult.error) unavailable.push(tasksResult.error.message)
  if (bdTasksResult.error) unavailable.push(bdTasksResult.error.message)
  if (threadsResult.error) unavailable.push(threadsResult.error.message)

  const people = (peopleResult.data ?? []).map((row) => ({
    id: String(row.id),
    organizationId: String(row.organization_id),
    sourcePatientLeadId: row.source_patient_lead_id ? String(row.source_patient_lead_id) : null,
    sourceBdContactId: row.source_bd_contact_id ? String(row.source_bd_contact_id) : null,
    firstName: String(row.first_name ?? ''),
    lastName: String(row.last_name ?? ''),
    preferredName: row.preferred_name ? String(row.preferred_name) : null,
    email: row.email ? String(row.email) : null,
    phone: row.phone ? String(row.phone) : null,
    alternatePhone: row.alternate_phone ? String(row.alternate_phone) : null,
    language: row.language ? String(row.language) : null,
    notes: row.notes ? String(row.notes) : null,
    status: String(row.status ?? 'active'),
    ownerUserId: row.owner_user_id ? String(row.owner_user_id) : null,
    backupOwnerUserId: row.backup_owner_user_id ? String(row.backup_owner_user_id) : null,
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at),
  }))

  const organizations = (organizationsResult.data ?? []).map((row) => ({
    id: String(row.id),
    organizationId: String(row.organization_id),
    sourceBdCompanyId: row.source_bd_company_id ? String(row.source_bd_company_id) : null,
    organizationName: String(row.organization_name ?? ''),
    organizationType: String(row.organization_type ?? 'other'),
    website: row.website ? String(row.website) : null,
    phone: row.phone ? String(row.phone) : null,
    email: row.email ? String(row.email) : null,
    address: row.address ? String(row.address) : null,
    notes: row.notes ? String(row.notes) : null,
    status: String(row.status ?? 'active'),
    ownerUserId: row.owner_user_id ? String(row.owner_user_id) : null,
    backupOwnerUserId: row.backup_owner_user_id ? String(row.backup_owner_user_id) : null,
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at),
  }))

  const roles = (rolesResult.data ?? []).map((row) => ({
    id: String(row.id),
    organizationId: String(row.organization_id),
    personId: String(row.person_id),
    roleType: String(row.role_type ?? 'coordinator'),
    active: Boolean(row.active),
  }))

  const relationships = (relationshipsResult.data ?? []).map((row) => ({
    id: String(row.id),
    organizationId: String(row.organization_id),
    personId: String(row.person_id),
    contactOrganizationId: String(row.contact_organization_id),
    relationshipType: String(row.relationship_type ?? 'related'),
    title: row.title ? String(row.title) : null,
    startDate: row.start_date ? String(row.start_date) : null,
    endDate: row.end_date ? String(row.end_date) : null,
    active: Boolean(row.active),
  }))

  const referrals = (referralsResult.data ?? []).map((row) => ({
    id: String(row.id),
    organizationId: String(row.organization_id),
    referringPersonId: row.referring_person_id ? String(row.referring_person_id) : null,
    referringOrganizationId: row.referring_organization_id ? String(row.referring_organization_id) : null,
    receivingSiteId: String(row.receiving_site_id),
    active: Boolean(row.active),
    notes: row.notes ? String(row.notes) : null,
    referralsGenerated: Number(row.referrals_generated ?? 0),
    enrollmentsGenerated: Number(row.enrollments_generated ?? 0),
    randomizationsGenerated: Number(row.randomizations_generated ?? 0),
  }))

  const tasks: ContactTaskRecord[] = [
    ...(tasksResult.data ?? []).map((row) => ({
      id: String(row.id),
      title: String(row.title),
      nextStep: row.next_step ? String(row.next_step) : null,
      dueAt: row.due_at ? String(row.due_at) : null,
      status: String(row.status ?? 'open'),
      priority: String(row.priority ?? 'normal'),
      notes: row.notes ? String(row.notes) : null,
      ownerUserId: row.owner_user_id ? String(row.owner_user_id) : null,
      personId: row.contact_person_id ? String(row.contact_person_id) : null,
      organizationId: row.contact_organization_id ? String(row.contact_organization_id) : null,
      sourceThreadId: row.source_communication_thread_id ? String(row.source_communication_thread_id) : null,
      sourceMessageId: row.source_communication_message_id ? String(row.source_communication_message_id) : null,
      sourceKind: 'patient_followup' as const,
    })),
    ...(bdTasksResult.data ?? []).map((row) => ({
      id: String(row.id),
      title: String(row.title),
      nextStep: row.next_step ? String(row.next_step) : null,
      dueAt: row.due_at ? String(row.due_at) : null,
      status: String(row.status ?? 'open'),
      priority: String(row.priority ?? 'normal'),
      notes: row.notes ? String(row.notes) : null,
      ownerUserId: row.owner_user_id ? String(row.owner_user_id) : null,
      personId: row.contact_person_id ? String(row.contact_person_id) : null,
      organizationId: row.contact_organization_id ? String(row.contact_organization_id) : null,
      sourceThreadId: row.source_communication_thread_id ? String(row.source_communication_thread_id) : null,
      sourceMessageId: row.source_communication_message_id ? String(row.source_communication_message_id) : null,
      sourceKind: 'bd_task' as const,
    })),
  ]

  const threads = (threadsResult.data ?? []).map((row) => ({
    id: String(row.id),
    threadKey: String(row.thread_key),
    subject: row.subject ? String(row.subject) : null,
    sensitivity: String(row.sensitivity ?? 'business_development'),
    reviewStatus: String(row.review_status ?? 'draft'),
    lastMessageAt: row.last_message_at ? String(row.last_message_at) : null,
    lastMessageDirection: row.last_message_direction ? String(row.last_message_direction) : null,
    personId: row.contact_person_id ? String(row.contact_person_id) : null,
    organizationId: row.contact_organization_id ? String(row.contact_organization_id) : null,
    sourcePatientLeadId: row.patient_lead_id ? String(row.patient_lead_id) : null,
    sourceBdCompanyId: row.bd_company_id ? String(row.bd_company_id) : null,
    sourceBdContactId: row.bd_contact_id ? String(row.bd_contact_id) : null,
    sourceBdOpportunityId: row.bd_opportunity_id ? String(row.bd_opportunity_id) : null,
    studyId: row.study_id ? String(row.study_id) : null,
    studySubjectId: row.study_subject_id ? String(row.study_subject_id) : null,
  }))

  const workspace = buildContactRuntimeWorkspace({
    people,
    organizations,
    roles,
    relationships,
    referrals,
    tasks,
    threads,
    q: options?.q ?? null,
    mode: options?.mode ?? 'people',
    personId: options?.personId ?? null,
    organizationId: options?.organizationId ?? null,
  })

  return {
    ...workspace,
    unavailable,
  }
}
