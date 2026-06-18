import type { CampaignStatus } from '@/lib/crm/campaign-management'

type CampaignStatusBadgeProps = {
  status: CampaignStatus
}

const BADGE_CONFIG: Record<CampaignStatus, { label: string; className: string }> = {
  draft: {
    label: 'Draft',
    className: 'bg-slate-100 text-slate-700',
  },
  active: {
    label: 'Active',
    className: 'bg-teal-100 text-teal-800',
  },
  paused: {
    label: 'Paused',
    className: 'bg-amber-100 text-amber-800',
  },
  closed: {
    label: 'Closed',
    className: 'bg-gray-100 text-gray-600',
  },
}

export function CampaignStatusBadge({ status }: CampaignStatusBadgeProps) {
  const config = BADGE_CONFIG[status]
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${config.className}`}
    >
      {config.label}
    </span>
  )
}
