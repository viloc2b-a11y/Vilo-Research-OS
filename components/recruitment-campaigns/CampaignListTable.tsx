import Link from 'next/link'
import type { CampaignListItem } from '@/lib/crm/campaign-management'
import { CampaignStatusBadge } from '@/components/recruitment-campaigns/CampaignStatusBadge'
import { CampaignTypeBadge } from '@/components/recruitment-campaigns/CampaignTypeBadge'

type CampaignListTableProps = {
  campaigns: CampaignListItem[]
  canManage: boolean
}

export function CampaignListTable({ campaigns, canManage }: CampaignListTableProps) {
  return (
    <div className="rounded-md border border-slate-200 bg-white">
      {/* Header row */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-slate-200">
        <h2 className="text-sm font-semibold text-slate-900">Campaigns</h2>
        {canManage && (
          <Link
            href="/recruitment/campaigns/new"
            className="inline-flex items-center gap-1.5 rounded-md bg-teal-700 px-3 py-1.5 text-xs font-semibold text-white hover:bg-teal-800 transition-colors"
          >
            New Campaign
          </Link>
        )}
      </div>

      {campaigns.length === 0 ? (
        <div className="px-4 py-10 text-center text-sm text-slate-500">
          No campaigns found for the selected filter.
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
                <th className="px-4 py-2.5 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide">
                  Type
                </th>
                <th className="px-4 py-2.5 text-right text-xs font-semibold text-slate-500 uppercase tracking-wide">
                  Studies
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
                  Created
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {campaigns.map((campaign) => (
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
                    <CampaignStatusBadge status={campaign.status} />
                  </td>
                  <td className="px-4 py-3">
                    <CampaignTypeBadge type={campaign.campaign_type} />
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums text-slate-700">
                    {campaign.linked_study_count}
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
                  <td className="px-4 py-3 text-right text-xs text-slate-500">
                    {new Date(campaign.created_at).toLocaleDateString()}
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
