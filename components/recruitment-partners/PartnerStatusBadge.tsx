import type { PartnerStatus } from '@/lib/crm/partner-management'

type PartnerStatusBadgeProps = {
  status: PartnerStatus
}

const BADGE_CONFIG: Record<PartnerStatus, { label: string; className: string }> = {
  active: {
    label: 'Active',
    className: 'bg-teal-100 text-teal-800',
  },
  paused: {
    label: 'Paused',
    className: 'bg-amber-100 text-amber-800',
  },
  inactive: {
    label: 'Inactive',
    className: 'bg-slate-100 text-slate-600',
  },
}

export function PartnerStatusBadge({ status }: PartnerStatusBadgeProps) {
  const config = BADGE_CONFIG[status]
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${config.className}`}
    >
      {config.label}
    </span>
  )
}
