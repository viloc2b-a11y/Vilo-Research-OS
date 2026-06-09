import Link from 'next/link'
import { redirect } from 'next/navigation'
import { Building2, Search, Users, Plus, MessageSquare, Workflow } from 'lucide-react'
import { getOrganizationMemberships, getPrimaryOrganizationId, getSessionUser } from '@/lib/auth/session'
import {
  canAccessBusinessDevelopmentCRM,
  canAccessCommunications,
  canAccessPatientCRM,
} from '@/lib/rbac/permissions'
import { createServerClient } from '@/lib/supabase/server'
import { oneParam } from '@/lib/crm/forms'
import {
  createContactOrganizationAction,
  createContactPersonAction,
  createContactRelationshipAction,
  createContactRoleAction,
  createReferralRelationshipAction,
  updateContactOrganizationAction,
  updateContactPersonAction,
} from '@/lib/contact-runtime/contact-runtime-actions'
import { loadContactRuntimeWorkspace, displayContactName } from '@/lib/contact-runtime/contact-runtime'

type Mode = 'people' | 'organizations' | 'patient' | 'business-development'

const CONTACT_MODES: Array<{ mode: Mode; label: string; description: string }> = [
  { mode: 'people', label: 'People', description: 'All people in the contact runtime.' },
  { mode: 'organizations', label: 'Organizations', description: 'All organizations and their contacts.' },
  { mode: 'patient', label: 'Patient CRM view', description: 'Patients, candidates, and subjects.' },
  { mode: 'business-development', label: 'Business Development view', description: 'Sponsors, CROs, labs, vendors, and partners.' },
]

function chipTone(active: boolean) {
  return active
    ? 'border-teal-200 bg-teal-50 text-teal-700'
    : 'border-slate-200 bg-white text-slate-600'
}

function activityLabel(kind: string) {
  switch (kind) {
    case 'communication':
      return 'Email'
    case 'task':
      return 'Task'
    case 'referral':
      return 'Referral'
    default:
      return 'Note'
  }
}

