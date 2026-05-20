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
      <h1 className="text-2xl font-semibold tracking-tight">Command</h1>
      <p className="text-sm text-muted-foreground">
        VPI operational command center — what requires attention now across your
        portfolio.
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
