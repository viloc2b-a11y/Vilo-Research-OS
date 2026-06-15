import Link from 'next/link'
import { redirect } from 'next/navigation'
import { Search, Plus, BriefcaseBusiness, PhoneCall, MessageSquare, Users, GitBranch } from 'lucide-react'
import { getOrganizationMemberships, getPrimaryOrganizationId, getSessionUser } from '@/lib/auth/session'
import { canAccessBusinessDevelopmentCRM } from '@/lib/rbac/permissions'
import { createServerClient } from '@/lib/supabase/server'
import {
  createBDCompanyAction,
  createBDContactAction,
  createBDInteractionAction,
  createBDOpportunityAction,
  createBDTaskAction,
  loadBDCompanyDetail,
  loadBDCompanyList,
  loadBDOverview,
  updateBDCompanyAction,
} from '@/lib/crm/business-development-crm'
import { loadOpportunityStatusHistory, type BdOpportunityStatusHistoryRow } from '@/lib/crm/bd-opportunity-status-history'
import { oneParam } from '@/lib/crm/forms'

const COMPANY_TYPES = [
  'sponsor',
  'cro',
  'lab',
  'biobank',
  'vendor',
  'physician_network',
  'community_partner',
  'other',
] as const

const OPPORTUNITY_STAGES = [
  'lead',
  'contacted',
  'feasibility_sent',
  'selected',
  'contracting',
  'active',
  'won',
  'lost',
  'paused',
] as const

