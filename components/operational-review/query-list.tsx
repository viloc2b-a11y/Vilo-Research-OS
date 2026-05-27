'use client'

import type { VisitSnapshotQueryRow } from '@/lib/operational-review/operational-review-types'
import { QueryCard } from './query-card'

type QueryListProps = {
  queries: VisitSnapshotQueryRow[]
  organizationId: string
  disabled?: boolean
  onUpdated: () => void
}

export function QueryList({ queries, organizationId, disabled, onUpdated }: QueryListProps) {
  if (queries.length === 0) {
    return <p className="text-sm text-slate-500">No operational queries open for this snapshot.</p>
  }

  return (
    <div className="space-y-3">
      {queries.map((query) => (
        <QueryCard
          key={query.id}
          query={query}
          organizationId={organizationId}
          disabled={disabled}
          onUpdated={onUpdated}
        />
      ))}
    </div>
  )
}
