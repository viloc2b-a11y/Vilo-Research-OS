type PerformanceHeaderProps = {
  organizationCount: number
  selectedStudyName: string | null
}

export function PerformanceHeader({
  organizationCount,
  selectedStudyName,
}: PerformanceHeaderProps) {
  return (
    <header className="space-y-1">
      <h1 className="text-2xl font-semibold tracking-tight">VPI Command</h1>
      <p className="text-sm text-muted-foreground">
        What needs attention now to protect enrollment, compliance, revenue, and
        sponsor visibility.
      </p>
      {organizationCount > 0 ? (
        <p className="text-xs text-muted-foreground">
          Scoped to {organizationCount} organization
          {organizationCount === 1 ? '' : 's'} from your session.
          {selectedStudyName ? ` Showing ${selectedStudyName}.` : ' Showing all studies.'}
        </p>
      ) : null}
    </header>
  )
}
