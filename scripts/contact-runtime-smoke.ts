import assert from 'node:assert/strict'
import {
  buildContactRuntimeWorkspace,
  displayContactName,
  type ContactOrganizationRecord,
  type ContactPersonRecord,
  type ContactRelationshipRecord,
  type ContactReferralRecord,
  type ContactRoleRecord,
  type ContactTaskRecord,
  type ContactThreadRecord,
} from '@/lib/contact-runtime/contact-runtime'

const people: ContactPersonRecord[] = [
  {
    id: 'person-1',
    organizationId: 'org-tenant-1',
    sourcePatientLeadId: 'lead-1',
    sourceBdContactId: null,
    firstName: 'Ana',
    lastName: 'Lopez',
    preferredName: 'Ana',
    email: 'ana@example.com',
    phone: '555-1111',
    alternatePhone: null,
    language: 'en',
    notes: 'Recruitment lead',
    status: 'active',
    ownerUserId: 'user-1',
    backupOwnerUserId: null,
    createdAt: '2026-06-03T00:00:00Z',
    updatedAt: '2026-06-03T00:00:00Z',
  },
]

const organizations: ContactOrganizationRecord[] = [
  {
    id: 'contact-org-1',
    organizationId: 'org-tenant-1',
    sourceBdCompanyId: 'bd-company-1',
    organizationName: 'Acme Sponsor',
    organizationType: 'sponsor',
    website: 'https://acme.example',
    phone: '555-2222',
    email: 'bd@acme.example',
    address: '1 Sponsor Way',
    notes: 'Primary sponsor account',
    status: 'active',
    ownerUserId: 'user-2',
    backupOwnerUserId: null,
    createdAt: '2026-06-03T00:00:00Z',
    updatedAt: '2026-06-03T00:00:00Z',
  },
]

const roles: ContactRoleRecord[] = [
  { id: 'role-1', organizationId: 'org-tenant-1', personId: 'person-1', roleType: 'patient', active: true },
  { id: 'role-2', organizationId: 'org-tenant-1', personId: 'person-1', roleType: 'candidate', active: true },
]

const relationships: ContactRelationshipRecord[] = [
  {
    id: 'rel-1',
    organizationId: 'org-tenant-1',
    personId: 'person-1',
    contactOrganizationId: 'contact-org-1',
    relationshipType: 'referring physician',
    title: 'Dr.',
    startDate: '2026-01-01',
    endDate: null,
    active: true,
  },
]

const referrals: ContactReferralRecord[] = [
  {
    id: 'ref-1',
    organizationId: 'org-tenant-1',
    referringPersonId: 'person-1',
    referringOrganizationId: 'contact-org-1',
    receivingSiteId: 'tenant-site-1',
    active: true,
    notes: 'Initial referral',
    referralsGenerated: 2,
    enrollmentsGenerated: 1,
    randomizationsGenerated: 0,
  },
]

const tasks: ContactTaskRecord[] = [
  {
    id: 'task-1',
    title: 'Follow up Ana',
    nextStep: 'Call back this afternoon',
    dueAt: '2026-06-03T18:00:00Z',
    status: 'open',
    priority: 'high',
    notes: null,
    ownerUserId: 'user-1',
    personId: 'person-1',
    organizationId: null,
    sourceThreadId: 'thread-1',
    sourceMessageId: 'message-1',
    sourceKind: 'patient_followup',
  },
]

const threads: ContactThreadRecord[] = [
  {
    id: 'thread-1',
    threadKey: 'thread-key-1',
    subject: 'Recruitment follow-up',
    sensitivity: 'patient',
    reviewStatus: 'approved',
    lastMessageAt: '2026-06-03T15:00:00Z',
    lastMessageDirection: 'outbound',
    personId: 'person-1',
    organizationId: 'contact-org-1',
    sourcePatientLeadId: 'lead-1',
    sourceBdCompanyId: 'bd-company-1',
    sourceBdContactId: null,
    sourceBdOpportunityId: null,
    studyId: 'study-1',
    studySubjectId: null,
  },
]

const workspace = buildContactRuntimeWorkspace({
  people,
  organizations,
  roles,
  relationships,
  referrals,
  tasks,
  threads,
  q: 'ana',
  mode: 'people',
})

assert.equal(displayContactName(people[0]), 'Ana')
assert.equal(workspace.people.length, 1)
assert.equal(workspace.organizations.length, 0)
assert.equal(workspace.patientViewPeople.length, 1)
assert.equal(workspace.bdViewOrganizations.length, 1)
assert.equal(workspace.selectedPerson?.displayName, 'Ana')
assert.equal(workspace.selectedOrganization, null)
assert.ok(workspace.selectedPerson?.roles.includes('patient'))
assert.ok(workspace.selectedPerson?.communications.some((item) => item.kind === 'communication'))
assert.ok(workspace.selectedPerson?.tasks.some((item) => item.id === 'task-1'))
assert.ok(workspace.recentActivity.some((item) => item.kind === 'referral'))

const bdWorkspace = buildContactRuntimeWorkspace({
  people,
  organizations,
  roles,
  relationships,
  referrals,
  tasks,
  threads,
  q: 'acme',
  mode: 'business-development',
})

assert.equal(bdWorkspace.organizations.length, 1)
assert.equal(bdWorkspace.selectedOrganization?.displayName, 'Acme Sponsor')
assert.ok(bdWorkspace.selectedOrganization?.contacts.length === 1)
assert.ok(bdWorkspace.selectedOrganization?.communications.length === 1)
assert.ok(bdWorkspace.selectedOrganization?.referrals.length === 1)

console.log('contact-runtime-smoke: PASS')
