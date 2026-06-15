import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import type { SupabaseClient } from '@supabase/supabase-js'
import { createServerClient } from '@/lib/supabase/server'
import { hasActiveOrganizationMembership } from '@/lib/auth/membership-access'
import { getOrganizationMemberships, getSessionUser } from '@/lib/auth/session'
import { canAccessCommunications, canManageCommunications } from '@/lib/rbac/permissions'
import { formOptionalDateTime, formOptionalText, formText } from '@/lib/crm/forms'
import { resolveIPageMailboxConfig, sendIPageMessage, syncIPageMailbox, testIPageSmtp } from './ipage-mailbox'

export type CommunicationsProviderState = {
  kind: 'mock' | 'ipage'
  available: boolean
  reason: string | null
}

export type CommunicationsMailboxRow = {
  id: string
  mailboxEmail: string
  displayName: string | null
  provider: string
  syncEnabled: boolean
  syncStatus: string
  lastSyncedAt: string | null
  notes: string | null
}

export type CommunicationsThreadRow = {
  id: string
  sensitivity: string
  threadKey: string
  subject: string | null
  reviewStatus: string
  vipSummary: string | null
  vipFollowUpDraft: string | null
  lastMessageAt: string | null
  lastMessageDirection: string | null
  patientLeadId: string | null
  bdCompanyId: string | null
  bdContactId: string | null
  bdOpportunityId: string | null
  studyId: string | null
  studySubjectId: string | null
  contactPersonId: string | null
  contactOrganizationId: string | null
}

export type CommunicationsMessageRow = {
  id: string
  direction: string
  status: string
  channel: string
  subject: string | null
  body: string | null
  reviewedAt: string | null
  sentAt: string | null
  receivedAt: string | null
  requiresHumanReview: boolean
}

export type CommunicationsOverview = {
  provider: CommunicationsProviderState
  mailboxCount: number
  threadCount: number
  draftCount: number
  reviewCount: number
  sentCount: number
  recentThreads: CommunicationsThreadRow[]
  upcomingFollowUps: {
    id: string
    threadId: string
    subject: string | null
    sensitivity: string
    reviewStatus: string
    recommendedNextStep: string
  }[]
  unavailable: string[]
}

export type CommunicationsThreadDetail = {
  thread: CommunicationsThreadRow | null
  messages: CommunicationsMessageRow[]
  linkedTasks: {
    id: string
    source: 'patient_followup' | 'bd_task'
    title: string
    status: string
    priority: string
    dueAt: string | null
    nextStep: string | null
  }[]
  vipSummary: string
  vipFollowUpDraft: string
  unavailable: string[]
}

export type CommunicationsSettings = {
  provider: CommunicationsProviderState
  mailboxes: CommunicationsMailboxRow[]
  unavailable: string[]
}

function providerState(): CommunicationsProviderState {
  const configured = (process.env.COMMUNICATIONS_PROVIDER ?? 'mock').trim().toLowerCase()
  if (configured === 'ipage') {
    const hasImap = Boolean(process.env.IPAGE_IMAP_HOST?.trim())
    const hasSmtp = Boolean(process.env.IPAGE_SMTP_HOST?.trim())
    if (hasImap && hasSmtp) {
      return { kind: 'ipage', available: true, reason: null }
    }
    return {
      kind: 'ipage',
      available: false,
      reason: 'iPage provider is configured without IMAP/SMTP host credentials',
    }
  }
  return {
    kind: 'mock',
    available: true,
    reason: null,
  }
}

function threadSearchFilter(q: string): string {
  const term = q.trim().replace(/,/g, ' ')
  const escaped = term.replace(/%/g, '\\%').replace(/_/g, '\\_')
  return [
    `subject.ilike.%${escaped}%`,
    `thread_key.ilike.%${escaped}%`,
    `vip_summary.ilike.%${escaped}%`,
    `vip_follow_up_draft.ilike.%${escaped}%`,
  ].join(',')
}

function deriveThreadVipSignals(messages: CommunicationsMessageRow[], thread: CommunicationsThreadRow | null) {
  const latestMessage = messages[0]
  const sourceText = [thread?.subject, latestMessage?.subject, latestMessage?.body]
    .filter(Boolean)
    .join(' ')
    .trim()
  const lower = sourceText.toLowerCase()
  let summary = thread?.vipSummary?.trim() || ''
  let followUpDraft = thread?.vipFollowUpDraft?.trim() || ''

  if (!summary) {
    summary = sourceText
      ? `Thread touches ${thread?.sensitivity ?? 'communications'} and currently has ${messages.length} message${messages.length === 1 ? '' : 's'}.`
      : 'Thread has no message content available yet.'
  }

  if (!followUpDraft) {
    if (lower.includes('budget') || lower.includes('cta') || lower.includes('contract')) {
      followUpDraft = 'Follow up on budget / CTA terms, confirm next review step, and keep the decision owner visible.'
    } else if (lower.includes('patient') || lower.includes('screen') || lower.includes('visit')) {
      followUpDraft = 'Confirm patient navigation status, review next action, and close the loop on follow-up timing.'
    } else {
      followUpDraft = 'Acknowledge receipt, confirm next action, and assign the follow-up owner before sending.'
    }
  }

  return { summary, followUpDraft }
}

