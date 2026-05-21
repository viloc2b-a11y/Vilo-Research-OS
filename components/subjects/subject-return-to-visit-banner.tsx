import Link from 'next/link'
import { ChevronLeft } from 'lucide-react'

type SubjectReturnToVisitBannerProps = {
  returnTo: string
  visitLabel?: string
}

export function SubjectReturnToVisitBanner({
  returnTo,
  visitLabel = 'visit workspace',
}: SubjectReturnToVisitBannerProps) {
  return (
    <div className="rounded-lg border border-primary/20 bg-accent/40 px-4 py-3">
      <Link
        href={returnTo}
        className="inline-flex items-center gap-1.5 text-sm font-medium text-primary hover:underline"
      >
        <ChevronLeft className="h-4 w-4" />
        Back to {visitLabel}
      </Link>
      <p className="mt-1 text-xs text-muted-foreground">
        Subject-level clinical data — return to the visit when finished reviewing.
      </p>
    </div>
  )
}
