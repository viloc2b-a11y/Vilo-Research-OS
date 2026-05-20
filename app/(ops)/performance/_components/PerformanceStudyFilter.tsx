import Link from 'next/link'
import { Label } from '@/components/ui/label'
import type { PerformanceStudyFilterOption } from '@/app/(ops)/performance/_lib/performance-types'

type PerformanceStudyFilterProps = {
  options: PerformanceStudyFilterOption[]
  selectedStudyId: string | null
  selectedStudyName: string | null
}

export function PerformanceStudyFilter({
  options,
  selectedStudyId,
  selectedStudyName,
}: PerformanceStudyFilterProps) {
  if (options.length === 0) return null

  return (
    <form method="get" className="flex flex-wrap items-end gap-3">
      <div className="space-y-1">
        <Label htmlFor="performance-study-filter" className="text-xs">
          Study scope
        </Label>
        <select
          id="performance-study-filter"
          name="studyId"
          defaultValue={selectedStudyId ?? ''}
          className="h-8 min-w-[12rem] rounded-lg border border-input bg-transparent px-2.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 dark:bg-input/30"
        >
          <option value="">All studies</option>
          {options.map((study) => (
            <option key={study.studyId} value={study.studyId}>
              {study.studyName}
            </option>
          ))}
        </select>
      </div>
      <button
        type="submit"
        className="h-8 rounded-lg border border-input bg-background px-3 text-sm font-medium hover:bg-muted"
      >
        Apply
      </button>
      {selectedStudyId ? (
        <Link
          href="/performance"
          className="pb-2 text-sm text-primary hover:underline"
        >
          Clear study filter
        </Link>
      ) : null}
      {selectedStudyName ? (
        <p className="w-full text-xs text-muted-foreground">
          Filtered to <span className="font-medium text-foreground">{selectedStudyName}</span>.
          {/* TODO: replace with OpsShell active study context when available */}
        </p>
      ) : null}
    </form>
  )
}