async function requireCommunicationsAccess(organizationId: string) {
  const user = await getSessionUser()
  if (!user) redirect('/login')
  const memberships = await getOrganizationMemberships(user.id)
  if (!hasActiveOrganizationMembership(memberships, organizationId)) redirect('/crm')
  if (!canAccessCommunications(memberships, organizationId)) redirect('/crm')
  return { user, memberships }
}

async function requireCommunicationsManage(organizationId: string) {
  const { memberships } = await requireCommunicationsAccess(organizationId)
  if (!canManageCommunications(memberships, organizationId)) {
    redirect('/communications?result=forbidden')
  }
}

export async function loadCommunicationsOverview(
  organizationId: string,
  q?: string | null,
  sensitivity?: string | null,
  supabaseClient?: SupabaseClient,
): Promise<CommunicationsOverview> {
  const supabase = supabaseClient ?? (await createServerClient())
  const provider = providerState()
  const unavailable: string[] = []

  const mailboxResult = await supabase
    .from('communications_mailboxes')
    .select('id, mailbox_email, display_name, provider, sync_enabled, sync_status, last_synced_at, notes')
    .eq('organization_id', organizationId)
    .is('archived_at', null)
    .order('created_at', { ascending: false })
    .limit(8)

  let threadsQuery = supabase
    .from('communications_threads')
    .select('id, sensitivity, thread_key, subject, review_status, vip_summary, vip_follow_up_draft, last_message_at, last_message_direction, patient_lead_id, bd_company_id, bd_contact_id, bd_opportunity_id, study_id, study_subject_id, contact_person_id, contact_organization_id')
    .eq('organization_id', organizationId)
    .is('archived_at', null)
    .order('last_message_at', { ascending: false, nullsFirst: false })
    .limit(25)

  if (q?.trim()) {
    threadsQuery = threadsQuery.or(threadSearchFilter(q))
  }
  if (sensitivity?.trim()) {
    threadsQuery = threadsQuery.eq('sensitivity', sensitivity.trim())
  }

  const [threadsResult, draftCountResult, reviewCountResult, sentCountResult] = await Promise.all([
    threadsQuery,
    supabase
      .from('communications_messages')
      .select('id', { count: 'exact', head: true })
      .eq('organization_id', organizationId)
      .eq('status', 'draft'),
    supabase
      .from('communications_messages')
      .select('id', { count: 'exact', head: true })
      .eq('organization_id', organizationId)
      .eq('status', 'queued'),
    supabase
      .from('communications_messages')
      .select('id', { count: 'exact', head: true })
      .eq('organization_id', organizationId)
      .eq('status', 'sent'),
  ])

  if (mailboxResult.error) unavailable.push(mailboxResult.error.message)
  if (threadsResult.error) unavailable.push(threadsResult.error.message)
  if (draftCountResult.error) unavailable.push(draftCountResult.error.message)
  if (reviewCountResult.error) unavailable.push(reviewCountResult.error.message)
  if (sentCountResult.error) unavailable.push(sentCountResult.error.message)

  const recentThreads = (threadsResult.data ?? []).map((row) => ({
    id: String(row.id),
    sensitivity: String(row.sensitivity ?? 'business_development'),
    threadKey: String(row.thread_key),
    subject: row.subject ? String(row.subject) : null,
    reviewStatus: String(row.review_status ?? 'draft'),
    vipSummary: row.vip_summary ? String(row.vip_summary) : null,
    vipFollowUpDraft: row.vip_follow_up_draft ? String(row.vip_follow_up_draft) : null,
    lastMessageAt: row.last_message_at ? String(row.last_message_at) : null,
    lastMessageDirection: row.last_message_direction ? String(row.last_message_direction) : null,
    patientLeadId: row.patient_lead_id ? String(row.patient_lead_id) : null,
    bdCompanyId: row.bd_company_id ? String(row.bd_company_id) : null,
    bdContactId: row.bd_contact_id ? String(row.bd_contact_id) : null,
    bdOpportunityId: row.bd_opportunity_id ? String(row.bd_opportunity_id) : null,
    studyId: row.study_id ? String(row.study_id) : null,
    studySubjectId: row.study_subject_id ? String(row.study_subject_id) : null,
    contactPersonId: row.contact_person_id ? String(row.contact_person_id) : null,
    contactOrganizationId: row.contact_organization_id ? String(row.contact_organization_id) : null,
  }))

  const upcomingFollowUps = recentThreads.slice(0, 8).map((thread) => {
    const recommendation =
      thread.reviewStatus === 'approved'
        ? 'Send after human review.'
        : thread.reviewStatus === 'needs_review'
          ? 'Review before sending.'
          : 'Draft follow-up and assign reviewer.'
    return {
      id: thread.id,
      threadId: thread.id,
      subject: thread.subject,
      sensitivity: thread.sensitivity,
      reviewStatus: thread.reviewStatus,
      recommendedNextStep: recommendation,
    }
  })

  return {
    provider,
    mailboxCount: mailboxResult.count ?? (mailboxResult.data ?? []).length,
    threadCount: threadsResult.count ?? (threadsResult.data ?? []).length,
    draftCount: draftCountResult.count ?? 0,
    reviewCount: reviewCountResult.count ?? 0,
    sentCount: sentCountResult.count ?? 0,
    recentThreads,
    upcomingFollowUps,
    unavailable,
  }
}

