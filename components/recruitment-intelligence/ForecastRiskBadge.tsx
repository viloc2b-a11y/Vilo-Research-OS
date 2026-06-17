type ForecastRisk = 'on_track' | 'at_risk' | 'critical' | 'impossible' | null

type ForecastRiskBadgeProps = {
  risk: ForecastRisk
}

const BADGE_CONFIG: Record<
  Exclude<ForecastRisk, null>,
  { label: string; className: string }
> = {
  on_track: {
    label: 'On Track',
    className: 'bg-teal-100 text-teal-800',
  },
  at_risk: {
    label: 'At Risk',
    className: 'bg-amber-100 text-amber-800',
  },
  critical: {
    label: 'Critical',
    className: 'bg-red-100 text-red-800',
  },
  impossible: {
    label: 'Off Track',
    className: 'bg-slate-100 text-slate-700',
  },
}

export function ForecastRiskBadge({ risk }: ForecastRiskBadgeProps) {
  if (risk === null) return null

  const config = BADGE_CONFIG[risk]
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${config.className}`}
    >
      {config.label}
    </span>
  )
}