export default async function ContactsPage({
  searchParams,
}: {
  searchParams?: Promise<{
    q?: string | string[]
    mode?: string | string[]
    person?: string | string[]
    organization?: string | string[]
    result?: string | string[]
    reason?: string | string[]
  }>
}) {
  const user = await getSessionUser()
  if (!user) redirect('/login')

  const organizationId = await getPrimaryOrganizationId(user.id)
  if (!organizationId) {
    return (
      <div className="space-y-3 p-6">
        <h1 className="text-2xl font-semibold tracking-tight text-slate-900">Contacts</h1>
        <p className="text-sm text-slate-500">No active organization access is available.</p>
      </div>
    )
  }

  const memberships = await getOrganizationMemberships(user.id)
  const canAccessContacts =
    canAccessPatientCRM(memberships, organizationId)
    || canAccessBusinessDevelopmentCRM(memberships, organizationId)
    || canAccessCommunications(memberships, organizationId)

  if (!canAccessContacts) {
    return (
      <div className="space-y-3 p-6">
        <h1 className="text-2xl font-semibold tracking-tight text-slate-900">Contacts</h1>
        <p className="text-sm text-slate-500">Access denied.</p>
      </div>
    )
  }

  const params = (await searchParams) ?? {}
  const q = oneParam(params.q)?.trim() ?? ''
  const mode = (oneParam(params.mode)?.trim() as Mode) || 'people'
  const personId = oneParam(params.person)?.trim() ?? ''
  const organizationContactId = oneParam(params.organization)?.trim() ?? ''
  const result = oneParam(params.result)
  const reason = oneParam(params.reason)

  const supabase = await createServerClient()
  const workspace = await loadContactRuntimeWorkspace(organizationId, {
    q,
    mode,
    personId: personId || null,
    organizationId: organizationContactId || null,
    supabaseClient: supabase,
  })

  const peopleList = mode === 'patient' ? workspace.patientViewPeople : workspace.people
  const organizationList = mode === 'business-development' ? workspace.bdViewOrganizations : workspace.organizations
  const selectedPerson = workspace.selectedPerson
  const selectedOrganization = workspace.selectedOrganization

  return (
    <div className="space-y-6 p-6">
      <header className="max-w-3xl">
        <p className="text-xs font-semibold uppercase tracking-wide text-teal-700">Relationships</p>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight text-slate-900">Contact Runtime</h1>
        <p className="mt-2 text-sm text-slate-600">
          One runtime for people, organizations, communications, tasks, referrals, Patient CRM,
          and Business Development CRM. Search first, then open the profile you need.
        </p>
        <div className="mt-4 flex flex-wrap gap-2">
          {CONTACT_MODES.map((item) => {
            const active = item.mode === mode
            return (
              <Link
                key={item.mode}
                href={`/contacts?mode=${item.mode}${q ? `&q=${encodeURIComponent(q)}` : ''}`}
                className={`rounded-full border px-3 py-2 text-xs font-semibold transition-colors ${chipTone(active)}`}
              >
                {item.label}
              </Link>
            )
          })}
        </div>
      </header>

      <section className="grid gap-4 md:grid-cols-4">
        <div className="rounded-md border border-slate-200 bg-white p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">People</p>
          <p className="mt-2 text-2xl font-semibold text-slate-900">{workspace.people.length}</p>
        </div>
        <div className="rounded-md border border-slate-200 bg-white p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Organizations</p>
          <p className="mt-2 text-2xl font-semibold text-slate-900">{workspace.organizations.length}</p>
        </div>
        <div className="rounded-md border border-slate-200 bg-white p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Tasks</p>
          <p className="mt-2 text-2xl font-semibold text-slate-900">{workspace.tasks.length}</p>
        </div>
        <div className="rounded-md border border-slate-200 bg-white p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Activity</p>
          <p className="mt-2 text-2xl font-semibold text-slate-900">{workspace.recentActivity.length}</p>
        </div>
      </section>

      {(result || reason) ? (
        <div className={`rounded-md border px-4 py-3 text-sm ${result === 'error' ? 'border-red-200 bg-red-50 text-red-800' : 'border-teal-200 bg-teal-50 text-teal-800'}`}>
          <div className="font-medium">
            {result === 'error' ? 'Action needs attention' : 'Action complete'}
          </div>
          {reason ? <div className="mt-1 text-xs">{reason}</div> : null}
        </div>
      ) : null}

      <div className="grid gap-4 xl:grid-cols-[1.1fr_0.9fr]">
        <section className="rounded-md border border-slate-200 bg-white p-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-sm font-semibold text-slate-900">Search and filter</h2>
              <p className="mt-1 text-sm text-slate-600">
                Search by name, phone, email, organization, role, study, or owner.
              </p>
            </div>
          </div>
          <form method="get" className="mt-4 grid gap-3 md:grid-cols-[1fr_auto]">
            <label className="space-y-1 text-xs font-medium text-slate-600">
              Search
              <div className="flex items-center gap-2 rounded-md border border-slate-300 bg-white px-3">
                <Search className="h-4 w-4 text-slate-400" />
                <input
                  name="q"
                  defaultValue={q}
                  className="h-10 w-full border-0 bg-transparent text-sm outline-none"
                  placeholder="Name, phone, email, org, role, study..."
                />
              </div>
            </label>
            <div className="flex items-end gap-2">
              <input type="hidden" name="mode" value={mode} />
              <button type="submit" className="h-10 rounded-md bg-teal-700 px-4 text-sm font-semibold text-white hover:bg-teal-800">
                Apply
              </button>
              <Link href="/contacts" className="h-10 rounded-md border border-slate-300 px-4 pt-2 text-sm font-medium text-slate-700 hover:bg-slate-50">
                Reset
              </Link>
            </div>
          </form>

          <div className="mt-4 space-y-3">
            {mode === 'organizations' || mode === 'business-development' ? (
              <>
                {organizationList.map((organization) => {
                  const active = organization.id === (organizationContactId || selectedOrganization?.id)
                  return (
                    <Link
                      key={organization.id}
                      href={`/contacts?mode=${mode}&organization=${encodeURIComponent(organization.id)}${q ? `&q=${encodeURIComponent(q)}` : ''}`}
                      className={`block rounded-md border p-3 transition-colors ${active ? 'border-teal-300 bg-teal-50' : 'border-slate-200 bg-white hover:bg-slate-50'}`}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <div className="flex flex-wrap items-center gap-2">
                            <h3 className="font-medium text-slate-900">{organization.organizationName}</h3>
                            <span className="rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-slate-600">
                              {organization.organizationType}
                            </span>
                          </div>
                          <div className="mt-1 text-xs text-slate-600">
                            {organization.website ? <span>{organization.website}</span> : <span>No website</span>}
                          </div>
                        </div>
                        <span className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">{organization.status}</span>
                      </div>
                    </Link>
                  )
                })}
                {organizationList.length === 0 ? (
                  <div className="rounded-md border border-dashed border-slate-300 p-6 text-sm text-slate-500">No organizations match this filter.</div>
                ) : null}
              </>
            ) : (
              <>
                {peopleList.map((person) => {
                  const active = person.id === (personId || selectedPerson?.id)
                  return (
                    <Link
                      key={person.id}
                      href={`/contacts?mode=${mode}&person=${encodeURIComponent(person.id)}${q ? `&q=${encodeURIComponent(q)}` : ''}`}
                      className={`block rounded-md border p-3 transition-colors ${active ? 'border-teal-300 bg-teal-50' : 'border-slate-200 bg-white hover:bg-slate-50'}`}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <div className="flex flex-wrap items-center gap-2">
                            <h3 className="font-medium text-slate-900">{displayContactName(person)}</h3>
                            <span className="rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-slate-600">
                              {person.status}
                            </span>
                          </div>
                          <div className="mt-1 text-xs text-slate-600">
                            {person.email ? <span>{person.email}</span> : <span>No email</span>}
                            {person.phone ? <span> · {person.phone}</span> : null}
                          </div>
                        </div>
                        <span className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">
                          {(workspace.roles.filter((role) => role.personId === person.id && role.active).map((role) => role.roleType).join(', ') || 'no role')}
                        </span>
                      </div>
                    </Link>
                  )
                })}
                {peopleList.length === 0 ? (
                  <div className="rounded-md border border-dashed border-slate-300 p-6 text-sm text-slate-500">No people match this filter.</div>
                ) : null}
              </>
            )}
          </div>
        </section>

        <section className="space-y-4">
          {selectedPerson ? (
            <div className="space-y-4 rounded-md border border-slate-200 bg-white p-4">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <h2 className="text-sm font-semibold text-slate-900">Person profile</h2>
                  <p className="mt-1 text-sm text-slate-600">{selectedPerson.displayName}</p>
                </div>
                <Users className="h-4 w-4 text-teal-700" />
              </div>

              <form action={updateContactPersonAction} className="space-y-3 rounded-md border border-slate-200 bg-slate-50 p-3">
                <input type="hidden" name="organizationId" value={organizationId} />
                <input type="hidden" name="personId" value={selectedPerson.id} />
                <div className="grid gap-3 md:grid-cols-2">
                  <label className="space-y-1 text-xs font-medium text-slate-600">
                    Full name
                    <input name="fullName" defaultValue={selectedPerson.displayName} className="h-10 w-full rounded-md border border-slate-300 px-3 text-sm" />
                  </label>
                  <label className="space-y-1 text-xs font-medium text-slate-600">
                    Status
                    <select name="status" defaultValue={selectedPerson.status} className="h-10 w-full rounded-md border border-slate-300 bg-white px-3 text-sm">
                      <option value="active">Active</option>
                      <option value="inactive">Inactive</option>
                      <option value="archived">Archived</option>
                    </select>
                  </label>
                </div>
                <div className="grid gap-3 md:grid-cols-2">
                  <label className="space-y-1 text-xs font-medium text-slate-600">
                    Email
                    <input name="email" defaultValue={selectedPerson.email ?? ''} className="h-10 w-full rounded-md border border-slate-300 px-3 text-sm" />
                  </label>
                  <label className="space-y-1 text-xs font-medium text-slate-600">
                    Phone
                    <input name="phone" defaultValue={selectedPerson.phone ?? ''} className="h-10 w-full rounded-md border border-slate-300 px-3 text-sm" />
                  </label>
                </div>
                <label className="space-y-1 text-xs font-medium text-slate-600">
                  Notes
                  <textarea name="notes" defaultValue={selectedPerson.notes ?? ''} className="min-h-20 w-full rounded-md border border-slate-300 px-3 py-2 text-sm" />
                </label>
                <button type="submit" className="rounded-md bg-teal-700 px-4 py-2 text-sm font-semibold text-white hover:bg-teal-800">
                  Save person
                </button>
              </form>

              <div className="grid gap-4 lg:grid-cols-2">
                <section className="rounded-md border border-slate-200 p-3">
                  <h3 className="text-sm font-semibold text-slate-900">Identity and roles</h3>
                  <div className="mt-3 space-y-2 text-sm text-slate-700">
                    <div>Preferred name: {selectedPerson.preferredName ?? '—'}</div>
                    <div>Status: {selectedPerson.status}</div>
                    <div>Roles: {selectedPerson.roles.length > 0 ? selectedPerson.roles.join(', ') : 'No roles yet'}</div>
                  </div>
                </section>

                <section className="rounded-md border border-slate-200 p-3">
                  <h3 className="text-sm font-semibold text-slate-900">Organizations</h3>
                  <div className="mt-3 space-y-2 text-sm">
                    {selectedPerson.organizations.map((org) => (
                      <div key={org.id} className="rounded-md border border-slate-200 bg-slate-50 p-2">
                        <div className="font-medium text-slate-900">{org.name}</div>
                        <div className="text-xs text-slate-600">{org.relationshipType}{org.title ? ` · ${org.title}` : ''}</div>
                      </div>
                    ))}
                    {selectedPerson.organizations.length === 0 ? <p className="text-slate-500">No organizations linked.</p> : null}
                  </div>
                </section>

                <section className="rounded-md border border-slate-200 p-3">
                  <h3 className="text-sm font-semibold text-slate-900">Communication timeline</h3>
                  <div className="mt-3 space-y-2 text-sm">
                    {selectedPerson.communications.map((item) => (
                      <div key={item.id} className="rounded-md border border-slate-200 bg-slate-50 p-2">
                        <div className="flex items-center justify-between gap-3">
                          <div className="font-medium text-slate-900">{activityLabel(item.kind)} · {item.subject ?? 'Untitled'}</div>
                          <span className="text-[10px] uppercase tracking-wide text-slate-500">{item.direction}</span>
                        </div>
                        {item.summary ? <div className="mt-1 text-xs text-slate-600">{item.summary}</div> : null}
                      </div>
                    ))}
                    {selectedPerson.communications.length === 0 ? <p className="text-slate-500">No timeline items yet.</p> : null}
                  </div>
                </section>

                <section className="rounded-md border border-slate-200 p-3">
                  <h3 className="text-sm font-semibold text-slate-900">Tasks</h3>
                  <div className="mt-3 space-y-2 text-sm">
                    {selectedPerson.tasks.map((task) => (
                      <div key={task.id} className="rounded-md border border-slate-200 bg-slate-50 p-2">
                        <div className="font-medium text-slate-900">{task.title}</div>
                        <div className="text-xs text-slate-600">{task.status} · {task.priority}</div>
                      </div>
                    ))}
                    {selectedPerson.tasks.length === 0 ? <p className="text-slate-500">No tasks yet.</p> : null}
                  </div>
                </section>
              </div>

              <div className="grid gap-4 lg:grid-cols-2">
                <form action={createContactRoleAction} className="rounded-md border border-slate-200 p-3 space-y-3">
                  <input type="hidden" name="organizationId" value={organizationId} />
                  <input type="hidden" name="personId" value={selectedPerson.id} />
                  <h3 className="text-sm font-semibold text-slate-900">Add role</h3>
                  <label className="space-y-1 text-xs font-medium text-slate-600">
                    Role type
                    <select name="roleType" defaultValue="coordinator" className="h-10 w-full rounded-md border border-slate-300 bg-white px-3 text-sm">
                      <option value="patient">Patient</option>
                      <option value="candidate">Candidate</option>
                      <option value="subject">Subject</option>
                      <option value="physician">Physician</option>
                      <option value="investigator">Investigator</option>
                      <option value="sponsor_contact">Sponsor contact</option>
                      <option value="cro_contact">CRO contact</option>
                      <option value="vendor_contact">Vendor contact</option>
                      <option value="laboratory_contact">Laboratory contact</option>
                      <option value="referral_partner">Referral partner</option>
                      <option value="community_partner">Community partner</option>
                      <option value="employee">Employee</option>
                      <option value="coordinator">Coordinator</option>
                    </select>
                  </label>
                  <button type="submit" className="rounded-md bg-teal-700 px-3 py-2 text-sm font-semibold text-white hover:bg-teal-800">
                    Save role
                  </button>
                </form>

                <form action={createContactRelationshipAction} className="rounded-md border border-slate-200 p-3 space-y-3">
                  <input type="hidden" name="organizationId" value={organizationId} />
                  <input type="hidden" name="personId" value={selectedPerson.id} />
                  <h3 className="text-sm font-semibold text-slate-900">Add relationship</h3>
                  <label className="space-y-1 text-xs font-medium text-slate-600">
                    Organization
                    <select name="contactOrganizationId" defaultValue={selectedPerson.organizations[0]?.id ?? ''} className="h-10 w-full rounded-md border border-slate-300 bg-white px-3 text-sm">
                      <option value="">Select organization</option>
                      {workspace.organizations.map((org) => (
                        <option key={org.id} value={org.id}>{org.organizationName}</option>
                      ))}
                    </select>
                  </label>
                  <label className="space-y-1 text-xs font-medium text-slate-600">
                    Relationship type
                    <input name="relationshipType" className="h-10 w-full rounded-md border border-slate-300 px-3 text-sm" placeholder="Sponsor PM, CRA, referring physician..." />
                  </label>
                  <button type="submit" className="rounded-md bg-slate-900 px-3 py-2 text-sm font-semibold text-white hover:bg-slate-800">
                    Save relationship
                  </button>
                </form>
              </div>
            </div>
          ) : selectedOrganization ? (
            <div className="space-y-4 rounded-md border border-slate-200 bg-white p-4">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <h2 className="text-sm font-semibold text-slate-900">Organization profile</h2>
                  <p className="mt-1 text-sm text-slate-600">{selectedOrganization.displayName}</p>
                </div>
                <Building2 className="h-4 w-4 text-teal-700" />
              </div>

              <form action={updateContactOrganizationAction} className="space-y-3 rounded-md border border-slate-200 bg-slate-50 p-3">
                <input type="hidden" name="organizationId" value={organizationId} />
                <input type="hidden" name="contactOrganizationId" value={selectedOrganization.id} />
                <div className="grid gap-3 md:grid-cols-2">
                  <label className="space-y-1 text-xs font-medium text-slate-600">
                    Organization name
                    <input name="organizationName" defaultValue={selectedOrganization.organizationName} className="h-10 w-full rounded-md border border-slate-300 px-3 text-sm" />
                  </label>
                  <label className="space-y-1 text-xs font-medium text-slate-600">
                    Status
                    <select name="status" defaultValue={selectedOrganization.status} className="h-10 w-full rounded-md border border-slate-300 bg-white px-3 text-sm">
                      <option value="active">Active</option>
                      <option value="paused">Paused</option>
                      <option value="archived">Archived</option>
                    </select>
                  </label>
                </div>
                <div className="grid gap-3 md:grid-cols-2">
                  <label className="space-y-1 text-xs font-medium text-slate-600">
                    Type
                    <select name="organizationType" defaultValue={selectedOrganization.organizationType} className="h-10 w-full rounded-md border border-slate-300 bg-white px-3 text-sm">
                      <option value="sponsor">Sponsor</option>
                      <option value="cro">CRO</option>
                      <option value="lab">Lab</option>
                      <option value="biobank">Biobank</option>
                      <option value="vendor">Vendor</option>
                      <option value="physician_network">Physician network</option>
                      <option value="community_partner">Community partner</option>
                      <option value="other">Other</option>
                    </select>
                  </label>
                  <label className="space-y-1 text-xs font-medium text-slate-600">
                    Website
                    <input name="website" defaultValue={selectedOrganization.website ?? ''} className="h-10 w-full rounded-md border border-slate-300 px-3 text-sm" />
                  </label>
                </div>
                <label className="space-y-1 text-xs font-medium text-slate-600">
                  Notes
                  <textarea name="notes" defaultValue={selectedOrganization.notes ?? ''} className="min-h-20 w-full rounded-md border border-slate-300 px-3 py-2 text-sm" />
                </label>
                <button type="submit" className="rounded-md bg-teal-700 px-4 py-2 text-sm font-semibold text-white hover:bg-teal-800">
                  Save organization
                </button>
              </form>

              <div className="grid gap-4 lg:grid-cols-2">
                <section className="rounded-md border border-slate-200 p-3">
                  <h3 className="text-sm font-semibold text-slate-900">Contacts</h3>
                  <div className="mt-3 space-y-2 text-sm">
                    {selectedOrganization.contacts.map((contact) => (
                      <div key={contact.id} className="rounded-md border border-slate-200 bg-slate-50 p-2">
                        <div className="font-medium text-slate-900">{contact.displayName}</div>
                        <div className="text-xs text-slate-600">{contact.relationshipType}{contact.title ? ` · ${contact.title}` : ''}</div>
                      </div>
                    ))}
                    {selectedOrganization.contacts.length === 0 ? <p className="text-slate-500">No contacts yet.</p> : null}
                  </div>
                </section>

                <section className="rounded-md border border-slate-200 p-3">
                  <h3 className="text-sm font-semibold text-slate-900">Communication timeline</h3>
                  <div className="mt-3 space-y-2 text-sm">
                    {selectedOrganization.communications.map((item) => (
                      <div key={item.id} className="rounded-md border border-slate-200 bg-slate-50 p-2">
                        <div className="flex items-center justify-between gap-3">
                          <div className="font-medium text-slate-900">{activityLabel(item.kind)} · {item.subject ?? 'Untitled'}</div>
                          <span className="text-[10px] uppercase tracking-wide text-slate-500">{item.direction}</span>
                        </div>
                        {item.summary ? <div className="mt-1 text-xs text-slate-600">{item.summary}</div> : null}
                      </div>
                    ))}
                    {selectedOrganization.communications.length === 0 ? <p className="text-slate-500">No timeline items yet.</p> : null}
                  </div>
                </section>

                <section className="rounded-md border border-slate-200 p-3">
                  <h3 className="text-sm font-semibold text-slate-900">Tasks</h3>
                  <div className="mt-3 space-y-2 text-sm">
                    {selectedOrganization.tasks.map((task) => (
                      <div key={task.id} className="rounded-md border border-slate-200 bg-slate-50 p-2">
                        <div className="font-medium text-slate-900">{task.title}</div>
                        <div className="text-xs text-slate-600">{task.status} · {task.priority}</div>
                      </div>
                    ))}
                    {selectedOrganization.tasks.length === 0 ? <p className="text-slate-500">No tasks yet.</p> : null}
                  </div>
                </section>

                <section className="rounded-md border border-slate-200 p-3">
                  <h3 className="text-sm font-semibold text-slate-900">Partnership activity</h3>
                  <div className="mt-3 space-y-2 text-sm">
                    {selectedOrganization.referrals.map((referral) => (
                      <div key={referral.id} className="rounded-md border border-slate-200 bg-slate-50 p-2">
                        <div className="font-medium text-slate-900">Referral relationship</div>
                        <div className="text-xs text-slate-600">
                          {referral.referralsGenerated} referrals · {referral.enrollmentsGenerated} enrollments · {referral.randomizationsGenerated} randomizations
                        </div>
                      </div>
                    ))}
                    {selectedOrganization.referrals.length === 0 ? <p className="text-slate-500">No referral activity yet.</p> : null}
                  </div>
                </section>
              </div>
            </div>
          ) : (
            <div className="rounded-md border border-slate-200 bg-white p-6 text-sm text-slate-500">
              Select a person or organization to view the unified contact profile.
            </div>
          )}

          <div className="grid gap-4 lg:grid-cols-2">
            <div className="rounded-md border border-slate-200 bg-white p-4">
              <div className="flex items-center gap-2">
                <Plus className="h-4 w-4 text-teal-700" />
                <h2 className="text-sm font-semibold text-slate-900">Quick create person</h2>
              </div>
              <form action={createContactPersonAction} className="mt-4 grid gap-3">
                <input type="hidden" name="organizationId" value={organizationId} />
                <label className="space-y-1 text-xs font-medium text-slate-600">
                  Full name
                  <input name="fullName" className="h-10 w-full rounded-md border border-slate-300 px-3 text-sm" required />
                </label>
                <div className="grid gap-3 md:grid-cols-2">
                  <label className="space-y-1 text-xs font-medium text-slate-600">
                    Email
                    <input name="email" className="h-10 w-full rounded-md border border-slate-300 px-3 text-sm" />
                  </label>
                  <label className="space-y-1 text-xs font-medium text-slate-600">
                    Phone
                    <input name="phone" className="h-10 w-full rounded-md border border-slate-300 px-3 text-sm" />
                  </label>
                </div>
                <button type="submit" className="rounded-md bg-teal-700 px-4 py-2 text-sm font-semibold text-white hover:bg-teal-800">
                  Save person
                </button>
              </form>
            </div>

            <div className="rounded-md border border-slate-200 bg-white p-4">
              <div className="flex items-center gap-2">
                <Building2 className="h-4 w-4 text-teal-700" />
                <h2 className="text-sm font-semibold text-slate-900">Quick create organization</h2>
              </div>
              <form action={createContactOrganizationAction} className="mt-4 grid gap-3">
                <input type="hidden" name="organizationId" value={organizationId} />
                <label className="space-y-1 text-xs font-medium text-slate-600">
                  Organization name
                  <input name="organizationName" className="h-10 w-full rounded-md border border-slate-300 px-3 text-sm" required />
                </label>
                <label className="space-y-1 text-xs font-medium text-slate-600">
                  Type
                  <select name="organizationType" className="h-10 w-full rounded-md border border-slate-300 bg-white px-3 text-sm" defaultValue="other">
                    <option value="sponsor">Sponsor</option>
                    <option value="cro">CRO</option>
                    <option value="lab">Lab</option>
                    <option value="biobank">Biobank</option>
                    <option value="vendor">Vendor</option>
                    <option value="physician_network">Physician network</option>
                    <option value="community_partner">Community partner</option>
                    <option value="other">Other</option>
                  </select>
                </label>
                <button type="submit" className="rounded-md bg-teal-700 px-4 py-2 text-sm font-semibold text-white hover:bg-teal-800">
                  Save organization
                </button>
              </form>
            </div>
          </div>

          <div className="rounded-md border border-slate-200 bg-white p-4">
            <div className="flex items-center gap-2">
              <MessageSquare className="h-4 w-4 text-teal-700" />
              <h2 className="text-sm font-semibold text-slate-900">Recent activity</h2>
            </div>
            <div className="mt-4 grid gap-2">
              {workspace.recentActivity.slice(0, 8).map((item) => (
                <div key={item.id} className="rounded-md border border-slate-200 bg-slate-50 p-3">
                  <div className="flex items-center justify-between gap-3">
                    <div className="font-medium text-slate-900">{activityLabel(item.kind)} · {item.subject ?? 'Untitled'}</div>
                    <span className="text-[10px] uppercase tracking-wide text-slate-500">{item.direction}</span>
                  </div>
                  {item.summary ? <div className="mt-1 text-xs text-slate-600">{item.summary}</div> : null}
                </div>
              ))}
              {workspace.recentActivity.length === 0 ? (
                <p className="text-sm text-slate-500">No recent activity yet.</p>
              ) : null}
            </div>
          </div>

          <div className="rounded-md border border-slate-200 bg-white p-4">
            <div className="flex items-center gap-2">
              <Workflow className="h-4 w-4 text-teal-700" />
              <h2 className="text-sm font-semibold text-slate-900">Referral relationship</h2>
            </div>
            <form action={createReferralRelationshipAction} className="mt-4 grid gap-3">
              <input type="hidden" name="organizationId" value={organizationId} />
              <label className="space-y-1 text-xs font-medium text-slate-600">
                Receiving site
                <input name="receivingSiteId" defaultValue={organizationId} className="h-10 w-full rounded-md border border-slate-300 px-3 text-sm" />
              </label>
              <div className="grid gap-3 md:grid-cols-2">
                <label className="space-y-1 text-xs font-medium text-slate-600">
                  Referring person ID
                  <input name="referringPersonId" defaultValue={selectedPerson?.id ?? ''} className="h-10 w-full rounded-md border border-slate-300 px-3 text-sm" />
                </label>
                <label className="space-y-1 text-xs font-medium text-slate-600">
                  Referring organization ID
                  <input name="referringOrganizationId" defaultValue={selectedOrganization?.id ?? ''} className="h-10 w-full rounded-md border border-slate-300 px-3 text-sm" />
                </label>
              </div>
              <label className="space-y-1 text-xs font-medium text-slate-600">
                Notes
                <textarea name="notes" className="min-h-20 w-full rounded-md border border-slate-300 px-3 py-2 text-sm" />
              </label>
              <button type="submit" className="rounded-md bg-teal-700 px-4 py-2 text-sm font-semibold text-white hover:bg-teal-800">
                Save referral
              </button>
            </form>
          </div>
        </section>
      </div>
    </div>
  )
}