export async function loadCommunicationsSettings(
  organizationId: string,
  supabaseClient?: SupabaseClient,
): Promise<CommunicationsSettings> {
  const supabase = supabaseClient ?? (await createServerClient())
  const provider = providerState()
  const unavailable: string[] = []

  const { data: mailboxes, error } = await supabase
    .from('communications_mailboxes')
    .select('id, mailbox_email, display_name, provider, sync_enabled, sync_status, last_synced_at, notes')
    .eq('organization_id', organizationId)
    .is('archived_at', null)
    .order('created_at', { ascending: false })
    .limit(20)

  if (error) unavailable.push(error.message)

  return {
    provider,
    mailboxes: (mailboxes ?? []).map((row) => ({
      id: String(row.id),
      mailboxEmail: String(row.mailbox_email),
      displayName: row.display_name ? String(row.display_name) : null,
      provider: String(row.provider ?? 'mock'),
      syncEnabled: Boolean(row.sync_enabled),
      syncStatus: String(row.sync_status ?? 'mock'),
      lastSyncedAt: row.last_synced_at ? String(row.last_synced_at) : null,
      notes: row.notes ? String(row.notes) : null,
    })),
    unavailable,
  }
}

export async function loadCommunicationThreadDetail(
  organizationId: string,
  threadId: string,
  supabaseClient?: SupabaseClient,
): Promise<CommunicationsThreadDetail> {
  const supabase = supabaseClient ?? (await createServerClient())
  const unavailable: string[] = []

  const { data: thread, error: threadError } = await supabase
    .from('communications_threads')
    .select('id, sensitivity, thread_key, subject, review_status, vip_summary, vip_follow_up_draft, last_message_at, last_message_direction, patient_lead_id, bd_company_id, bd_contact_id, bd_opportunity_id, study_id, study_subject_id, contact_person_id, contact_organization_id')
    .eq('organization_id', organizationId)
    .eq('id', threadId)
    .maybeSingle()
  if (threadError) unavailable.push(threadError.message)

  const { data: messages, error: messagesError } = await supabase
    .from('communications_messages')
    .select('id, direction, status, channel, subject, body, reviewed_at, sent_at, received_at, requires_human_review')
    .eq('organization_id', organizationId)
    .eq('thread_id', threadId)
    .order('created_at', { ascending: true })
  if (messagesError) unavailable.push(messagesError.message)

  const typedMessages = (messages ?? []).map((row) => ({
    id: String(row.id),
    direction: String(row.direction ?? 'draft'),
    status: String(row.status ?? 'draft'),
    channel: String(row.channel ?? 'email'),
    subject: row.subject ? String(row.subject) : null,
    body: row.body ? String(row.body) : null,
    reviewedAt: row.reviewed_at ? String(row.reviewed_at) : null,
    sentAt: row.sent_at ? String(row.sent_at) : null,
    receivedAt: row.received_at ? String(row.received_at) : null,
    requiresHumanReview: Boolean(row.requires_human_review),
  }))

  const vip = deriveThreadVipSignals(typedMessages, thread ? {
    id: String(thread.id),
    sensitivity: String(thread.sensitivity ?? 'business_development'),
    threadKey: String(thread.thread_key),
    subject: thread.subject ? String(thread.subject) : null,
    reviewStatus: String(thread.review_status ?? 'draft'),
    vipSummary: thread.vip_summary ? String(thread.vip_summary) : null,
    vipFollowUpDraft: thread.vip_follow_up_draft ? String(thread.vip_follow_up_draft) : null,
    lastMessageAt: thread.last_message_at ? String(thread.last_message_at) : null,
    lastMessageDirection: thread.last_message_direction ? String(thread.last_message_direction) : null,
    patientLeadId: thread.patient_lead_id ? String(thread.patient_lead_id) : null,
    bdCompanyId: thread.bd_company_id ? String(thread.bd_company_id) : null,
    bdContactId: thread.bd_contact_id ? String(thread.bd_contact_id) : null,
    bdOpportunityId: thread.bd_opportunity_id ? String(thread.bd_opportunity_id) : null,
    studyId: thread.study_id ? String(thread.study_id) : null,
    studySubjectId: thread.study_subject_id ? String(thread.study_subject_id) : null,
    contactPersonId: thread.contact_person_id ? String(thread.contact_person_id) : null,
    contactOrganizationId: thread.contact_organization_id ? String(thread.contact_organization_id) : null,
  } : null)

  const linkedTasks: CommunicationsThreadDetail['linkedTasks'] = []
  if (thread?.sensitivity === 'patient') {
    const { data: patientFollowups, error: patientFollowupsError } = await supabase
      .from('patient_followups')
      .select('id, title, status, priority, due_at, next_step')
      .eq('organization_id', organizationId)
      .eq('source_communication_thread_id', threadId)
      .order('due_at', { ascending: true, nullsFirst: false })
    if (patientFollowupsError) unavailable.push(patientFollowupsError.message)
    linkedTasks.push(...(patientFollowups ?? []).map((row) => ({
      id: String(row.id),
      source: 'patient_followup' as const,
      title: String(row.title),
      status: String(row.status ?? 'open'),
      priority: String(row.priority ?? 'normal'),
      dueAt: row.due_at ? String(row.due_at) : null,
      nextStep: row.next_step ? String(row.next_step) : null,
    })))
  } else {
    const { data: bdTasks, error: bdTasksError } = await supabase
      .from('bd_tasks')
      .select('id, title, status, priority, due_at, next_step')
      .eq('organization_id', organizationId)
      .eq('source_communication_thread_id', threadId)
      .order('due_at', { ascending: true, nullsFirst: false })
    if (bdTasksError) unavailable.push(bdTasksError.message)
    linkedTasks.push(...(bdTasks ?? []).map((row) => ({
      id: String(row.id),
      source: 'bd_task' as const,
      title: String(row.title),
      status: String(row.status ?? 'open'),
      priority: String(row.priority ?? 'normal'),
      dueAt: row.due_at ? String(row.due_at) : null,
      nextStep: row.next_step ? String(row.next_step) : null,
    })))
  }

  return {
    thread: thread
      ? {
          id: String(thread.id),
          sensitivity: String(thread.sensitivity ?? 'business_development'),
          threadKey: String(thread.thread_key),
          subject: thread.subject ? String(thread.subject) : null,
          reviewStatus: String(thread.review_status ?? 'draft'),
          vipSummary: thread.vip_summary ? String(thread.vip_summary) : null,
          vipFollowUpDraft: thread.vip_follow_up_draft ? String(thread.vip_follow_up_draft) : null,
          lastMessageAt: thread.last_message_at ? String(thread.last_message_at) : null,
          lastMessageDirection: thread.last_message_direction ? String(thread.last_message_direction) : null,
          patientLeadId: thread.patient_lead_id ? String(thread.patient_lead_id) : null,
          bdCompanyId: thread.bd_company_id ? String(thread.bd_company_id) : null,
          bdContactId: thread.bd_contact_id ? String(thread.bd_contact_id) : null,
          bdOpportunityId: thread.bd_opportunity_id ? String(thread.bd_opportunity_id) : null,
          studyId: thread.study_id ? String(thread.study_id) : null,
          studySubjectId: thread.study_subject_id ? String(thread.study_subject_id) : null,
          contactPersonId: thread.contact_person_id ? String(thread.contact_person_id) : null,
          contactOrganizationId: thread.contact_organization_id ? String(thread.contact_organization_id) : null,
        }
      : null,
    messages: typedMessages,
    linkedTasks,
    vipSummary: vip.summary,
    vipFollowUpDraft: vip.followUpDraft,
    unavailable,
  }
}

