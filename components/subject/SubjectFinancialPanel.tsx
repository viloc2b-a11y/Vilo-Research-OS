import { DollarSign } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import type { SubjectFinancialRuntime } from '@/lib/financial-runtime/types'

type Props = {
  financial: SubjectFinancialRuntime | null
}

const LEAKAGE_SEVERITY_CLASSES = {
  critical: 'bg-red-100 text-red-800',
  warning: 'bg-orange-100 text-orange-800',
  info: 'bg-slate-100 text-slate-700',
} as const

const SAFEGUARD_CLASSES = {
  error: 'border-red-200 bg-red-50 text-red-800',
  warning: 'border-orange-200 bg-orange-50 text-orange-800',
} as const

function earnRateBadgeClass(basisPoints: number): string {
  if (basisPoints >= 8000) return 'bg-green-100 text-green-800'
  if (basisPoints >= 5000) return 'bg-orange-100 text-orange-800'
  return 'bg-red-100 text-red-800'
}

export function SubjectFinancialPanel({ financial }: Props) {
  if (financial === null) {
    return (
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <DollarSign className="size-4 text-emerald-600" />
            Financial Status
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">Financial data unavailable.</p>
        </CardContent>
      </Card>
    )
  }

  const earnPct = (financial.earnedRateBasisPoints / 100).toFixed(0)
  const visibleLeakage = financial.leakage.slice(0, 3)
  const extraLeakage = financial.leakage.length - 3

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <DollarSign className="size-4 text-emerald-600" />
          Financial Status
          <span className={`rounded px-1.5 py-0.5 text-xs font-semibold ${earnRateBadgeClass(financial.earnedRateBasisPoints)}`}>
            {earnPct}% earned
          </span>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-4 gap-2">
          {[
            { label: 'Expected', value: financial.expected.procedureCount },
            { label: 'Executed', value: financial.executed.procedureCompletedCount },
            { label: 'Earned', value: financial.earned.procedureEarnedCount },
            { label: 'Earn Rate', value: `${earnPct}%` },
          ].map(({ label, value }) => (
            <div key={label} className="rounded-md border px-3 py-2 text-center">
              <p className="text-base font-semibold">{value}</p>
              <p className="text-xs text-muted-foreground">{label}</p>
            </div>
          ))}
        </div>

        {financial.leakage.length > 0 && (
          <div className="space-y-1.5">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Revenue Leakage</p>
            <ul className="space-y-1.5">
              {visibleLeakage.map((item) => (
                <li key={item.id} className="rounded-md border px-3 py-2 text-sm">
                  <div className="flex items-center gap-1.5">
                    <span className={`rounded px-1.5 py-0.5 text-xs font-semibold uppercase ${LEAKAGE_SEVERITY_CLASSES[item.severity]}`}>
                      {item.severity}
                    </span>
                    <span className="font-medium">{item.label}</span>
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground line-clamp-1">{item.detail}</p>
                </li>
              ))}
            </ul>
            {extraLeakage > 0 && (
              <p className="text-center text-xs text-muted-foreground">+{extraLeakage} more leakage items</p>
            )}
          </div>
        )}

        {financial.safeguards.length > 0 && (
          <div className="space-y-1.5">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Safeguards</p>
            <ul className="space-y-1.5">
              {financial.safeguards.map((s) => (
                <li key={s.id} className={`rounded-md border px-3 py-2 text-xs ${SAFEGUARD_CLASSES[s.severity]}`}>
                  <span className="font-semibold">{s.label}</span>
                  {' — '}
                  {s.detail}
                </li>
              ))}
            </ul>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
