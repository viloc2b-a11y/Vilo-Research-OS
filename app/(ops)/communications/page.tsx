import Link from 'next/link'
import { redirect } from 'next/navigation'
import { Mail, Search, Plus } from 'lucide-react'
import { getOrganizationMemberships, getPrimaryOrganizationId, getSessionUser } from '@/lib/auth/session'
import { canAccessCommunications } from '@/lib/rbac/permissions'
import { createServerClient } from '@/lib/supabase/server'
import {
  createCommunicationDraftAction,
  createCommunicationTaskFromThreadAction,
  loadCommunicationThreadDetail,
  loadCommunicationsOverview,
  markCommunicationReviewedAction,
  sendCommunicationDraftAction,
} from '@/lib/communications/communications'
import { oneParam } from '@/lib/crm/forms'

function topicTone(reviewStatus: string) {
  switch (reviewStatus) {
    case 'sent':
      return 'bg-emerald-50 text-emerald-700 border-emerald-200'
    case 'approved':
      return 'bg-sky-50 text-sky-700 border-sky-200'
    case 'needs_review':
      return 'bg-amber-50 text-amber-700 border-amber-200'
    default:
      return 'bg-slate-50 text-slate-600 border-slate-200'
  }
}

export default async function CommunicationsPage({
  searchParams,
}: {
  searchParams?: Promise<{ q?: string | string[]; sensitivity?: string | string[]; thread?: string | string[]; result?: string | string[]; reason?: string | string[] }>
}) {
  const user = await getSessionUser()
  if (!user) redirect('/login')

  const organizationId = await getPrimaryOrganizationId(user.id)
  if (!organizationId) {
    return (
      <div className="space-y-3 p-6">
        <h1 className="text-2xl font-semibold tracking-tight text-slate-900">Communications</h1>
        <p className="text-sm text-slate-500">No active organization access is available.</p>
      </div>
    )
  }

  const memberships = await getOrganizationMemberships(user.id)
  if (!canAccessCommunications(memberships, organizationId)) {
    return (
      <div className="space-y-3 p-6">
        <h1 className="text-2xl font-semibold tracking-tight text-slate-900">Communications</h1>
        <p className="text-sm text-slate-500">Access denied.</p>
      </div>
    )
  }

  const params = (await searchParams) ?? {}
  const q = oneParam(params.q)?.trim() ?? ''
  const sensitivity = oneParam(params.sensitivity)?.trim() ?? ''
  const selectedThreadId = oneParam(params.thread)?.trim() ?? ''
  const result = oneParam(params.result)
  const reason = oneParam(params.reason)

  const supabase = await createServerClient()
  const overview = await loadCommunicationsOverview(organizationId, q, sensitivity, supabase)
  const selectedThreadIdResolved = selectedThreadId || overview.recentThreads[0]?.id || null
  const detail = selectedThreadIdResolved
    ? await loadCommunicationThreadDetail(organizationId, selectedThreadIdResolved, supabase)
    : null

  return (
    <div className="space-y-6 p-6">
      <header className="max-w-3xl">
        <p className="text-xs font-semibold uppercase tracking-wide text-teal-700">Relationships</p>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight text-slate-900">Communications</h1>
        <p className="mt-2 text-sm text-slate-600">
          Review corporate email and follow-up intelligence with human review before send. iPage is
          supported through a provider abstraction; when not configured, the shell stays mock-safe.
        </p>
        <div className="mt-4 flex flex-wrap gap-2">
          <Link href="/communications/inbox" className="rounded-md border border-slate-300 px-3 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50">
            Inbox
          </Link>
          <Link href="/communications/settings" className="rounded-md border border-slate-300 px-3 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50">
            Settings
          </Link>
        </div>
      </header>

      <section className="grid gap-4 md:grid-cols-4">
        <div className="rounded-md border border-slate-200 bg-white p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Mailboxes</p>
          <p className="mt-2 text-2xl font-semibold text-slate-900">{overview.mailboxCount}</p>
        </div>
        <div className="rounded-md border border-slate-200 bg-white p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Drafts</p>
          <p className="mt-2 text-2xl font-semibold text-slate-900">{overview.draftCount}</p>
        </div>
        <div className="rounded-md border border-slate-200 bg-white p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Queued review</p>
          <p className="mt-2 text-2xl font-semibold text-slate-900">{overview.reviewCount}</p>
        </div>
        <div className="rounded-md border border-slate-200 bg-white p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Sent</p>
          <p className="mt-2 text-2xl font-semibold text-slate-900">{overview.sentCount}</p>
        </div>
      </section>

      <section className="rounded-md border border-slate-200 bg-white p-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-sm font-semibold text-slate-900">Provider state</h2>
            <p className="mt-1 text-sm text-slate-600">
              {overview.provider.kind === 'mock'
                ? 'Mock-safe mode is active. Drafts and review flows remain in Vilo OS.'
                : overview.provider.available
                  ? 'iPage provider is configured and ready for mailbox integration.'
                  : 'iPage provider is configured but blocked until IMAP/SMTP hosts are provided.'}
            </p>
          </div>
          <span className={`rounded-full border px-3 py-1 text-xs font-semibold uppercase tracking-wide ${overview.provider.available ? 'border-emerald-200 bg-emerald-50 text-emerald-700' : 'border-amber-200 bg-amber-50 text-amber-700'}`}>
            {overview.provider.kind} · {overview.provider.available ? 'ready' : 'blocked'}
          </span>
        </div>
        {overview.provider.reason ? (
          <p className="mt-3 text-xs text-slate-500">{overview.provider.reason}</p>
        ) : null}
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
              <p className="mt-1 text-sm text-slate-600">Search threads and keep mailbox review in view.</p>
            </div>
            {selectedThreadIdResolved ? (
              <Link
                href={`/communications?thread=${encodeURIComponent(selectedThreadIdResolved)}`}
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
                <input name="q" defaultValue={q} className="h-10 w-full border-0 bg-transparent text-sm outline-none" placeholder="Subject, thread key, follow-up draft..." />
              </div>
            </label>
            <label className="space-y-1 text-xs font-medium text-slate-600">
              Sensitivity
              <select name="sensitivity" defaultValue={sensitivity} className="h-10 w-full rounded-md border border-slate-300 bg-white px-3 text-sm">
                <option value="">All</option>
                <option value="patient">Patient</option>
                <option value="business_development">Business Development</option>
                <option value="internal">Internal</option>
              </select>
            </label>
            <div className="flex items-end gap-2">
              <button type="submit" className="h-10 rounded-md bg-violet-700 px-4 text-sm font-semibold text-white hover:bg-violet-800">
                Apply
              </button>
              <Link href="/communications" className="h-10 rounded-md border border-slate-300 px-4 pt-2 text-sm font-medium text-slate-700 hover:bg-slate-50">
                Reset
              </Link>
            </div>
          </form>

          <div className="mt-4 space-y-2">
            {overview.recentThreads.map((thread) => {
              const active = thread.id === selectedThreadIdResolved
              return (
                <Link
                  key={thread.id}
                  href={`/communications?thread=${encodeURIComponent(thread.id)}${q ? `&q=${encodeURIComponent(q)}` : ''}${sensitivity ? `&sensitivity=${encodeURIComponent(sensitivity)}` : ''}`}
                  className={`block rounded-md border p-3 transition-colors ${active ? 'border-violet-300 bg-violet-50' : 'border-slate-200 bg-white hover:bg-slate-50'}`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="font-medium text-slate-900">{thread.subject ?? 'Untitled thread'}</h3>
                        <span className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${topicTone(thread.reviewStatus)}`}>{thread.reviewStatus}</span>
                      </div>
                      <div className="mt-1 text-xs text-slate-600">
                        {thread.sensitivity} · {thread.threadKey}
                      </div>
                    </div>
                    <span className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">{thread.lastMessageDirection ?? 'draft'}</span>
                  </div>
                </Link>
              )
            })}
            {overview.recentThreads.length === 0 ? (
              <div className="rounded-md border border-dashed border-slate-300 p-6 text-sm text-slate-500">
                No communication threads match this filter.
              </div>
            ) : null}
          </div>
        </section>

        <section className="space-y-4">
          <div className="rounded-md border border-slate-200 bg-white p-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h2 className="text-sm font-semibold text-slate-900">Quick draft</h2>
                <p className="mt-1 text-sm text-slate-600">Create a human-reviewed draft thread.</p>
              </div>
              <Plus className="h-4 w-4 text-violet-700" />
            </div>
            <form action={createCommunicationDraftAction} className="mt-4 grid gap-3">
              <input type="hidden" name="organizationId" value={organizationId} />
              <label className="space-y-1 text-xs font-medium text-slate-600">
                Thread key
                <input name="threadKey" className="h-10 w-full rounded-md border border-slate-300 px-3 text-sm" required />
              </label>
              <div className="grid gap-3 md:grid-cols-2">
                <label className="space-y-1 text-xs font-medium text-slate-600">
                  Sensitivity
                  <select name="sensitivity" defaultValue="business_development" className="h-10 w-full rounded-md border border-slate-300 bg-white px-3 text-sm">
                    <option value="business_development">Business Development</option>
                    <option value="patient">Patient</option>
                    <option value="internal">Internal</option>
                  </select>
                </label>
                <label className="space-y-1 text-xs font-medium text-slate-600">
                  Subject
                  <input name="subject" className="h-10 w-full rounded-md border border-slate-300 px-3 text-sm" />
                </label>
              </div>
              <label className="space-y-1 text-xs font-medium text-slate-600">
                Body
                <textarea name="body" className="min-h-24 w-full rounded-md border border-slate-300 px-3 py-2 text-sm" />
              </label>
              <button type="submit" className="rounded-md bg-violet-700 px-4 py-2 text-sm font-semibold text-white hover:bg-violet-800">
                Save draft
              </button>
            </form>
          </div>

          {detail ? (
            <div className="space-y-4 rounded-md border border-slate-200 bg-white p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h2 className="text-sm font-semibold text-slate-900">Selected thread</h2>
                  <p className="mt-1 text-sm text-slate-600">{detail.thread?.subject ?? detail.thread?.threadKey ?? 'No thread selected'}</p>
                </div>
                <Mail className="h-4 w-4 text-violet-700" />
              </div>

              {detail.thread ? (
                <div className="rounded-md border border-slate-200 bg-slate-50 p-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${topicTone(detail.thread.reviewStatus)}`}>{detail.thread.reviewStatus}</span>
                    <span className="text-xs text-slate-600">{detail.thread.sensitivity}</span>
                  </div>
                  <div className="mt-2 text-sm text-slate-700">{detail.vipSummary}</div>
                  <div className="mt-2 text-xs text-slate-500">VIP follow-up draft: {detail.vipFollowUpDraft}</div>
                </div>
              ) : null}

              <div className="rounded-md border border-slate-200 bg-white p-3">
                <h3 className="text-sm font-semibold text-slate-900">Create task from email</h3>
                <p className="mt-1 text-sm text-slate-600">
                  Create a coordinator follow-up without leaving the inbox.
                </p>
                <form action={createCommunicationTaskFromThreadAction} className="mt-3 grid gap-3">
                  <input type="hidden" name="organizationId" value={organizationId} />
                  <input type="hidden" name="threadId" value={detail.thread?.id ?? ''} />
                  <div className="grid gap-3 md:grid-cols-2">
                    <label className="space-y-1 text-xs font-medium text-slate-600">
                      Task type
                      <select name="taskType" defaultValue={detail.thread?.sensitivity === 'patient' ? 'patient_followup' : 'bd_task'} className="h-10 w-full rounded-md border border-slate-300 bg-white px-3 text-sm">
                        <option value="bd_task">Business Development task</option>
                        <option value="patient_followup">Patient follow-up</option>
                      </select>
                    </label>
                    <label className="space-y-1 text-xs font-medium text-slate-600">
                      Title
                      <input name="title" className="h-10 w-full rounded-md border border-slate-300 px-3 text-sm" placeholder="Follow up on sponsor budget notes" required />
                    </label>
                  </div>
                  <div className="grid gap-3 md:grid-cols-2">
                    <label className="space-y-1 text-xs font-medium text-slate-600">
                      Due date
                      <input type="datetime-local" name="dueAt" className="h-10 w-full rounded-md border border-slate-300 px-3 text-sm" />
                    </label>
                    <label className="space-y-1 text-xs font-medium text-slate-600">
                      Priority
                      <select name="priority" defaultValue="normal" className="h-10 w-full rounded-md border border-slate-300 bg-white px-3 text-sm">
                        <option value="low">Low</option>
                        <option value="normal">Normal</option>
                        <option value="high">High</option>
                        <option value="urgent">Urgent</option>
                      </select>
                    </label>
                  </div>
                  <label className="space-y-1 text-xs font-medium text-slate-600">
                    Next step
                    <input name="nextStep" className="h-10 w-full rounded-md border border-slate-300 px-3 text-sm" placeholder="Call sponsor and confirm next step" />
                  </label>
                  <label className="space-y-1 text-xs font-medium text-slate-600">
                    Notes
                    <textarea name="notes" className="min-h-20 w-full rounded-md border border-slate-300 px-3 py-2 text-sm" placeholder="Optional context for the task" />
                  </label>
                  <button type="submit" className="w-fit rounded-md border border-violet-700 bg-violet-700 px-4 py-2 text-sm font-semibold text-white hover:bg-violet-800">
                    Create task
                  </button>
                </form>
              </div>

              <div className="rounded-md border border-slate-200 bg-white p-3">
                <h3 className="text-sm font-semibold text-slate-900">Linked tasks</h3>
                {detail.linkedTasks.length > 0 ? (
                  <div className="mt-3 space-y-2">
                    {detail.linkedTasks.map((task) => (
                      <div key={`${task.source}:${task.id}`} className="rounded-md border border-slate-200 p-3">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <div className="text-sm font-medium text-slate-900">{task.title}</div>
                          <span className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">{task.source}</span>
                        </div>
                        <div className="mt-1 text-xs text-slate-600">
                          {task.status} · {task.priority}{task.dueAt ? ` · due ${task.dueAt}` : ''}
                        </div>
                        {task.nextStep ? <div className="mt-1 text-sm text-slate-700">{task.nextStep}</div> : null}
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="mt-2 text-sm text-slate-500">No tasks linked yet.</p>
                )}
              </div>

              <div className="space-y-3">
                {detail.messages.map((message) => (
                  <div key={message.id} className="rounded-md border border-slate-200 p-3">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <div className="text-sm font-medium text-slate-900">{message.subject ?? 'Draft message'}</div>
                        <div className="text-xs text-slate-500">{message.direction} · {message.status} · {message.channel}</div>
                      </div>
                      <span className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">
                        {message.requiresHumanReview ? 'review required' : 'reviewed'}
                      </span>
                    </div>
                    {message.body ? <div className="mt-2 text-sm text-slate-700 whitespace-pre-wrap">{message.body}</div> : null}
                    {message.status === 'draft' || message.status === 'queued' ? (
                      <div className="mt-3 flex flex-wrap gap-2">
                        {message.requiresHumanReview ? (
                          <form action={markCommunicationReviewedAction}>
                            <input type="hidden" name="organizationId" value={organizationId} />
                            <input type="hidden" name="threadId" value={detail.thread?.id ?? ''} />
                            <input type="hidden" name="messageId" value={message.id} />
                            <button type="submit" className="rounded-md border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50">
                              Mark reviewed
                            </button>
                          </form>
                        ) : null}
                        <form action={sendCommunicationDraftAction}>
                          <input type="hidden" name="organizationId" value={organizationId} />
                          <input type="hidden" name="threadId" value={detail.thread?.id ?? ''} />
                          <input type="hidden" name="messageId" value={message.id} />
                          <button type="submit" className="rounded-md bg-violet-700 px-3 py-1.5 text-xs font-semibold text-white hover:bg-violet-800">
                            Send
                          </button>
                        </form>
                      </div>
                    ) : null}
                  </div>
                ))}
                {detail.messages.length === 0 ? <p className="text-sm text-slate-500">No messages yet.</p> : null}
              </div>
            </div>
          ) : (
            <div className="rounded-md border border-slate-200 bg-white p-6 text-sm text-slate-500">
              Select a thread to review messages, summaries, and follow-up guidance.
            </div>
          )}
        </section>
      </div>
    </div>
  )
}