async function afterCommunicationMutation(paths: string[]) {
  revalidatePath('/communications')
  for (const path of paths) revalidatePath(path)
}

async function loadThreadRecipientCandidates(
  supabase: SupabaseClient,
  organizationId: string,
  thread: Pick<
    CommunicationsThreadRow,
    'patientLeadId' | 'bdCompanyId' | 'bdContactId' | 'contactPersonId' | 'contactOrganizationId' | 'threadKey' | 'subject'
  >,
): Promise<string[]> {
  const recipients: string[] = []

  const { data: latestInbound } = await supabase
    .from('communications_messages')
    .select('from_address, direction')
    .eq('organization_id', organizationId)
    .eq('provider_thread_id', thread.threadKey)
    .eq('direction', 'inbound')
    .order('received_at', { ascending: false, nullsFirst: false })
    .limit(1)
    .maybeSingle()

  if (latestInbound?.from_address) {
    recipients.push(String(latestInbound.from_address))
  }

  if (recipients.length > 0) return recipients

  if (thread.patientLeadId) {
    const { data } = await supabase
      .from('patient_leads')
      .select('email')
      .eq('organization_id', organizationId)
      .eq('id', thread.patientLeadId)
      .maybeSingle()
    if (data?.email) recipients.push(String(data.email))
  }

  if (recipients.length > 0) return recipients

  if (thread.bdContactId) {
    const { data } = await supabase
      .from('bd_contacts')
      .select('email')
      .eq('organization_id', organizationId)
      .eq('id', thread.bdContactId)
      .maybeSingle()
    if (data?.email) recipients.push(String(data.email))
  }

  if (recipients.length > 0) return recipients

  if (thread.contactPersonId) {
    const { data } = await supabase
      .from('contact_people')
      .select('email')
      .eq('organization_id', organizationId)
      .eq('id', thread.contactPersonId)
      .maybeSingle()
    if (data?.email) recipients.push(String(data.email))
  }

  if (recipients.length > 0) return recipients

  if (thread.contactOrganizationId) {
    const { data } = await supabase
      .from('contact_organizations')
      .select('email')
      .eq('organization_id', organizationId)
      .eq('id', thread.contactOrganizationId)
      .maybeSingle()
    if (data?.email) recipients.push(String(data.email))
  }

  if (recipients.length > 0) return recipients

  if (thread.bdCompanyId) {
    const { data } = await supabase
      .from('bd_companies')
      .select('primary_contact_email')
      .eq('organization_id', organizationId)
      .eq('id', thread.bdCompanyId)
      .maybeSingle()
    if (data?.primary_contact_email) recipients.push(String(data.primary_contact_email))
  }

  return recipients
}

