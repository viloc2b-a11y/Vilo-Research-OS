import Link from 'next/link'
import type { PartnerListItem } from '@/lib/crm/partner-management'
import { PartnerStatusBadge } from '@/components/recruitment-partners/PartnerStatusBadge'
import { PartnerTypeBadge } from '@/components/recruitment-partners/PartnerTypeBadge'

type PartnerListTableProps = {
  partners: PartnerListItem[]
  canManage: boolean
}

export function PartnerListTable({ partners, canManage }: PartnerListTableProps) {
  return (
    <div className="rounded-md border border-slate-200 bg-white">
      {/* Header row */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-slate-200">
        <h2 className="text-sm font-semibold text-slate-900">Partners</h2>
        {canManage && (
          <Link
            href="/recruitment/partners/new"
            className="inline-flex items-center gap-1.5 rounded-md bg-teal-700 px-3 py-1.5 text-xs font-semibold text-white hover:bg-teal-800 transition-colors"
          >
            New Partner
          </Link>
        )}
      </div>

      {partners.length === 0 ? (
        <div className="px-4 py-10 text-center text-sm text-slate-500">No partners found.</div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50">
                <th className="px-4 py-2.5 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide">
                  Name
                </th>
                <th className="px-4 py-2.5 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide">
                  Type
                </th>
                <th className="px-4 py-2.5 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide">
                  Status
                </th>
                <th className="px-4 py-2.5 text-right text-xs font-semibold text-slate-500 uppercase tracking-wide">
                  Campaigns
                </th>
                <th className="px-4 py-2.5 text-right text-xs font-semibold text-slate-500 uppercase tracking-wide">
                  Leads
                </th>
                <th className="px-4 py-2.5 text-right text-xs font-semibold text-slate-500 uppercase tracking-wide">
                  Qualified
                </th>
                <th className="px-4 py-2.5 text-right text-xs font-semibold text-slate-500 uppercase tracking-wide">
                  Randomized
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {partners.map((partner) => (
                <tr key={partner.id} className="hover:bg-slate-50 transition-colors">
                  <td className="px-4 py-3">
                    <Link
                      href={`/recruitment/partners/${partner.id}`}
                      className="font-medium text-teal-700 hover:text-teal-900 hover:underline"
                    >
                      {partner.name}
                    </Link>
                  </td>
                  <td className="px-4 py-3">
                    <PartnerTypeBadge type={partner.partner_type} />
                  </td>
                  <td className="px-4 py-3">
                    <PartnerStatusBadge status={partner.status} />
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums text-slate-700">
                    {partner.linked_campaign_count}
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums text-slate-700">
                    {partner.total_leads}
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums text-slate-700">
                    {partner.qualified_leads}
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums text-slate-700">
                    {partner.randomized_subjects}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
