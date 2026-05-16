import Link from 'next/link'
import { cn } from '@/lib/utils'

const navItems = [
  { href: '/', label: 'Dashboard' },
  { href: '/studies', label: 'Studies' },
]

type SidebarProps = {
  organizationName?: string | null
}

export function Sidebar({ organizationName }: SidebarProps) {
  return (
    <aside className="flex h-full w-56 flex-col border-r border-sidebar-border bg-sidebar text-sidebar-foreground">
      <div className="border-b border-sidebar-border px-4 py-5">
        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          Vilo OS
        </p>
        <p className="mt-1 text-sm font-semibold">{organizationName ?? 'Operations'}</p>
      </div>
      <nav className="flex flex-1 flex-col gap-1 p-3">
        {navItems.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className={cn(
              'rounded-md px-3 py-2 text-sm font-medium transition-colors',
              'hover:bg-sidebar-accent hover:text-sidebar-accent-foreground',
            )}
          >
            {item.label}
          </Link>
        ))}
      </nav>
    </aside>
  )
}