export async function createCommunicationDraftAction(formData: FormData): Promise<void> {
  'use server'

  const organizationId = formText(formData, 'organizationId')
  const threadKey = formText(formData, 'threadKey')
  const subject = formOptionalText(formData, 'subject')
  const body = formOptionalText(formData, 'body')
  const sensitivity = formText(formData, 'sensitivity') || 'business_development'
  const contactPersonId = formOptionalText(formData, 'contactPersonId')
  const contactOrganizationId = formOptionalText(formData, 'contactOrganizationId')
  if (!organizationId || !threadKey) redirect('/communications?result=missing')

  await requireCommunicationsManage(organizationId)
  const supabase = await createServerClient()

  const { data: mailbox } = await supabase
    .from('communications_mailboxes')
    .select('id')
    .eq('organization_id', organizationId)
    .is('archived_at', null)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  const { data: thread, error: threadError } = await supabase
    .from('communications_threads')
    .upsert(
      {
        organization_id: organizationId,
        mailbox_id: mailbox?.id ?? null,
        sensitivity,
        thread_key: threadKey,
        subject,
        review_status: 'draft',
        contact_person_id: contactPersonId || null,
        contact_organization_id: contactOrganizationId || null,
        last_message_at: new Date().toISOString(),
        last_message_direction: 'draft',
      },
      { onConflict: 'organization_id,thread_key' },
    )
    .select('id')
    .single()

  if (threadError || !thread) {
    redirect(`/communications?result=error&reason=${encodeURIComponent(threadError?.message ?? 'Unable to create communication thread draft.')}`)
  }

  const { error: messageError } = await supabase.from('communications_messages').insert({
    organization_id: organizationId,
    mailbox_id: mailbox?.id ?? null,
    thread_id: thread.id,
    sensitivity,
    direction: 'draft',
    status: 'draft',
    channel: 'email',
    subject,
    body,
    requires_human_review: true,
  })

  if (messageError) {
    redirect(`/communications?thread=${encodeURIComponent(thread.id)}&result=error&reason=${encodeURIComponent(messageError.message)}`)
  }

  await afterCommunicationMutation([`/communications?thread=${encodeURIComponent(thread.id)}`])
  redirect(`/communications?thread=${encodeURIComponent(thread.id)}&result=draft-created`)
}

export async function markCommunicationReviewedAction(formData: FormData): Promise<void> {
  'use server'
  const organizationId = formText(formData, 'organizationId')
  const threadId = formText(formData, 'threadId')
  const messageId = formText(formData, 'messageId')
  if (!organizationId || !threadId || !messageId) redirect('/communications?result=missing')

  await requireCommunicationsManage(organizationId)
  const supabase = await createServerClient()
  const { error } = await supabase
    .from('communications_messages')
    .update({
      requires_human_review: false,
      reviewed_at: new Date().toISOString(),
      status: 'queued',
    })
    .eq('organization_id', organizationId)
    .eq('thread_id', threadId)
    .eq('id', messageId)

  if (error) {
    redirect(`/communications?thread=${encodeURIComponent(threadId)}&result=error&reason=${encodeURIComponent(error.message)}`)
  }

  await supabase
    .from('communications_threads')
    .update({ review_status: 'approved' })
    .eq('organization_id', organizationId)
    .eq('id', threadId)

  await afterCommunicationMutation([`/communications?thread=${encodeURIComponent(threadId)}`])
  redirect(`/communications?thread=${encodeURIComponent(threadId)}&result=reviewed`)
}

export async function createCommunicationTaskFromThreadAction(formData: FormData): Promise<void> {
  'use server'

  const organizationId = formText(formData, 'organizationId')
  const threadId = formText(formData, 'threadId')
  const title = formText(formData, 'title')
  if (!organizationId || !threadId || !title) redirect('/communications?result=missing')

  await requireCommunicationsManage(organizationId)
  const supabase = await createServerClient()

  const { data: thread, error: threadError } = await supabase
    .from('communications_threads')
    .select('id, sensitivity, patient_lead_id, bd_company_id, bd_contact_id, bd_opportunity_id, study_id, study_subject_id, contact_person_id, contact_organization_id')
    .eq('organization_id', organizationId)
    .eq('id', threadId)
    .maybeSingle()

  if (threadError || !thread) {
    redirect(`/communications?thread=${encodeURIComponent(threadId)}&result=error&reason=${encodeURIComponent(threadError?.message ?? 'Unable to load communication thread.')}`)
  }

  const { data: latestMessage } = await supabase
    .from('communications_messages')
    .select('id')
    .eq('organization_id', organizationId)
    .eq('thread_id', threadId)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  const taskType = (formText(formData, 'taskType') || (thread.sensitivity === 'patient' ? 'patient_followup' : 'bd_task')).trim()
  const dueAt = formOptionalDateTime(formData, 'dueAt')
  const nextStep = formOptionalText(formData, 'nextStep')
  const priority = formText(formData, 'priority') || 'normal'
  const notes = formOptionalText(formData, 'notes')

  if (taskType === 'patient_followup') {
    if (!thread.patient_lead_id) {
      redirect(`/communications?thread=${encodeURIComponent(threadId)}&result=error&reason=${encodeURIComponent('This thread is not linked to a patient lead.')}`)
    }
    const { error } = await supabase.from('patient_followups').insert({
      organization_id: organizationId,
      patient_lead_id: thread.patient_lead_id,
      linked_study_id: thread.study_id,
      title,
      next_step: nextStep,
      due_at: dueAt || undefined,
      status: 'open',
      priority,
      notes,
      source_communication_thread_id: threadId,
      source_communication_message_id: latestMessage?.id ?? null,
      contact_person_id: thread.contact_person_id ?? null,
      contact_organization_id: thread.contact_organization_id ?? null,
    })
    if (error) {
      redirect(`/communications?thread=${encodeURIComponent(threadId)}&result=error&reason=${encodeURIComponent(error.message)}`)
    }
  } else {
    if (!thread.bd_company_id) {
      redirect(`/communications?thread=${encodeURIComponent(threadId)}&result=error&reason=${encodeURIComponent('This thread is not linked to a business development account.')}`)
    }
    const { error } = await supabase.from('bd_tasks').insert({
      organization_id: organizationId,
      company_id: thread.bd_company_id,
      contact_id: thread.bd_contact_id,
      opportunity_id: thread.bd_opportunity_id,
      title,
      next_step: nextStep,
      due_at: dueAt || undefined,
      status: 'open',
      priority,
      notes,
      source_communication_thread_id: threadId,
      source_communication_message_id: latestMessage?.id ?? null,
      contact_person_id: thread.contact_person_id ?? null,
      contact_organization_id: thread.contact_organization_id ?? null,
    })
    if (error) {
      redirect(`/communications?thread=${encodeURIComponent(threadId)}&result=error&reason=${encodeURIComponent(error.message)}`)
    }
  }

  await afterCommunicationMutation([`/communications?thread=${encodeURIComponent(threadId)}`])
  redirect(`/communications?thread=${encodeURIComponent(threadId)}&result=task-created`)
}

