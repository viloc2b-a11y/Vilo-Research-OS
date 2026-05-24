import type { RuntimeUiLeakageWarning } from '@/lib/runtime-ui/types'
import { DollarSign } from 'lucide-react'

export function FinancialLeakageWarningPanel({ leakage }: { leakage: RuntimeUiLeakageWarning }) {
  if (!leakage.show) return null

  return (
    <section className="rounded-lg border border-amber-200 bg-amber-50/80 px-4 py-3">
      <h3 className="flex items-center gap-2 text-sm font-semibold text-amber-950">
        <DollarSign className="size-4" />
        Financial leakage — action needed
      </h3>
      <p className="mt-1 text-xs text-amber-900">
        {leakage.recommendedFix ?? 'Resolve earnable execution gaps before closeout.'}
      </p>
      {leakage.topLeakage.length > 0 ? (
        <ul className="mt-2 list-inside list-disc text-xs text-amber-900">
          {leakage.topLeakage.slice(0, 3).map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      ) : null}
    </section>
  )
}
