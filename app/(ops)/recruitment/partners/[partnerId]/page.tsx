import { redirect } from 'next/navigation'
import { getOrganizationMemberships, getPrimaryOrganizationId, getSessionUser } from '@/lib/auth/session'
import { activeMemberships } from '@/lib/auth/membership-access'
import { canAccessPatientCRM } from '@/lib/rbac/permissions'
import { createServerClient } from '@/lib/supabase/server'
import { resolveRecruitmentRoleExperience } from '@/app/(ops)/recruitment/_lib/recruitment-view-model'
import { loadPartnerDetail } from '@/lib/crm/partner-management'
import { PartnerStatusBadge } from '@/components/recruitment-partners/PartnerStatusBadge'
import { PartnerTypeBadge } from '@/components/recruitment-partners/PartnerTypeBadge'
import { PartnerPerformanceSummary } from '@/components/recruitment-partners/PartnerPerformanceSummary'
import { PartnerCampaignList } from '@/components/recruitment-partners/PartnerCampaignList'

export default async function PartnerDetailPage({
  params,
}: {
  params: Promise<{ partnerId: string }>
}) {
  const { partnerId } = await params

  const user = await getSessionUser()
  if (!user) redirect('/login')

  const organizationId = await getPrimaryOrganizationId(user.id)
  if (!organizationId) {
    return (
      <div className="space-y-3 p-6">
        <h1 className="text-2xl font-semibold tracking-tight text-slate-900">Partner</h1>
        <p className="text-sm text-slate-500">No active organization access is available.</p>
      </div>
    )
  }

  const memberships = activeMemberships(await getOrganizationMemberships(user.id))
  const hasAccess = canAccessPatientCRM(memberships, organizationId)
  if (!hasAccess) redirect('/recruitment')

  const roleExperience = resolveRecruitmentRoleExperience(memberships, organizationId)

  // PI → no access to partner management
  if (roleExperience === 'pi') redirect('/recruitment')

  const canManage = roleExperience === 'owner' || roleExperience === 'site_director'

  const supabase = await createServerClient()
  const detail = await loadPartnerDetail(supabase, organizationId, partnerId)

  if (!detail) {
    return (
      <div className="space-y-3 p-6">
        <h1 className="text-2xl font-semibold tracking-tight text-slate-900">Partner not found.</h1>
        <a href="/recruitment/partners" className="text-sm text-teal-700 underline hover:text-teal-900">
          Back to partners
        </a>
      </div>
    )
  }

  return (
    <div className="space-y-6 p-6">
      <header className="flex flex-col gap-3 max-w-4xl sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-teal-700">Partner</p>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight text-slate-900">{detail.name}</h1>
          <div className="mt-2 flex flex-wrap gap-2">
            <PartnerStatusBadge status={detail.status} />
            <PartnerTypeBadge type={detail.partner_type} />
          </div>
        </div>
        {canManage && (
          <a
            href={`/recruitment/partners/${detail.id}/edit`}
            className="inline-flex items-center rounded-md border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 transition-colors self-start"
          >
            Edit
          </a>
        )}
      </header>

      {/* Contact info */}
      {(detail.contact_name || detail.contact_email || detail.contact_phone) && (
        <section className="rounded-md border border-slate-200 bg-white p-4">
          <h2 className="text-sm font-semibold text-slate-900 mb-3">Contact Information</h2>
          <dl className="space-y-2">
            {detail.contact_name && (
              <div className="flex gap-3 text-sm">
                <dt className="font-medium text-slate-500 w-24 shrink-0">Name</dt>
                <dd className="text-slate-900">{detail.contact_name}</dd>
              </div>
            )}
            {detail.contact_email && (
              <div className="flex gap-3 text-sm">
                <dt className="font-medium text-slate-500 w-24 shrink-0">Email</dt>
                <dd className="text-slate-900">{detail.contact_email}</dd>
              </div>
            )}
            {detail.contact_phone && (
              <div className="flex gap-3 text-sm">
                <dt className="font-medium text-slate-500 w-24 shrink-0">Phone</dt>
                <dd className="text-slate-900">{detail.contact_phone}</dd>
              </div>
            )}
          </dl>
        </section>
      )}

      {/* Notes */}
      {detail.notes && (
        <section className="rounded-md border border-slate-200 bg-white p-4">
          <h2 className="text-sm font-semibold text-slate-900 mb-2">Notes</h2>
          <p className="text-sm text-slate-700 whitespace-pre-line">{detail.notes}</p>
        </section>
      )}

      <PartnerPerformanceSummary detail={detail} />

      <PartnerCampaignList detail={detail} />

      {/* Top sources */}
      {detail.top_sources.length > 0 && (
        <section className="rounded-md border border-slate-200 bg-white p-4">
          <h2 className="text-sm font-semibold text-slate-900 mb-3">Top Lead Sources</h2>
          <ul className="space-y-1">
            {detail.top_sources.map((src, idx) => (
              <li key={idx} className="flex items-center justify-between text-sm">
                <span className="text-slate-700">{src.utm_source ?? '(none)'}</span>
                <span className="tabular-nums font-medium text-slate-900">{src.count}</span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  )
}