export async function saveCommunicationMailboxAction(formData: FormData): Promise<void> {
  'use server'

  const organizationId = formText(formData, 'organizationId')
  const mailboxEmail = formText(formData, 'mailboxEmail')
  const provider = (formText(formData, 'provider') || 'mock').trim().toLowerCase()
  if (!organizationId || !mailboxEmail) redirect('/communications/settings?result=missing')

  await requireCommunicationsManage(organizationId)
  const supabase = await createServerClient()
  const mailboxId = formOptionalText(formData, 'mailboxId') || null
  const imapHost = formOptionalText(formData, 'imapHost') || null
  const smtpHost = formOptionalText(formData, 'smtpHost') || null
  const syncEnabled = formText(formData, 'syncEnabled') === 'on'
  const syncStatus =
    provider === 'ipage'
      ? imapHost && smtpHost
        ? (syncEnabled ? 'pending' : 'blocked')
        : 'blocked'
      : 'mock'

  const payload = {
    organization_id: organizationId,
    mailbox_email: mailboxEmail,
    display_name: formOptionalText(formData, 'displayName'),
    provider: provider === 'ipage' ? 'ipage' : 'mock',
    imap_host: imapHost,
    imap_port: formOptionalText(formData, 'imapPort') ? Number(formOptionalText(formData, 'imapPort')) : null,
    imap_secure: formText(formData, 'imapSecure') !== 'off',
    smtp_host: smtpHost,
    smtp_port: formOptionalText(formData, 'smtpPort') ? Number(formOptionalText(formData, 'smtpPort')) : null,
    smtp_secure: formText(formData, 'smtpSecure') !== 'off',
    sync_enabled: syncEnabled,
    sync_status: syncStatus,
    notes: formOptionalText(formData, 'notes'),
  }

  const result = mailboxId
    ? await supabase
        .from('communications_mailboxes')
        .update(payload)
        .eq('organization_id', organizationId)
        .eq('id', mailboxId)
    : await supabase
        .from('communications_mailboxes')
        .insert(payload)

  if (result.error) {
    redirect(`/communications/settings?result=error&reason=${encodeURIComponent(result.error.message)}`)
  }

  await afterCommunicationMutation(['/communications/settings'])
  redirect('/communications/settings?result=saved')
}