export default async function BusinessDevelopmentCRMPage({
  searchParams,
}: {
  searchParams?: Promise<{ q?: string | string[]; type?: string | string[]; company?: string | string[]; result?: string | string[]; reason?: string | string[] }>
}) {
  const user = await getSessionUser()
  if (!user) redirect('/login')

  const organizationId = await getPrimaryOrganizationId(user.id)
  if (!organizationId) {
    return (
      <div className="space-y-3 p-6">
        <h1 className="text-2xl font-semibold tracking-tight text-slate-900">Business Development CRM</h1>
        <p className="text-sm text-slate-500">No active organization access is available.</p>
      </div>
    )
  }

  const memberships = await getOrganizationMemberships(user.id)
  if (!canAccessBusinessDevelopmentCRM(memberships, organizationId)) {
    return (
      <div className="space-y-3 p-6">
        <h1 className="text-2xl font-semibold tracking-tight text-slate-900">Business Development CRM</h1>
        <p className="text-sm text-slate-500">Access denied.</p>
      </div>
    )
  }

  const params = (await searchParams) ?? {}
  const q = oneParam(params.q)?.trim() ?? ''
  const type = oneParam(params.type)?.trim() ?? ''
  const selectedCompanyId = oneParam(params.company)?.trim() ?? ''
  const result = oneParam(params.result)
  const reason = oneParam(params.reason)

  const supabase = await createServerClient()
  const overview = await loadBDOverview(organizationId, supabase)
  const list = await loadBDCompanyList(organizationId, { q, type, supabaseClient: supabase })
  const selectedCompanyIdResolved = selectedCompanyId || list.rows[0]?.id || null
  const detail = selectedCompanyIdResolved
    ? await loadBDCompanyDetail(organizationId, selectedCompanyIdResolved, supabase)
    : null

  const opportunityHistoryMap = new Map<string, BdOpportunityStatusHistoryRow[]>()
  if (detail?.opportunities.length) {
    const histories = await Promise.all(
      detail.opportunities.map((opp) =>
        loadOpportunityStatusHistory(supabase, organizationId, opp.id),
      ),
    )
    detail.opportunities.forEach((opp, i) => {
      opportunityHistoryMap.set(opp.id, histories[i])
    })
  }

  return (
    <div className="space-y-6 p-6">
      <header className="max-w-3xl">
        <p className="text-xs font-semibold uppercase tracking-wide text-teal-700">CRM</p>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight text-slate-900">Business Development CRM</h1>
        <p className="mt-2 text-sm text-slate-600">
          Track sponsors, CROs, labs, biobanks, vendors, physician networks, opportunities, CTA,
          budgets, interactions, and next actions. Keep this pipeline separate from patient CRM.
        </p>
      </header>

      <section className="grid gap-4 md:grid-cols-4">
        <div className="rounded-md border border-slate-200 bg-white p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Companies</p>
          <p className="mt-2 text-2xl font-semibold text-slate-900">{overview.companyCount}</p>
        </div>
        <div className="rounded-md border border-slate-200 bg-white p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Opportunities</p>
          <p className="mt-2 text-2xl font-semibold text-slate-900">{overview.opportunityCount}</p>
        </div>
        <div className="rounded-md border border-slate-200 bg-white p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Active</p>
          <p className="mt-2 text-2xl font-semibold text-slate-900">{overview.activeOpportunityCount}</p>
        </div>
        <div className="rounded-md border border-slate-200 bg-white p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Open tasks</p>
          <p className="mt-2 text-2xl font-semibold text-slate-900">{overview.openTaskCount}</p>
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
              <p className="mt-1 text-sm text-slate-600">Search companies by name, contact, or notes.</p>
            </div>
            {selectedCompanyIdResolved ? (
              <Link
                href={`/crm/business-development?company=${encodeURIComponent(selectedCompanyIdResolved)}`}
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
                <input name="q" defaultValue={q} className="h-10 w-full border-0 bg-transparent text-sm outline-none" placeholder="Sponsor, CRO, lab, notes..." />
              </div>
            </label>
            <label className="space-y-1 text-xs font-medium text-slate-600">
              Company type
              <select name="type" defaultValue={type} className="h-10 w-full rounded-md border border-slate-300 bg-white px-3 text-sm">
                <option value="">All types</option>
                {COMPANY_TYPES.map((companyType) => (
                  <option key={companyType} value={companyType}>{companyType}</option>
                ))}
              </select>
            </label>
            <div className="flex items-end gap-2">
              <button type="submit" className="h-10 rounded-md bg-sky-700 px-4 text-sm font-semibold text-white hover:bg-sky-800">
                Apply
              </button>
              <Link href="/crm/business-development" className="h-10 rounded-md border border-slate-300 px-4 pt-2 text-sm font-medium text-slate-700 hover:bg-slate-50">
                Reset
              </Link>
            </div>
          </form>

          <div className="mt-4 space-y-2">
            {list.rows.map((company) => {
              const active = company.id === selectedCompanyIdResolved
              return (
                <Link
                  key={company.id}
                  href={`/crm/business-development?company=${encodeURIComponent(company.id)}${q ? `&q=${encodeURIComponent(q)}` : ''}${type ? `&type=${encodeURIComponent(type)}` : ''}`}
                  className={`block rounded-md border p-3 transition-colors ${active ? 'border-sky-300 bg-sky-50' : 'border-slate-200 bg-white hover:bg-slate-50'}`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="font-medium text-slate-900">{company.name}</h3>
                        <span className="rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-slate-600">{company.companyType}</span>
                      </div>
                      <div className="mt-1 text-xs text-slate-600">
                        {company.primaryContactName ? <span>{company.primaryContactName}</span> : <span>No primary contact</span>}
                        {company.website ? <span> · {company.website}</span> : null}
                      </div>
                    </div>
                    <span className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">{company.status}</span>
                  </div>
                </Link>
              )
            })}
            {list.rows.length === 0 ? (
              <div className="rounded-md border border-dashed border-slate-300 p-6 text-sm text-slate-500">
                No companies match this filter.
              </div>
            ) : null}
          </div>
        </section>

        <section className="space-y-4">
          <div className="rounded-md border border-slate-200 bg-white p-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h2 className="text-sm font-semibold text-slate-900">Quick create</h2>
                <p className="mt-1 text-sm text-slate-600">Add a company first, then attach opportunities and tasks.</p>
              </div>
              <Plus className="h-4 w-4 text-sky-700" />
            </div>
            <form action={createBDCompanyAction} className="mt-4 grid gap-3">
              <input type="hidden" name="organizationId" value={organizationId} />
              <label className="space-y-1 text-xs font-medium text-slate-600">
                Company name
                <input name="name" className="h-10 w-full rounded-md border border-slate-300 px-3 text-sm" required />
              </label>
              <div className="grid gap-3 md:grid-cols-2">
                <label className="space-y-1 text-xs font-medium text-slate-600">
                  Company type
                  <select name="companyType" className="h-10 w-full rounded-md border border-slate-300 bg-white px-3 text-sm" defaultValue="other">
                    {COMPANY_TYPES.map((companyType) => (
                      <option key={companyType} value={companyType}>{companyType}</option>
                    ))}
                  </select>
                </label>
                <label className="space-y-1 text-xs font-medium text-slate-600">
                  Website
                  <input name="website" className="h-10 w-full rounded-md border border-slate-300 px-3 text-sm" />
                </label>
              </div>
              <button type="submit" className="rounded-md bg-sky-700 px-4 py-2 text-sm font-semibold text-white hover:bg-sky-800">
                Save company
              </button>
            </form>
          </div>

          {detail ? (
            <div className="space-y-4 rounded-md border border-slate-200 bg-white p-4">
              <div>
                <h2 className="text-sm font-semibold text-slate-900">Selected company</h2>
                <p className="mt-1 text-sm text-slate-600">{detail.company?.name ?? 'No company selected'}</p>
              </div>

              {detail.company ? (
                <form action={updateBDCompanyAction} className="space-y-3 rounded-md border border-slate-200 bg-slate-50 p-3">
                  <input type="hidden" name="organizationId" value={organizationId} />
                  <input type="hidden" name="companyId" value={detail.company?.id ?? ''} />
                  <div className="grid gap-3 md:grid-cols-2">
                    <label className="space-y-1 text-xs font-medium text-slate-600">
                      Name
                      <input name="name" defaultValue={detail.company.name} className="h-10 w-full rounded-md border border-slate-300 px-3 text-sm" required />
                    </label>
                    <label className="space-y-1 text-xs font-medium text-slate-600">
                      Status
                      <select name="status" defaultValue={detail.company.status} className="h-10 w-full rounded-md border border-slate-300 bg-white px-3 text-sm">
                        <option value="active">Active</option>
                        <option value="paused">Paused</option>
                        <option value="archived">Archived</option>
                      </select>
                    </label>
                  </div>
                  <div className="grid gap-3 md:grid-cols-2">
                    <label className="space-y-1 text-xs font-medium text-slate-600">
                      Company type
                      <select name="companyType" defaultValue={detail.company.companyType} className="h-10 w-full rounded-md border border-slate-300 bg-white px-3 text-sm">
                        {COMPANY_TYPES.map((companyType) => (
                          <option key={companyType} value={companyType}>{companyType}</option>
                        ))}
                      </select>
                    </label>
                    <label className="space-y-1 text-xs font-medium text-slate-600">
                      Website
                      <input name="website" defaultValue={detail.company.website ?? ''} className="h-10 w-full rounded-md border border-slate-300 px-3 text-sm" />
                    </label>
                  </div>
                  <div className="grid gap-3 md:grid-cols-2">
                    <label className="space-y-1 text-xs font-medium text-slate-600">
                      Primary contact name
                      <input name="primaryContactName" defaultValue={detail.company.primaryContactName ?? ''} className="h-10 w-full rounded-md border border-slate-300 px-3 text-sm" />
                    </label>
                    <label className="space-y-1 text-xs font-medium text-slate-600">
                      Primary contact email
                      <input name="primaryContactEmail" defaultValue={detail.company.primaryContactEmail ?? ''} className="h-10 w-full rounded-md border border-slate-300 px-3 text-sm" />
                    </label>
                  </div>
                  <label className="space-y-1 text-xs font-medium text-slate-600">
                    Notes
                    <textarea name="notes" defaultValue={detail.company.notes ?? ''} className="min-h-20 w-full rounded-md border border-slate-300 px-3 py-2 text-sm" />
                  </label>
                  <button type="submit" className="rounded-md bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800">
                    Save changes
                  </button>
                </form>
              ) : null}

              <div className="grid gap-4 lg:grid-cols-2">
                <section className="rounded-md border border-slate-200 p-3">
                  <div className="flex items-center gap-2">
                    <Users className="h-4 w-4 text-sky-700" />
                    <h3 className="text-sm font-semibold text-slate-900">Contacts</h3>
                  </div>
                  <div className="mt-3 space-y-2 text-sm">
                    {detail.contacts.map((contact) => (
                      <div key={contact.id} className="rounded-md border border-slate-200 bg-slate-50 p-2">
                        <div className="font-medium text-slate-900">{contact.fullName}</div>
                        <div className="text-xs text-slate-600">{contact.roleTitle ?? 'Contact'}{contact.isPrimary ? ' · primary' : ''}</div>
                      </div>
                    ))}
                    {detail.contacts.length === 0 ? <p className="text-slate-500">No contacts yet.</p> : null}
                  </div>
                </section>

                <section className="rounded-md border border-slate-200 p-3">
                  <div className="flex items-center gap-2">
                    <BriefcaseBusiness className="h-4 w-4 text-sky-700" />
                    <h3 className="text-sm font-semibold text-slate-900">Opportunities</h3>
                  </div>
                  <div className="mt-3 space-y-2 text-sm">
                    {detail.opportunities.map((opportunity) => {
                      const history = opportunityHistoryMap.get(opportunity.id) ?? []
                      return (
                        <div key={opportunity.id} className="rounded-md border border-slate-200 bg-slate-50 p-2">
                          <div className="font-medium text-slate-900">{opportunity.title}</div>
                          <div className="text-xs text-slate-600">{opportunity.stage} · {opportunity.currency} {opportunity.expectedValue ?? 0}</div>
                          {opportunity.budgetStatus || opportunity.ctaStatus ? (
                            <div className="text-xs text-slate-600">{opportunity.budgetStatus ?? 'budget'} · {opportunity.ctaStatus ?? 'cta'}</div>
                          ) : null}
                          {history.length > 0 ? (
                            <div className="mt-2 space-y-1 border-t border-slate-200 pt-2">
                              <div className="flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wide text-slate-500">
                                <GitBranch className="h-3 w-3" />
                                Status history
                              </div>
                              {history.slice(0, 3).map((entry) => (
                                <div key={entry.id} className="text-xs text-slate-600">
                                  {entry.fromStatus ? `${entry.fromStatus} → ${entry.toStatus}` : `Initial: ${entry.toStatus}`}
                                  <span className="ml-1 text-slate-400">· {new Date(entry.createdAt).toLocaleDateString()}</span>
                                </div>
                              ))}
                            </div>
                          ) : null}
                        </div>
                      )
                    })}
                    {detail.opportunities.length === 0 ? <p className="text-slate-500">No opportunities yet.</p> : null}
                  </div>
                </section>

                <section className="rounded-md border border-slate-200 p-3">
                  <div className="flex items-center gap-2">
                    <PhoneCall className="h-4 w-4 text-sky-700" />
                    <h3 className="text-sm font-semibold text-slate-900">Tasks</h3>
                  </div>
                  <div className="mt-3 space-y-2 text-sm">
                    {detail.tasks.map((task) => (
                      <div key={task.id} className="rounded-md border border-slate-200 bg-slate-50 p-2">
                        <div className="font-medium text-slate-900">{task.title}</div>
                        <div className="text-xs text-slate-600">{task.status} · {task.priority}</div>
                      </div>
                    ))}
                    {detail.tasks.length === 0 ? <p className="text-slate-500">No tasks yet.</p> : null}
                  </div>
                </section>

                <section className="rounded-md border border-slate-200 p-3">
                  <div className="flex items-center gap-2">
                    <MessageSquare className="h-4 w-4 text-sky-700" />
                    <h3 className="text-sm font-semibold text-slate-900">Interactions</h3>
                  </div>
                  <div className="mt-3 space-y-2 text-sm">
                    {detail.interactions.map((interaction) => (
                      <div key={interaction.id} className="rounded-md border border-slate-200 bg-slate-50 p-2">
                        <div className="font-medium text-slate-900">{interaction.subject ?? interaction.channel}</div>
                        <div className="text-xs text-slate-600">{interaction.direction} · {new Date(interaction.happenedAt).toLocaleString()}</div>
                      </div>
                    ))}
                    {detail.interactions.length === 0 ? <p className="text-slate-500">No interactions yet.</p> : null}
                  </div>
                </section>
              </div>

              <div className="grid gap-4 lg:grid-cols-2">
                <form action={createBDOpportunityAction} className="rounded-md border border-slate-200 p-3 space-y-3">
                  <input type="hidden" name="organizationId" value={organizationId} />
                  <input type="hidden" name="companyId" value={detail.company?.id ?? ''} />
                  <h3 className="text-sm font-semibold text-slate-900">Add opportunity</h3>
                  <label className="space-y-1 text-xs font-medium text-slate-600">
                    Title
                    <input name="title" className="h-10 w-full rounded-md border border-slate-300 px-3 text-sm" />
                  </label>
                  <div className="grid gap-3 md:grid-cols-2">
                    <label className="space-y-1 text-xs font-medium text-slate-600">
                      Stage
                      <select name="stage" className="h-10 w-full rounded-md border border-slate-300 bg-white px-3 text-sm" defaultValue="lead">
                        {OPPORTUNITY_STAGES.map((stageName) => (
                          <option key={stageName} value={stageName}>{stageName}</option>
                        ))}
                      </select>
                    </label>
                    <label className="space-y-1 text-xs font-medium text-slate-600">
                      Expected value
                      <input name="expectedValue" className="h-10 w-full rounded-md border border-slate-300 px-3 text-sm" />
                    </label>
                  </div>
                  <button type="submit" className="rounded-md bg-sky-700 px-3 py-2 text-sm font-semibold text-white hover:bg-sky-800">
                    Save opportunity
                  </button>
                </form>

                <form action={createBDTaskAction} className="rounded-md border border-slate-200 p-3 space-y-3">
                  <input type="hidden" name="organizationId" value={organizationId} />
                  <input type="hidden" name="companyId" value={detail.company?.id ?? ''} />
                  <h3 className="text-sm font-semibold text-slate-900">Add task</h3>
                  <label className="space-y-1 text-xs font-medium text-slate-600">
                    Title
                    <input name="title" className="h-10 w-full rounded-md border border-slate-300 px-3 text-sm" />
                  </label>
                  <label className="space-y-1 text-xs font-medium text-slate-600">
                    Next step
                    <input name="nextStep" className="h-10 w-full rounded-md border border-slate-300 px-3 text-sm" />
                  </label>
                  <button type="submit" className="rounded-md bg-slate-900 px-3 py-2 text-sm font-semibold text-white hover:bg-slate-800">
                    Save task
                  </button>
                </form>

                <form action={createBDContactAction} className="rounded-md border border-slate-200 p-3 space-y-3">
                  <input type="hidden" name="organizationId" value={organizationId} />
                  <input type="hidden" name="companyId" value={detail.company?.id ?? ''} />
                  <h3 className="text-sm font-semibold text-slate-900">Add contact</h3>
                  <label className="space-y-1 text-xs font-medium text-slate-600">
                    Full name
                    <input name="fullName" className="h-10 w-full rounded-md border border-slate-300 px-3 text-sm" />
                  </label>
                  <label className="space-y-1 text-xs font-medium text-slate-600">
                    Role title
                    <input name="roleTitle" className="h-10 w-full rounded-md border border-slate-300 px-3 text-sm" />
                  </label>
                  <button type="submit" className="rounded-md bg-sky-700 px-3 py-2 text-sm font-semibold text-white hover:bg-sky-800">
                    Save contact
                  </button>
                </form>

                <form action={createBDInteractionAction} className="rounded-md border border-slate-200 p-3 space-y-3">
                  <input type="hidden" name="organizationId" value={organizationId} />
                  <input type="hidden" name="companyId" value={detail.company?.id ?? ''} />
                  <h3 className="text-sm font-semibold text-slate-900">Add interaction</h3>
                  <label className="space-y-1 text-xs font-medium text-slate-600">
                    Subject
                    <input name="subject" className="h-10 w-full rounded-md border border-slate-300 px-3 text-sm" />
                  </label>
                  <label className="space-y-1 text-xs font-medium text-slate-600">
                    Summary
                    <textarea name="summary" className="min-h-20 w-full rounded-md border border-slate-300 px-3 py-2 text-sm" />
                  </label>
                  <button type="submit" className="rounded-md bg-slate-900 px-3 py-2 text-sm font-semibold text-white hover:bg-slate-800">
                    Save interaction
                  </button>
                </form>
              </div>
            </div>
          ) : (
            <div className="rounded-md border border-slate-200 bg-white p-6 text-sm text-slate-500">
              Select a company to view opportunities, contacts, tasks, and interactions.
            </div>
          )}
        </section>
      </div>
    </div>
  )
}
