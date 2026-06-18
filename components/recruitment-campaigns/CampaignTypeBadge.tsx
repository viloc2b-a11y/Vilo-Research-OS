import type { CampaignType } from '@/lib/crm/campaign-management'

type CampaignTypeBadgeProps = {
  type: CampaignType
}

const TYPE_LABELS: Record<CampaignType, string> = {
  referral_partner: 'Referral Partner',
  digital_paid: 'Digital Paid',
  community_event: 'Community Event',
  organic_seo: 'Organic SEO',
  internal: 'Internal',
}

export function CampaignTypeBadge({ type }: CampaignTypeBadgeProps) {
  return (
    <span className="inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold bg-slate-100 text-slate-700">
      {TYPE_LABELS[type]}
    </span>
  )
}