export async function refreshCommunicationMailboxAction(formData: FormData): Promise<void> {
  'use server'

  const organizationId = formText(formData, 'organizationId')
  const mailboxId = formText(formData, 'mailboxId')
  if (!organizationId || !mailboxId) redirect('/communications/settings?result=missing')

  await requireCommunicationsManage(organizationId)
  const supabase = await createServerClient()
  const { data: mailbox, error: mailboxError } = await supabase
    .from('communications_mailboxes')
    .select('id, organization_id, mailbox_email, display_name, provider, imap_host, imap_port, imap_secure, smtp_host, smtp_port, smtp_secure, sync_enabled, last_synced_at')
    .eq('organization_id', organizationId)
    .eq('id', mailboxId)
    .maybeSingle()

  if (mailboxError || !mailbox) {
    redirect(`/communications/settings?result=error&reason=${encodeURIComponent(mailboxError?.message ?? 'Mailbox not found.')}`)
  }

  const provider = providerState()
  const config = resolveIPageMailboxConfig({
    organizationId,
    mailboxId,
    mailboxEmail: String(mailbox.mailbox_email),
    displayName: mailbox.display_name ? String(mailbox.display_name) : null,
    provider: String(mailbox.provider ?? 'mock'),
    imapHost: mailbox.imap_host ? String(mailbox.imap_host) : null,
    imapPort: mailbox.imap_port ? Number(mailbox.imap_port) : null,
    imapSecure: mailbox.imap_secure != null ? Boolean(mailbox.imap_secure) : null,
    smtpHost: mailbox.smtp_host ? String(mailbox.smtp_host) : null,
    smtpPort: mailbox.smtp_port ? Number(mailbox.smtp_port) : null,
    smtpSecure: mailbox.smtp_secure != null ? Boolean(mailbox.smtp_secure) : null,
    lastSyncedAt: mailbox.last_synced_at ? String(mailbox.last_synced_at) : null,
  })

  if (provider.kind !== 'ipage' || !provider.available || !config) {
    const { error } = await supabase
      .from('communications_mailboxes')
      .update({
        sync_status: provider.kind === 'mock' ? 'mock' : 'blocked',
        sync_enabled: false,
        notes: provider.reason ?? 'iPage credentials are incomplete.',
      })
      .eq('organization_id', organizationId)
      .eq('id', mailboxId)
    if (error) {
      redirect(`/communications/settings?result=error&reason=${encodeURIComponent(error.message)}`)
    }
    await afterCommunicationMutation(['/communications/settings'])
    redirect('/communications/settings?result=blocked')
  }

  try {
    const smtpProbe = await testIPageSmtp(config)
    const syncResult = await syncIPageMailbox(supabase, config)

    const { error } = await supabase
      .from('communications_mailboxes')
      .update({
        sync_status: 'active',
        sync_enabled: true,
        last_synced_at: new Date().toISOString(),
        notes: [smtpProbe.notes, syncResult.notes].filter(Boolean).join(' · ') || null,
      })
      .eq('organization_id', organizationId)
      .eq('id', mailboxId)

    if (error) {
      redirect(`/communications/settings?result=error&reason=${encodeURIComponent(error.message)}`)
    }

    await afterCommunicationMutation(['/communications/settings', '/communications'])
    redirect(`/communications/settings?result=refreshed&reason=${encodeURIComponent(syncResult.notes)}`)
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Mailbox sync failed.'
    await supabase
      .from('communications_mailboxes')
      .update({
        sync_status: 'error',
        notes: message,
      })
      .eq('organization_id', organizationId)
      .eq('id', mailboxId)
    redirect(`/communications/settings?result=error&reason=${encodeURIComponent(message)}`)
  }
}

export async function archiveCommunicationMailboxAction(formData: FormData): Promise<void> {
  'use server'

  const organizationId = formText(formData, 'organizationId')
  const mailboxId = formText(formData, 'mailboxId')
  if (!organizationId || !mailboxId) redirect('/communications/settings?result=missing')

  await requireCommunicationsManage(organizationId)
  const supabase = await createServerClient()

  const { error } = await supabase
    .from('communications_mailboxes')
    .update({
      archived_at: new Date().toISOString(),
      sync_enabled: false,
      sync_status: 'blocked',
    })
    .eq('organization_id', organizationId)
    .eq('id', mailboxId)

  if (error) {
    redirect(`/communications/settings?result=error&reason=${encodeURIComponent(error.message)}`)
  }

  await afterCommunicationMutation(['/communications/settings'])
  redirect('/communications/settings?result=archived')
}

export async function reactivateCommunicationMailboxAction(formData: FormData): Promise<void> {
  'use server'

  const organizationId = formText(formData, 'organizationId')
  const mailboxId = formText(formData, 'mailboxId')
  if (!organizationId || !mailboxId) redirect('/communications/settings?result=missing')

  await requireCommunicationsManage(organizationId)
  const supabase = await createServerClient()

  const { error } = await supabase
    .from('communications_mailboxes')
    .update({
      archived_at: null,
      sync_status: 'pending',
    })
    .eq('organization_id', organizationId)
    .eq('id', mailboxId)

  if (error) {
    redirect(`/communications/settings?result=error&reason=${encodeURIComponent(error.message)}`)
  }

  await afterCommunicationMutation(['/communications/settings'])
  redirect('/communications/settings?result=reactivated')
}

