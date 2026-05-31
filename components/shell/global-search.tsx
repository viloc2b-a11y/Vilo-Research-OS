import { Search } from 'lucide-react'

export function GlobalSearch() {
  return (
    <div className="relative w-72">
      <Search
        className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground"
        aria-hidden="true"
      />
      <input
        type="text"
        placeholder="Search coming soon"
        className="h-8 w-full rounded-lg border bg-accent pl-9 pr-3 text-sm text-muted-foreground opacity-75"
        disabled
        title="Global search is planned for a later workflow release."
        aria-label="Global search coming soon"
      />
    </div>
  )
}
