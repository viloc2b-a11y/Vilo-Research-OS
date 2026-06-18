import type { PartnerType } from '@/lib/crm/partner-management'

type PartnerTypeBadgeProps = {
  type: PartnerType
}

const TYPE_LABELS: Record<PartnerType, string> = {
  digital_agency: 'Digital Agency',
  media_buyer: 'Media Buyer',
  community_org: 'Community Org',
  physician_group: 'Physician Group',
  hospital: 'Hospital',
  referral_network: 'Referral Network',
  patient_advocacy: 'Patient Advocacy',
  employer: 'Employer',
  other: 'Other',
}

export function PartnerTypeBadge({ type }: PartnerTypeBadgeProps) {
  const label = TYPE_LABELS[type] ?? type
  return (
    <span className="inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold bg-slate-100 text-slate-700">
      {label}
    </span>
  )
}
