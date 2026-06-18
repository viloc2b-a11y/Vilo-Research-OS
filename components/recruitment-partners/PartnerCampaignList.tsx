import Link from 'next/link'
import type { PartnerDetail } from '@/lib/crm/partner-management'
import { CampaignStatusBadge } from '@/components/recruitment-campaigns/CampaignStatusBadge'
import type { CampaignStatus } from '@/lib/crm/campaign-management'

type PartnerCampaignListProps = {
  detail: PartnerDetail
}

function formatCurrency(value: number | null): string {
  if (value === null) return '—'
  return value.toLocaleString('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
    minimumFractionDigits: 0,
  })
}

export function PartnerCampaignList({ detail }: PartnerCampaignListProps) {
  return (
    <div className="rounded-md border border-slate-200 bg-white">
      <div className="px-4 py-3 border-b border-slate-200">
        <h2 className="text-sm font-semibold text-slate-900">Linked Campaigns</h2>
      </div>

      {detail.linked_campaigns.length === 0 ? (
        <div className="px-4 py-10 text-center text-sm text-slate-500">
          No campaigns linked to this partner.
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50">
                <th className="px-4 py-2.5 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide">
                  Name
                </th>
                <th className="px-4 py-2.5 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide">
                  Status
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
                <th className="px-4 py-2.5 text-right text-xs font-semibold text-slate-500 uppercase tracking-wide">
                  Budget
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {detail.linked_campaigns.map((campaign) => (
                <tr key={campaign.id} className="hover:bg-slate-50 transition-colors">
                  <td className="px-4 py-3">
                    <Link
                      href={`/recruitment/campaigns/${campaign.id}`}
                      className="font-medium text-teal-700 hover:text-teal-900 hover:underline"
                    >
                      {campaign.name}
                    </Link>
                  </td>
                  <td className="px-4 py-3">
                    <CampaignStatusBadge status={campaign.status as CampaignStatus} />
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums text-slate-700">
                    {campaign.leads_generated}
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums text-slate-700">
                    {campaign.qualified_leads}
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums text-slate-700">
                    {campaign.randomized_subjects}
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums text-slate-700">
                    {formatCurrency(campaign.budget_amount)}
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
