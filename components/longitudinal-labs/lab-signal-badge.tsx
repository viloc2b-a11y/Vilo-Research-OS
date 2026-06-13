import type { LabSignal } from '@/lib/longitudinal-labs/longitudinal-lab-types'

const SIGNAL_STYLES: Record<string, string> = {
  out_of_range: 'bg-amber-100 text-amber-800 border-amber-300',
  clinically_significant: 'bg-red-100 text-red-800 border-red-300',
  trend_up: 'bg-blue-100 text-blue-800 border-blue-300',
  trend_down: 'bg-blue-100 text-blue-800 border-blue-300',
  rapid_change: 'bg-orange-100 text-orange-800 border-orange-300',
}

const SIGNAL_LABELS: Record<string, string> = {
  out_of_range: 'Out of Range',
  clinically_significant: 'Clinically Significant',
  trend_up: 'Trend Up',
  trend_down: 'Trend Down',
  rapid_change: 'Rapid Change',
}

export function LabSignalBadge({ signal }: { signal: LabSignal }) {
  const style = SIGNAL_STYLES[signal.kind] ?? 'bg-gray-100 text-gray-800 border-gray-300'
  const label = SIGNAL_LABELS[signal.kind] ?? signal.kind

  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-medium ${style}`}
    >
      {label}
    </span>
  )
}
