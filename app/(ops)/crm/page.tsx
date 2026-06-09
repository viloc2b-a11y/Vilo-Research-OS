import Link from 'next/link'
import { redirect } from 'next/navigation'
import { Users, Building2, Mail } from 'lucide-react'
import { getOrganizationMemberships, getPrimaryOrganizationId, getSessionUser } from '@/lib/auth/session'
import {
  canAccessBusinessDevelopmentCRM,
  canAccessCommunications,
  canAccessPatientCRM,
} from '@/lib/rbac/permissions'
import { createServerClient } from '@/lib/supabase/server'
import { loadPatientCRMOverview } from '@/lib/crm/patient-crm'
import { loadBDOverview } from '@/lib/crm/business-development-crm'
import { loadCommunicationsOverview } from '@/lib/communications/communications'
import { loadContactRuntimeWorkspace } from '@/lib/contact-runtime/contact-runtime'

function Card({
  title,
  description,
  href,
  count,
  icon: Icon,
  accent,
  disabled,
}: {
  title: string
  description: string
  href: string
  count: string
  icon: React.ElementType
  accent: string
  disabled?: boolean
}) {
  const body = (
    <>
      <div className="flex items-center justify-between gap-4">
        <div className="rounded-md bg-white/80 p-2">
          <Icon className="h-5 w-5" style={{ color: accent }} />
        </div>
        <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">{count}</span>
      </div>
      <h2 className="mt-4 text-sm font-semibold text-slate-900">{title}</h2>
      <p className="mt-1 text-sm text-slate-600">{description}</p>
    </>
  )

  if (disabled) {
    return (
      <div className="rounded-md border border-slate-200 bg-white p-5 opacity-70">
        {body}
      </div>
    )
  }

  return (
    <Link
      href={href}
      className="rounded-md border border-slate-200 bg-white p-5 transition-colors hover:border-teal-200 hover:bg-slate-50"
    >
      {body}
    </Link>
  )
}

