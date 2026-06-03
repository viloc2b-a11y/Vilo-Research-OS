import { Badge } from '@/components/ui/badge'
import type { VisitGovernanceState } from '@/lib/subject/visits/progress-note/governance-state'
import { cn } from '@/lib/utils'

const LABELS: Record<VisitGovernanceState, string> = {
  review: 'Review',
  signoff: 'Sign-off',
  lock: 'Locked',
  needs_resign: 'Needs re-sign',
}

const VARIANTS: Record<VisitGovernanceState, 'secondary' | 'outline' | 'destructive'> = {
  review: 'outline',
  signoff: 'secondary',
  lock: 'secondary',
  needs_resign: 'destructive',
}

export function VisitGovernanceStateBadge({
  state,
  className,
}: {
  state: VisitGovernanceState
  className?: string
}) {
  return (
    <Badge variant={VARIANTS[state]} className={cn('uppercase tracking-wide', className)}>
      {LABELS[state]}
    </Badge>
  )
}
