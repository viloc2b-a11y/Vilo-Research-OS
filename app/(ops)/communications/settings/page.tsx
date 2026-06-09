import { redirect } from 'next/navigation'
import { Settings2 } from 'lucide-react'
import { getOrganizationMemberships, getPrimaryOrganizationId, getSessionUser } from '@/lib/auth/session'
import { canAccessCommunications } from '@/lib/rbac/permissions'
import { oneParam } from '@/lib/crm/forms'
import {
  loadCommunicationsSettings,
  refreshCommunicationMailboxAction,
  saveCommunicationMailboxAction,
} from '@/lib/communications/communications'

function statusTone(syncStatus: string) {
  switch (syncStatus) {
    case 'active':
      return 'bg-emerald-50 text-emerald-700 border-emerald-200'
    case 'pending':
      return 'bg-sky-50 text-sky-700 border-sky-200'
    case 'blocked':
      return 'bg-amber-50 text-amber-700 border-amber-200'
    case 'error':
      return 'bg-rose-50 text-rose-700 border-rose-200'
    default:
      return 'bg-slate-50 text-slate-600 border-slate-200'
  }
}

export default async function CommunicationsSettingsPage({
  searchParams,
}: {
  searchParams?: Promise<{ result?: string | string[]; reason?: string | string[] }>
}) {
  const user = await getSessionUser()
  if (!user) redirect('/login')

  const organizationId = await getPrimaryOrganizationId(user.id)
  if (!organizationId) {
    return (
      <div className="space-y-3 p-6">
        <h1 className="text-2xl font-semibold tracking-tight text-slate-900">Communications settings</h1>
        <p className="text-sm text-slate-500">No active organization access is available.</p>
      </div>
    )
  }

  const memberships = await getOrganizationMemberships(user.id)
  if (!canAccessCommunications(memberships, organizationId)) {
    return (
      <div className="space-y-3 p-6">
        <h1 className="text-2xl font-semibold tracking-tight text-slate-900">Communications settings</h1>
        <p className="text-sm text-slate-500">Access denied.</p>
      </div>
    )
  }

  const params = (await searchParams) ?? {}
  const result = oneParam(params.result)
  const reason = oneParam(params.reason)
  const overview = await loadCommunicationsSettings(organizationId)

  return (
    <div className="space-y-6 p-6">
      <header className="max-w-3xl">
        <p className="text-xs font-semibold uppercase tracking-wide text-teal-700">Relationships</p>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight text-slate-900">Communications settings</h1>
        <p className="mt-2 text-sm text-slate-600">
          Configure corporate mailboxes for the internal inbox. Passwords are not stored here; the mailbox remains under the external provider.
        </p>
      </header>

      <section className="rounded-md border border-slate-200 bg-white p-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-sm font-semibold text-slate-900">Provider state</h2>
            <p className="mt-1 text-sm text-slate-600">
              {overview.provider.kind === 'mock'
                ? 'Mock-safe mode is active. Mailboxes remain internal until an IMAP/SMTP provider is configured.'
                : overview.provider.available
                  ? 'iPage provider is configured and ready for mailbox sync settings.'
                  : 'iPage provider is configured but blocked until IMAP/SMTP hosts are present.'}
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
          <div className="font-medium">{result === 'error' ? 'Action needs attention' : 'Action complete'}</div>
          {reason ? <div className="mt-1 text-xs">{reason}</div> : null}
        </div>
      ) : null}

      <div className="grid gap-4 xl:grid-cols-[0.95fr_1.05fr]">
        <section className="rounded-md border border-slate-200 bg-white p-4">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 className="text-sm font-semibold text-slate-900">Add mailbox</h2>
              <p className="mt-1 text-sm text-slate-600">Register a mailbox for the inbox shell. Sync stays off unless the provider is configured.</p>
            </div>
            <Settings2 className="h-4 w-4 text-violet-700" />
          </div>
          <form action={saveCommunicationMailboxAction} className="mt-4 grid gap-3">
            <input type="hidden" name="organizationId" value={organizationId} />
            <div className="grid gap-3 md:grid-cols-2">
              <label className="space-y-1 text-xs font-medium text-slate-600">
                Mailbox email
                <input name="mailboxEmail" type="email" className="h-10 w-full rounded-md border border-slate-300 px-3 text-sm" placeholder="team@company.com" required />
              </label>
              <label className="space-y-1 text-xs font-medium text-slate-600">
                Display name
                <input name="displayName" className="h-10 w-full rounded-md border border-slate-300 px-3 text-sm" placeholder="CRC Inbox" />
              </label>
            </div>
            <div className="grid gap-3 md:grid-cols-2">
              <label className="space-y-1 text-xs font-medium text-slate-600">
                Provider
                <select name="provider" defaultValue="mock" className="h-10 w-full rounded-md border border-slate-300 bg-white px-3 text-sm">
                  <option value="mock">Mock-safe</option>
                  <option value="ipage">iPage</option>
                </select>
              </label>
              <label className="space-y-1 text-xs font-medium text-slate-600">
                Sync enabled
                <input name="syncEnabled" type="checkbox" className="ml-2 align-middle" />
              </label>
            </div>
            <div className="grid gap-3 md:grid-cols-2">
              <label className="space-y-1 text-xs font-medium text-slate-600">
                IMAP host
                <input name="imapHost" className="h-10 w-full rounded-md border border-slate-300 px-3 text-sm" placeholder="imap.ipage.com" />
              </label>
              <label className="space-y-1 text-xs font-medium text-slate-600">
                IMAP port
                <input name="imapPort" type="number" className="h-10 w-full rounded-md border border-slate-300 px-3 text-sm" placeholder="993" />
              </label>
            </div>
            <div className="grid gap-3 md:grid-cols-2">
              <label className="space-y-1 text-xs font-medium text-slate-600">
                SMTP host
                <input name="smtpHost" className="h-10 w-full rounded-md border border-slate-300 px-3 text-sm" placeholder="smtp.ipage.com" />
              </label>
              <label className="space-y-1 text-xs font-medium text-slate-600">
                SMTP port
                <input name="smtpPort" type="number" className="h-10 w-full rounded-md border border-slate-300 px-3 text-sm" placeholder="465" />
              </label>
            </div>
            <div className="grid gap-3 md:grid-cols-2">
              <label className="space-y-1 text-xs font-medium text-slate-600">
                IMAP secure
                <select name="imapSecure" defaultValue="on" className="h-10 w-full rounded-md border border-slate-300 bg-white px-3 text-sm">
                  <option value="on">Yes</option>
                  <option value="off">No</option>
                </select>
              </label>
              <label className="space-y-1 text-xs font-medium text-slate-600">
                SMTP secure
                <select name="smtpSecure" defaultValue="on" className="h-10 w-full rounded-md border border-slate-300 bg-white px-3 text-sm">
                  <option value="on">Yes</option>
                  <option value="off">No</option>
                </select>
              </label>
            </div>
            <label className="space-y-1 text-xs font-medium text-slate-600">
              Notes
              <textarea name="notes" className="min-h-20 w-full rounded-md border border-slate-300 px-3 py-2 text-sm" placeholder="Optional mailbox notes or review instructions" />
            </label>
            <button type="submit" className="w-fit rounded-md bg-violet-700 px-4 py-2 text-sm font-semibold text-white hover:bg-violet-800">
              Save mailbox
            </button>
          </form>
        </section>

        <section className="space-y-3 rounded-md border border-slate-200 bg-white p-4">
          <h2 className="text-sm font-semibold text-slate-900">Configured mailboxes</h2>
          {overview.mailboxes.length > 0 ? (
            <div className="space-y-3">
              {overview.mailboxes.map((mailbox) => (
                <div key={mailbox.id} className="rounded-md border border-slate-200 p-3">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <div className="font-medium text-slate-900">{mailbox.displayName ?? mailbox.mailboxEmail}</div>
                      <div className="text-xs text-slate-600">{mailbox.mailboxEmail}</div>
                    </div>
                    <span className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${statusTone(mailbox.syncStatus)}`}>
                      {mailbox.syncStatus}
                    </span>
                  </div>
                  <div className="mt-2 text-xs text-slate-600">
                    Provider: {mailbox.provider} · Sync {mailbox.syncEnabled ? 'on' : 'off'}{mailbox.lastSyncedAt ? ` · Last sync ${mailbox.lastSyncedAt}` : ''}
                  </div>
                  {mailbox.notes ? <div className="mt-2 text-sm text-slate-700">{mailbox.notes}</div> : null}
                  <form action={refreshCommunicationMailboxAction} className="mt-3 flex flex-wrap gap-2">
                    <input type="hidden" name="organizationId" value={organizationId} />
                    <input type="hidden" name="mailboxId" value={mailbox.id} />
                    <button type="submit" className="rounded-md border border-violet-700 px-3 py-1.5 text-xs font-medium text-violet-700 hover:bg-violet-50">
                      Refresh status
                    </button>
                  </form>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-slate-500">No mailboxes configured yet.</p>
          )}
          <div className="rounded-md border border-dashed border-slate-300 bg-slate-50 p-3 text-xs text-slate-600">
            No plaintext mailbox passwords are stored in Vilo OS. Keep mailbox credentials in the external mail provider and use the provider settings here only for sync metadata.
          </div>
        </section>
      </div>
    </div>
  )
}