export default async function CRMPage() {
  const user = await getSessionUser()
  if (!user) redirect('/login')

  const organizationId = await getPrimaryOrganizationId(user.id)
  if (!organizationId) {
    return (
      <div className="space-y-3 p-6">
        <h1 className="text-2xl font-semibold tracking-tight text-slate-900">CRM</h1>
        <p className="text-sm text-slate-500">No active organization access is available.</p>
      </div>
    )
  }

  const memberships = await getOrganizationMemberships(user.id)
  const canAccessPatient = canAccessPatientCRM(memberships, organizationId)
  const canAccessBD = canAccessBusinessDevelopmentCRM(memberships, organizationId)
  const canAccessComms = canAccessCommunications(memberships, organizationId)

  const supabase = await createServerClient()
  const [patientOverview, bdOverview, communicationsOverview, contactWorkspace] = await Promise.all([
    canAccessPatient ? loadPatientCRMOverview(organizationId, supabase) : null,
    canAccessBD ? loadBDOverview(organizationId, supabase) : null,
    canAccessComms ? loadCommunicationsOverview(organizationId, null, null, supabase) : null,
    canAccessPatient || canAccessBD || canAccessComms
      ? loadContactRuntimeWorkspace(organizationId, { supabaseClient: supabase })
      : null,
  ])

  return (
    <div className="space-y-6 p-6">
      <header className="max-w-3xl">
        <p className="text-xs font-semibold uppercase tracking-wide text-teal-700">Relationships</p>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight text-slate-900">CRM</h1>
        <p className="mt-2 text-sm text-slate-600">
          Patient recruitment and business development stay separated so PHI never crosses into the
          BD pipeline. Communications sits alongside both, but still respects role and sensitivity
          boundaries.
        </p>
      </header>

      <section className="grid gap-4 md:grid-cols-4">
        <Card
          title="Contact Runtime"
          description="Unified people, organizations, communications, tasks, and referrals."
          href="/contacts"
          count={contactWorkspace ? `${contactWorkspace.people.length + contactWorkspace.organizations.length} records` : 'No access'}
          icon={Users}
          accent="#14b8a6"
          disabled={!canAccessPatient && !canAccessBD && !canAccessComms}
        />
        <Card
          title="Patient CRM"
          description="Track leads, study fit, permissions, navigation notes, and follow-ups."
          href="/crm/patients"
          count={patientOverview ? `${patientOverview.leadCount} leads` : 'No access'}
          icon={Users}
          accent="#0f766e"
          disabled={!canAccessPatient}
        />
        <Card
          title="Business Development CRM"
          description="Track sponsors, CROs, vendors, opportunities, budgets, CTA status, and tasks."
          href="/crm/business-development"
          count={bdOverview ? `${bdOverview.companyCount} companies` : 'No access'}
          icon={Building2}
          accent="#0369a1"
          disabled={!canAccessBD}
        />
        <Card
          title="Communications"
          description="Review mailbox-linked threads, drafts, human review, and follow-up intelligence."
          href="/communications"
          count={communicationsOverview ? `${communicationsOverview.threadCount} threads` : 'No access'}
          icon={Mail}
          accent="#7c3aed"
          disabled={!canAccessComms}
        />
      </section>

      <section className="grid gap-4 md:grid-cols-3">
        <div className="rounded-md border border-slate-200 bg-white p-5">
          <h2 className="text-sm font-semibold text-slate-900">Patient CRM snapshot</h2>
          <dl className="mt-4 space-y-2 text-sm text-slate-700">
            <div className="flex justify-between gap-4"><dt>Open follow-ups</dt><dd>{patientOverview?.openFollowupCount ?? 0}</dd></div>
            <div className="flex justify-between gap-4"><dt>Attributed leads</dt><dd>{patientOverview?.attributedLeadCount ?? 0}</dd></div>
            <div className="flex justify-between gap-4"><dt>Missing permission</dt><dd>{patientOverview?.missingPermissionCount ?? 0}</dd></div>
          </dl>
        </div>
        <div className="rounded-md border border-slate-200 bg-white p-5">
          <h2 className="text-sm font-semibold text-slate-900">Business Development snapshot</h2>
          <dl className="mt-4 space-y-2 text-sm text-slate-700">
            <div className="flex justify-between gap-4"><dt>Open opportunities</dt><dd>{bdOverview?.activeOpportunityCount ?? 0}</dd></div>
            <div className="flex justify-between gap-4"><dt>Open tasks</dt><dd>{bdOverview?.openTaskCount ?? 0}</dd></div>
            <div className="flex justify-between gap-4"><dt>Total opportunities</dt><dd>{bdOverview?.opportunityCount ?? 0}</dd></div>
          </dl>
        </div>
        <div className="rounded-md border border-slate-200 bg-white p-5">
          <h2 className="text-sm font-semibold text-slate-900">Communications snapshot</h2>
          <dl className="mt-4 space-y-2 text-sm text-slate-700">
            <div className="flex justify-between gap-4"><dt>Drafts</dt><dd>{communicationsOverview?.draftCount ?? 0}</dd></div>
            <div className="flex justify-between gap-4"><dt>Queued review</dt><dd>{communicationsOverview?.reviewCount ?? 0}</dd></div>
            <div className="flex justify-between gap-4"><dt>Sent</dt><dd>{communicationsOverview?.sentCount ?? 0}</dd></div>
          </dl>
        </div>
      </section>

      <section className="rounded-md border border-slate-200 bg-white p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-sm font-semibold text-slate-900">What is available now</h2>
            <p className="mt-1 text-sm text-slate-600">
              Patient and BD CRM remain separated. Communications is a review-first shell and
              respects mailbox availability, human review, and sensitivity routing.
            </p>
          </div>
          <Link
            href="/studies"
            className="rounded-md border border-slate-300 px-3 py-2 text-sm font-medium text-slate-800 hover:bg-slate-50"
          >
            Back to studies
          </Link>
        </div>
      </section>
    </div>
  )
}