export async function sendCommunicationDraftAction(formData: FormData): Promise<void> {
  'use server'
  const organizationId = formText(formData, 'organizationId')
  const threadId = formText(formData, 'threadId')
  const messageId = formText(formData, 'messageId')
  if (!organizationId || !threadId || !messageId) redirect('/communications?result=missing')

  await requireCommunicationsManage(organizationId)
  const supabase = await createServerClient()
  const provider = providerState()

  const { data: thread, error: threadLoadError } = await supabase
    .from('communications_threads')
    .select('id, sensitivity, patient_lead_id, bd_company_id, bd_contact_id, contact_person_id, contact_organization_id, thread_key')
    .eq('organization_id', organizationId)
    .eq('id', threadId)
    .maybeSingle()

  if (threadLoadError || !thread) {
    redirect(`/communications?thread=${encodeURIComponent(threadId)}&result=error&reason=${encodeURIComponent(threadLoadError?.message ?? 'Unable to load communication thread.')}`)
  }

  const { data: message, error: messageLoadError } = await supabase
    .from('communications_messages')
    .select('id, subject, body, to_addresses, cc_addresses, from_address, provider_message_id')
    .eq('organization_id', organizationId)
    .eq('thread_id', threadId)
    .eq('id', messageId)
    .maybeSingle()

  if (messageLoadError || !message) {
    redirect(`/communications?thread=${encodeURIComponent(threadId)}&result=error&reason=${encodeURIComponent(messageLoadError?.message ?? 'Unable to load draft message.')}`)
  }

  const inferredRecipients = (message.to_addresses ?? []).filter(Boolean).length > 0
    ? (message.to_addresses ?? []).map((entry: string) => String(entry))
    : await loadThreadRecipientCandidates(supabase, organizationId, {
        patientLeadId: thread.patient_lead_id ? String(thread.patient_lead_id) : null,
        bdCompanyId: thread.bd_company_id ? String(thread.bd_company_id) : null,
        bdContactId: thread.bd_contact_id ? String(thread.bd_contact_id) : null,
        contactPersonId: thread.contact_person_id ? String(thread.contact_person_id) : null,
        contactOrganizationId: thread.contact_organization_id ? String(thread.contact_organization_id) : null,
        threadKey: String(thread.thread_key),
        subject: null,
      })

  if (provider.available && provider.kind === 'ipage') {
    const { data: mailbox } = await supabase
      .from('communications_mailboxes')
      .select('id, organization_id, mailbox_email, display_name, provider, imap_host, imap_port, imap_secure, smtp_host, smtp_port, smtp_secure, sync_enabled, last_synced_at')
      .eq('organization_id', organizationId)
      .is('archived_at', null)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    const config = mailbox
      ? resolveIPageMailboxConfig({
          organizationId,
          mailboxId: String(mailbox.id),
          mailboxEmail: String(mailbox.mailbox_email),
          displayName: mailbox.display_name ? String(mailbox.display_name) : null,
          provider: String(mailbox.provider ?? 'ipage'),
          imapHost: mailbox.imap_host ? String(mailbox.imap_host) : null,
          imapPort: mailbox.imap_port ? Number(mailbox.imap_port) : null,
          imapSecure: mailbox.imap_secure != null ? Boolean(mailbox.imap_secure) : null,
          smtpHost: mailbox.smtp_host ? String(mailbox.smtp_host) : null,
          smtpPort: mailbox.smtp_port ? Number(mailbox.smtp_port) : null,
          smtpSecure: mailbox.smtp_secure != null ? Boolean(mailbox.smtp_secure) : null,
          lastSyncedAt: mailbox.last_synced_at ? String(mailbox.last_synced_at) : null,
        })
      : null

    if (config && inferredRecipients.length > 0 && (message.body ?? '').trim()) {
      const sendResult = await sendIPageMessage(config, {
        fromAddress: config.mailboxEmail,
        toAddresses: inferredRecipients,
        ccAddresses: Array.isArray(message.cc_addresses) ? message.cc_addresses.map((entry) => String(entry)) : [],
        subject: String(message.subject ?? thread.thread_key ?? 'Vilo OS message'),
        body: String(message.body ?? ''),
        replyToMessageId: message.provider_message_id ? String(message.provider_message_id) : null,
      })

      if (sendResult.sent) {
        const { error: updateError } = await supabase
          .from('communications_messages')
          .update({
            status: 'sent',
            sent_at: new Date().toISOString(),
            from_address: config.mailboxEmail,
            to_addresses: inferredRecipients,
            error_message: null,
          })
          .eq('organization_id', organizationId)
          .eq('thread_id', threadId)
          .eq('id', messageId)

        if (updateError) {
          redirect(`/communications?thread=${encodeURIComponent(threadId)}&result=error&reason=${encodeURIComponent(updateError.message)}`)
        }

        await supabase
          .from('communications_threads')
          .update({
            review_status: 'sent',
            last_message_at: new Date().toISOString(),
            last_message_direction: 'outbound',
          })
          .eq('organization_id', organizationId)
          .eq('id', threadId)

        await afterCommunicationMutation([`/communications?thread=${encodeURIComponent(threadId)}`, '/communications'])
        redirect(`/communications?thread=${encodeURIComponent(threadId)}&result=sent`)
      }
    }
  }

  const nextStatus = provider.available && provider.kind === 'mock' ? 'sent' : 'queued'
  const { error } = await supabase
    .from('communications_messages')
    .update({
      status: nextStatus,
      sent_at: nextStatus === 'sent' ? new Date().toISOString() : null,
      error_message: provider.available ? null : provider.reason,
    })
    .eq('organization_id', organizationId)
    .eq('thread_id', threadId)
    .eq('id', messageId)

  if (error) {
    redirect(`/communications?thread=${encodeURIComponent(threadId)}&result=error&reason=${encodeURIComponent(error.message)}`)
  }

  await supabase
    .from('communications_threads')
    .update({
      review_status: nextStatus === 'sent' ? 'sent' : 'approved',
      last_message_at: new Date().toISOString(),
      last_message_direction: 'outbound',
    })
    .eq('organization_id', organizationId)
    .eq('id', threadId)

  await afterCommunicationMutation([`/communications?thread=${encodeURIComponent(threadId)}`])
  redirect(`/communications?thread=${encodeURIComponent(threadId)}&result=${nextStatus}`)
}
