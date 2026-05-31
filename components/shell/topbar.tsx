import { SignOutButton } from '@/components/shell/sign-out-button'
import { GlobalSearch } from '@/components/shell/global-search'
import { Bell } from 'lucide-react'

type TopbarProps = {
  userEmail?: string | null
}

export function Topbar({ userEmail }: TopbarProps) {
  return (
    <header
      className="flex h-14 flex-shrink-0 items-center justify-between border-b border-border px-5"
    >
      <GlobalSearch />

      {/* Right side */}
      <div className="flex items-center gap-3">
        {/* Notifications placeholder */}
        <button
          type="button"
          className="rounded-lg bg-transparent p-1.5 text-muted-foreground transition-colors hover:bg-muted"
          aria-label="Notifications"
        >
          <Bell className="w-4 h-4" />
        </button>

        <div className="w-px h-6" style={{ backgroundColor: 'var(--border)' }} />

        {/* User */}
        {userEmail && (
          <span className="text-xs" style={{ color: 'var(--muted-foreground)' }}>
            {userEmail}
          </span>
        )}
        <SignOutButton />
      </div>
    </header>
  )
}
