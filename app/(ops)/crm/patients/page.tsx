import Link from 'next/link'
import { redirect } from 'next/navigation'
import { Search, Plus, BadgeCheck, HeartPulse, StickyNote, CalendarClock } from 'lucide-react'
import { getOrganizationMemberships, getPrimaryOrganizationId, getSessionUser } from '@/lib/auth/session'
import { canAccessPatientCRM } from '@/lib/rbac/permissions'
import { createServerClient } from '@/lib/supabase/server'
import {
  addPatientFollowupAction,
  addPatientNavigationNoteAction,
  createPatientLeadAction,
  loadPatientCRMOverview,
  loadPatientLeadList,
  loadPatientLeadDetail,
  updatePatientLeadAction,
} from '@/lib/crm/patient-crm'
import { oneParam } from '@/lib/crm/forms'

function leadTone(stage: string) {
  switch (stage) {
    case 'screen_failed':
      return 'bg-red-50 text-red-700 border-red-200'
    case 'randomized':
      return 'bg-emerald-50 text-emerald-700 border-emerald-200'
    case 'consented':
    case 'scheduled':
      return 'bg-amber-50 text-amber-700 border-amber-200'
    default:
      return 'bg-slate-50 text-slate-600 border-slate-200'
  }
}

export default async function PatientCRMPage({
  searchParams,
}: {
  searchParams?: Promise<{ q?: string | string[]; stage?: string | string[]; lead?: string | string[]; action?: string | string[]; result?: string | string[]; reason?: string | string[] }>
}) {
  const user = await getSessionUser()
  if (!user) redirect('/login')

  const organizationId = await getPrimaryOrganizationId(user.id)
  if (!organizationId) {
    return (
      <div className="space-y-3 p-6">
        <h1 className="text-2xl font-semibold tracking-tight text-slate-900">Patient CRM</h1>
        <p className="text-sm text-slate-500">No active organization access is available.</p>
      </div>
    )
  }

  const memberships = await getOrganizationMemberships(user.id)
  if (!canAccessPatientCRM(memberships, organizationId)) {
    return (
      <div className="space-y-3 p-6">
        <h1 className="text-2xl font-semibold tracking-tight text-slate-900">Patient CRM</h1>
        <p className="text-sm text-slate-500">Access denied.</p>
      </div>
    )
  }

  const params = (await searchParams) ?? {}
  const q = oneParam(params.q)?.trim() ?? ''
  const stage = oneParam(params.stage)?.trim() ?? ''
  const selectedLeadId = oneParam(params.lead)?.trim() ?? ''
  const result = oneParam(params.result)
  const reason = oneParam(params.reason)

  const supabase = await createServerClient()
  const overview = await loadPatientCRMOverview(organizationId, supabase)
  const list = await loadPatientLeadList(organizationId, { q, stage, supabaseClient: supabase })
  const selectedLeadIdResolved = selectedLeadId || list.rows[0]?.id || null
  const detail = selectedLeadIdResolved
    ? await loadPatientLeadDetail(organizationId, selectedLeadIdResolved, supabase)
    : null

  return (
    <div className="space-y-6 p-6">
      <header className="max-w-3xl">
        <p className="text-xs font-semibold uppercase tracking-wide text-teal-700">CRM</p>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight text-slate-900">Patient CRM</h1>
        <p className="mt-2 text-sm text-slate-600">
          Keep recruitment separate from business development. Track permission, study fit,
          follow-ups, and navigation notes without mixing PHI into the BD pipeline.
        </p>
      </header>

      <section className="grid gap-4 md:grid-cols-4">
        <div className="rounded-md border border-slate-200 bg-white p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Leads</p>
          <p className="mt-2 text-2xl font-semibold text-slate-900">{overview.leadCount}</p>
        </div>
        <div className="rounded-md border border-slate-200 bg-white p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Open follow-ups</p>
          <p className="mt-2 text-2xl font-semibold text-slate-900">{overview.openFollowupCount}</p>
        </div>
        <div className="rounded-md border border-slate-200 bg-white p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Attributed</p>
          <p className="mt-2 text-2xl font-semibold text-slate-900">{overview.attributedLeadCount}</p>
        </div>
        <div className="rounded-md border border-slate-200 bg-white p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Missing permission</p>
          <p className="mt-2 text-2xl font-semibold text-slate-900">{overview.missingPermissionCount}</p>
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

      <div className="grid gap-4 xl:grid-cols-[1.2fr_0.9fr]">
        <section className="rounded-md border border-slate-200 bg-white p-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-sm font-semibold text-slate-900">Search and filter</h2>
              <p className="mt-1 text-sm text-slate-600">Search first, then open a lead.</p>
            </div>
            {selectedLeadIdResolved ? (
              <Link
                href={`/crm/patients?lead=${encodeURIComponent(selectedLeadIdResolved)}`}
                className="rounded-md border border-slate-300 px-3 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50"
              >
                Clear extra filters
              </Link>
            ) : null}
          </div>
          <form method="get" className="mt-4 grid gap-3 md:grid-cols-[1fr_180px_auto]">
            <label className="space-y-1 text-xs font-medium text-slate-600">
              Search
              <div className="flex items-center gap-2 rounded-md border border-slate-300 bg-white px-3">
                <Search className="h-4 w-4 text-slate-400" />
                <input name="q" defaultValue={q} className="h-10 w-full border-0 bg-transparent text-sm outline-none" placeholder="Name, source, condition, notes" />
              </div>
            </label>
            <label className="space-y-1 text-xs font-medium text-slate-600">
              Stage
              <select name="stage" defaultValue={stage} className="h-10 w-full rounded-md border border-slate-300 bg-white px-3 text-sm">
                <option value="">All stages</option>
                <option value="lead">Lead</option>
                <option value="contacted">Contacted</option>
                <option value="pre_screen">Pre-screen</option>
                <option value="qualified">Qualified</option>
                <option value="scheduled">Scheduled</option>
                <option value="consented">Consented</option>
                <option value="screened">Screened</option>
                <option value="randomized">Randomized</option>
                <option value="closed">Closed</option>
              </select>
            </label>
            <div className="flex items-end gap-2">
              <button type="submit" className="h-10 rounded-md bg-teal-700 px-4 text-sm font-semibold text-white hover:bg-teal-800">
                Apply
              </button>
              <Link href="/crm/patients" className="h-10 rounded-md border border-slate-300 px-4 pt-2 text-sm font-medium text-slate-700 hover:bg-slate-50">
                Reset
              </Link>
            </div>
          </form>

          <div className="mt-4 space-y-2">
            {list.rows.map((lead) => {
              const active = lead.id === selectedLeadIdResolved
              return (
                <Link
                  key={lead.id}
                  href={`/crm/patients?lead=${encodeURIComponent(lead.id)}${q ? `&q=${encodeURIComponent(q)}` : ''}${stage ? `&stage=${encodeURIComponent(stage)}` : ''}`}
                  className={`block rounded-md border p-3 transition-colors ${active ? 'border-teal-300 bg-teal-50' : 'border-slate-200 bg-white hover:bg-slate-50'}`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="font-medium text-slate-900">{lead.fullName}</h3>
                        <span className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${leadTone(lead.stage)}`}>{lead.stage}</span>
                      </div>
                      <div className="mt-1 text-xs text-slate-600">
                        {lead.studyName ? <span>{lead.studyName}</span> : <span>Unassigned study</span>}
                        {lead.recruitmentSource ? <span> · Source: {lead.recruitmentSource}</span> : null}
                        {lead.nextFollowUpAt ? <span> · Follow-up: {new Date(lead.nextFollowUpAt).toLocaleString()}</span> : null}
                      </div>
                    </div>
                    <span className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">{lead.contactPermission}</span>
                  </div>
                </Link>
              )
            })}
            {list.rows.length === 0 ? (
              <div className="rounded-md border border-dashed border-slate-300 p-6 text-sm text-slate-500">
                No patient leads match this filter.
              </div>
            ) : null}
          </div>
        </section>

        <section className="space-y-4">
          <div className="rounded-md border border-slate-200 bg-white p-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h2 className="text-sm font-semibold text-slate-900">Quick create</h2>
                <p className="mt-1 text-sm text-slate-600">Keep the form short. Add details later.</p>
              </div>
              <Plus className="h-4 w-4 text-teal-700" />
            </div>
            <form action={createPatientLeadAction} className="mt-4 grid gap-3">
              <input type="hidden" name="organizationId" value={organizationId} />
              <label className="space-y-1 text-xs font-medium text-slate-600">
                Full name
                <input name="fullName" className="h-10 w-full rounded-md border border-slate-300 px-3 text-sm" required />
              </label>
              <div className="grid gap-3 md:grid-cols-2">
                <label className="space-y-1 text-xs font-medium text-slate-600">
                  Study ID
                  <input name="studyId" className="h-10 w-full rounded-md border border-slate-300 px-3 text-sm" placeholder="Optional study UUID" />
                </label>
                <label className="space-y-1 text-xs font-medium text-slate-600">
                  Recruitment source
                  <input name="recruitmentSource" className="h-10 w-full rounded-md border border-slate-300 px-3 text-sm" placeholder="Website, Meta, referral..." />
                </label>
              </div>
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
              <div className="grid gap-3 md:grid-cols-2">
                <label className="space-y-1 text-xs font-medium text-slate-600">
                  Preferred contact
                  <select name="preferredContactMethod" className="h-10 w-full rounded-md border border-slate-300 bg-white px-3 text-sm" defaultValue="phone">
                    <option value="phone">Phone</option>
                    <option value="email">Email</option>
                    <option value="sms">SMS</option>
                    <option value="whatsapp">WhatsApp</option>
                    <option value="other">Other</option>
                  </select>
                </label>
                <label className="space-y-1 text-xs font-medium text-slate-600">
                  Contact permission
                  <select name="contactPermission" className="h-10 w-full rounded-md border border-slate-300 bg-white px-3 text-sm" defaultValue="unknown">
                    <option value="unknown">Unknown</option>
                    <option value="requested">Requested</option>
                    <option value="granted">Granted</option>
                    <option value="denied">Denied</option>
                    <option value="revoked">Revoked</option>
                  </select>
                </label>
              </div>
              <button type="submit" className="rounded-md bg-teal-700 px-4 py-2 text-sm font-semibold text-white hover:bg-teal-800">
                Save lead
              </button>
            </form>
          </div>

          {detail ? (
            <div className="space-y-4 rounded-md border border-slate-200 bg-white p-4">
              <div>
                <h2 className="text-sm font-semibold text-slate-900">Selected lead</h2>
                <p className="mt-1 text-sm text-slate-600">
                  {detail.lead?.fullName ?? 'No lead selected'}
                </p>
              </div>

              {detail.lead ? (
                <form action={updatePatientLeadAction} className="space-y-3 rounded-md border border-slate-200 bg-slate-50 p-3">
                  <input type="hidden" name="organizationId" value={organizationId} />
                  <input type="hidden" name="leadId" value={detail.lead.id} />
                  <div className="grid gap-3 md:grid-cols-2">
                    <label className="space-y-1 text-xs font-medium text-slate-600">
                      Full name
                      <input name="fullName" defaultValue={detail.lead.fullName} className="h-10 w-full rounded-md border border-slate-300 px-3 text-sm" required />
                    </label>
                    <label className="space-y-1 text-xs font-medium text-slate-600">
                      Stage
                      <select name="stage" defaultValue={detail.lead.stage} className="h-10 w-full rounded-md border border-slate-300 bg-white px-3 text-sm">
                        <option value="lead">Lead</option>
                        <option value="contacted">Contacted</option>
                        <option value="pre_screen">Pre-screen</option>
                        <option value="qualified">Qualified</option>
                        <option value="scheduled">Scheduled</option>
                        <option value="consented">Consented</option>
                        <option value="screened">Screened</option>
                        <option value="randomized">Randomized</option>
                        <option value="closed">Closed</option>
                      </select>
                    </label>
                  </div>
                  <div className="grid gap-3 md:grid-cols-2">
                    <label className="space-y-1 text-xs font-medium text-slate-600">
                      Recruitment source
                      <input name="recruitmentSource" defaultValue={detail.lead.recruitmentSource ?? ''} className="h-10 w-full rounded-md border border-slate-300 px-3 text-sm" />
                    </label>
                    <label className="space-y-1 text-xs font-medium text-slate-600">
                      Next follow-up
                      <input name="nextFollowUpAt" defaultValue={detail.lead.nextFollowUpAt ?? ''} className="h-10 w-full rounded-md border border-slate-300 px-3 text-sm" placeholder="ISO timestamp" />
                    </label>
                  </div>
                  <div className="grid gap-3 md:grid-cols-2">
                    <label className="space-y-1 text-xs font-medium text-slate-600">
                      Email
                      <input name="email" defaultValue={detail.lead.email ?? ''} className="h-10 w-full rounded-md border border-slate-300 px-3 text-sm" placeholder="Contact email" />
                    </label>
                    <label className="space-y-1 text-xs font-medium text-slate-600">
                      Phone
                      <input name="phone" defaultValue={detail.lead.phone ?? ''} className="h-10 w-full rounded-md border border-slate-300 px-3 text-sm" placeholder="Contact phone" />
                    </label>
                  </div>
                  <div className="grid gap-3 md:grid-cols-2">
                    <label className="space-y-1 text-xs font-medium text-slate-600">
                      Contact permission
                      <select name="contactPermission" defaultValue={detail.lead.contactPermission} className="h-10 w-full rounded-md border border-slate-300 bg-white px-3 text-sm">
                        <option value="unknown">Unknown</option>
                        <option value="requested">Requested</option>
                        <option value="granted">Granted</option>
                        <option value="denied">Denied</option>
                        <option value="revoked">Revoked</option>
                      </select>
                    </label>
                    <label className="space-y-1 text-xs font-medium text-slate-600">
                      Preferred contact
                      <select name="preferredContactMethod" defaultValue={detail.lead.preferredContactMethod} className="h-10 w-full rounded-md border border-slate-300 bg-white px-3 text-sm">
                        <option value="phone">Phone</option>
                        <option value="email">Email</option>
                        <option value="sms">SMS</option>
                        <option value="whatsapp">WhatsApp</option>
                        <option value="other">Other</option>
                      </select>
                    </label>
                  </div>
                  <label className="space-y-1 text-xs font-medium text-slate-600">
                    Condition / study fit
                    <textarea name="conditionSummary" defaultValue={detail.lead.conditionSummary ?? ''} className="min-h-20 w-full rounded-md border border-slate-300 px-3 py-2 text-sm" />
                  </label>
                  <label className="space-y-1 text-xs font-medium text-slate-600">
                    Notes
                    <textarea name="notes" defaultValue={detail.lead.notes ?? ''} className="min-h-20 w-full rounded-md border border-slate-300 px-3 py-2 text-sm" />
                  </label>
                  <button type="submit" className="rounded-md bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800">
                    Save changes
                  </button>
                </form>
              ) : null}

              <div className="grid gap-4 lg:grid-cols-2">
                <section className="rounded-md border border-slate-200 p-3">
                  <div className="flex items-center gap-2">
                    <BadgeCheck className="h-4 w-4 text-teal-700" />
                    <h3 className="text-sm font-semibold text-slate-900">Permission</h3>
                  </div>
                  <div className="mt-3 text-sm text-slate-700">
                    {detail.contactPermission ? (
                      <div className="space-y-1">
                        <div>Status: {detail.contactPermission.permissionStatus}</div>
                        <div>Channel: email {detail.contactPermission.allowEmail ? 'allowed' : 'blocked'}</div>
                        <div>Channel: phone {detail.contactPermission.allowPhone ? 'allowed' : 'blocked'}</div>
                        <div>Source: {detail.contactPermission.permissionSource ?? '—'}</div>
                      </div>
                    ) : (
                      <p className="text-slate-500">No permission record yet.</p>
                    )}
                  </div>
                </section>

                <section className="rounded-md border border-slate-200 p-3">
                  <div className="flex items-center gap-2">
                    <CalendarClock className="h-4 w-4 text-teal-700" />
                    <h3 className="text-sm font-semibold text-slate-900">Follow-ups</h3>
                  </div>
                  <div className="mt-3 space-y-2 text-sm">
                    {detail.followups.map((followup) => (
                      <div key={followup.id} className="rounded-md border border-slate-200 bg-slate-50 p-2">
                        <div className="font-medium text-slate-900">{followup.title}</div>
                        <div className="text-xs text-slate-600">{followup.status} · {followup.priority}</div>
                        {followup.dueAt ? <div className="text-xs text-slate-600">{followup.dueAt}</div> : null}
                      </div>
                    ))}
                    {detail.followups.length === 0 ? <p className="text-slate-500">No follow-ups yet.</p> : null}
                  </div>
                </section>

                <section className="rounded-md border border-slate-200 p-3">
                  <div className="flex items-center gap-2">
                    <HeartPulse className="h-4 w-4 text-teal-700" />
                    <h3 className="text-sm font-semibold text-slate-900">Conditions and matches</h3>
                  </div>
                  <div className="mt-3 space-y-2 text-sm">
                    {detail.conditions.map((condition) => (
                      <div key={condition.id} className="rounded-md border border-slate-200 bg-slate-50 p-2">
                        <div className="font-medium text-slate-900">{condition.conditionName}</div>
                        {condition.conditionType ? <div className="text-xs text-slate-600">{condition.conditionType}</div> : null}
                      </div>
                    ))}
                    {detail.studyMatches.map((match) => (
                      <div key={match.id} className="rounded-md border border-slate-200 bg-slate-50 p-2">
                        <div className="font-medium text-slate-900">{match.studyName ?? match.studyId}</div>
                        <div className="text-xs text-slate-600">{match.matchStatus} · score {match.matchScore.toFixed(1)}</div>
                      </div>
                    ))}
                    {detail.conditions.length === 0 && detail.studyMatches.length === 0 ? (
                      <p className="text-slate-500">No conditions or matches yet.</p>
                    ) : null}
                  </div>
                </section>

                <section className="rounded-md border border-slate-200 p-3">
                  <div className="flex items-center gap-2">
                    <StickyNote className="h-4 w-4 text-teal-700" />
                    <h3 className="text-sm font-semibold text-slate-900">Navigation notes</h3>
                  </div>
                  <div className="mt-3 space-y-2 text-sm">
                    {detail.navigationNotes.map((note) => (
                      <div key={note.id} className="rounded-md border border-slate-200 bg-slate-50 p-2">
                        <div className="text-slate-700">{note.note}</div>
                        <div className="text-xs text-slate-500">{note.noteKind}</div>
                      </div>
                    ))}
                    {detail.navigationNotes.length === 0 ? <p className="text-slate-500">No navigation notes yet.</p> : null}
                  </div>
                </section>
              </div>

              <div className="grid gap-4 lg:grid-cols-2">
                <form action={addPatientFollowupAction} className="rounded-md border border-slate-200 p-3 space-y-3">
                  <input type="hidden" name="organizationId" value={organizationId} />
                  <input type="hidden" name="patientLeadId" value={detail.lead?.id ?? ''} />
                  <h3 className="text-sm font-semibold text-slate-900">Add follow-up</h3>
                  <label className="space-y-1 text-xs font-medium text-slate-600">
                    Title
                    <input name="title" className="h-10 w-full rounded-md border border-slate-300 px-3 text-sm" />
                  </label>
                  <label className="space-y-1 text-xs font-medium text-slate-600">
                    Next step
                    <input name="nextStep" className="h-10 w-full rounded-md border border-slate-300 px-3 text-sm" />
                  </label>
                  <div className="grid gap-3 md:grid-cols-2">
                    <label className="space-y-1 text-xs font-medium text-slate-600">
                      Due at
                      <input name="dueAt" className="h-10 w-full rounded-md border border-slate-300 px-3 text-sm" placeholder="ISO timestamp" />
                    </label>
                    <label className="space-y-1 text-xs font-medium text-slate-600">
                      Priority
                      <select name="priority" className="h-10 w-full rounded-md border border-slate-300 bg-white px-3 text-sm" defaultValue="normal">
                        <option value="low">Low</option>
                        <option value="normal">Normal</option>
                        <option value="high">High</option>
                        <option value="urgent">Urgent</option>
                      </select>
                    </label>
                  </div>
                  <button type="submit" className="rounded-md bg-teal-700 px-3 py-2 text-sm font-semibold text-white hover:bg-teal-800">
                    Save follow-up
                  </button>
                </form>

                <form action={addPatientNavigationNoteAction} className="rounded-md border border-slate-200 p-3 space-y-3">
                  <input type="hidden" name="organizationId" value={organizationId} />
                  <input type="hidden" name="patientLeadId" value={detail.lead?.id ?? ''} />
                  <h3 className="text-sm font-semibold text-slate-900">Add navigation note</h3>
                  <label className="space-y-1 text-xs font-medium text-slate-600">
                    Note
                    <textarea name="note" className="min-h-24 w-full rounded-md border border-slate-300 px-3 py-2 text-sm" />
                  </label>
                  <button type="submit" className="rounded-md bg-slate-900 px-3 py-2 text-sm font-semibold text-white hover:bg-slate-800">
                    Save note
                  </button>
                </form>
              </div>
            </div>
          ) : (
            <div className="rounded-md border border-slate-200 bg-white p-6 text-sm text-slate-500">
              Select a patient lead to view detail and follow-up context.
            </div>
          )}
        </section>
      </div>
    </div>
  )
}
