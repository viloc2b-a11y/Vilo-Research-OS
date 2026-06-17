type VelocityTrend = 'accelerating' | 'stable' | 'decelerating' | 'stalled'

type EnrollmentVelocityIndicatorProps = {
  currentVelocity: number
  velocityTrend: VelocityTrend
  compact?: boolean
}

const TREND_CONFIG: Record<VelocityTrend, { icon: string; label: string }> = {
  accelerating: { icon: '↑', label: 'Accelerating' },
  stable: { icon: '→', label: 'Stable' },
  decelerating: { icon: '↓', label: 'Decelerating' },
  stalled: { icon: '—', label: 'Stalled' },
}

export function EnrollmentVelocityIndicator({
  currentVelocity,
  velocityTrend,
  compact = false,
}: EnrollmentVelocityIndicatorProps) {
  const trend = TREND_CONFIG[velocityTrend]
  const velocityLabel = `${currentVelocity.toFixed(1)} subj/wk`

  if (compact) {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-medium text-slate-700">
        <span>{velocityLabel}</span>
        <span title={trend.label}>{trend.icon}</span>
      </span>
    )
  }

  return (
    <div className="flex items-center justify-between rounded border border-slate-100 bg-slate-50 p-3">
      <div>
        <p className="text-xs font-medium text-slate-500">Enrollment velocity</p>
        <p className="mt-1 text-lg font-semibold text-slate-900">{velocityLabel}</p>
      </div>
      <div className="text-right">
        <p className="text-xs font-medium text-slate-500">Trend</p>
        <p className="mt-1 text-sm font-medium text-slate-700">
          {trend.icon} {trend.label}
        </p>
      </div>
    </div>
  )
}
