import type { PortfolioStateSummary } from '@/app/(ops)/performance/_lib/performance-types'
import { formatPortfolioBanner } from '@/lib/performance/portfolio'

type PortfolioStateBannerProps = {
  summary: PortfolioStateSummary
}

export function PortfolioStateBanner({ summary }: PortfolioStateBannerProps) {
  return (
    <div className="rounded-lg border bg-muted/40 px-4 py-3">
      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
        Portfolio state
      </p>
      <p className="mt-1 text-sm font-semibold text-foreground">
        {formatPortfolioBanner(summary)}
      </p>
    </div>
  )
}
