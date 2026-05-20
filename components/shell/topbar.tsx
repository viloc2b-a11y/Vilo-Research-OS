import { SignOutButton } from '@/components/shell/sign-out-button'
import { Search, Bell } from 'lucide-react'

type TopbarProps = {
  userEmail?: string | null
}

export function Topbar({ userEmail }: TopbarProps) {
  return (
    <header
      className="flex h-14 flex-shrink-0 items-center justify-between border-b px-5"
      style={{ backgroundColor: '#ffffff', borderColor: '#e5e5e5' }}
    >
      {/* Search */}
      <div className="relative w-72">
        <Search
          className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5"
          style={{ color: '#98a5ad' }}
        />
        <input
          type="text"
          placeholder="Search subjects, studies, visits…"
          className="w-full h-8 pl-9 pr-3 rounded-lg border text-sm focus:outline-none focus:ring-2 focus:ring-[#34a090] focus:border-transparent"
          style={{ borderColor: '#e5e5e5', backgroundColor: '#f9f8f7', color: '#10253e' }}
        />
      </div>

      {/* Right side */}
      <div className="flex items-center gap-3">
        {/* Notifications placeholder */}
        <button
          type="button"
          className="rounded-lg bg-transparent p-1.5 text-[#98a5ad] transition-colors hover:bg-[#f0eeec]"
          aria-label="Notifications"
        >
          <Bell className="w-4 h-4" />
        </button>

        <div className="w-px h-6" style={{ backgroundColor: '#e5e5e5' }} />

        {/* User */}
        {userEmail && (
          <span className="text-xs" style={{ color: '#98a5ad' }}>
            {userEmail}
          </span>
        )}
        <SignOutButton />
      </div>
    </header>
  )
}
