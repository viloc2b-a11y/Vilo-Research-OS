'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { cn } from '@/lib/utils'

const commandSubNav = [
  { href: '/performance', label: 'Portfolio', exact: true },
  { href: '/performance/today', label: 'Today', exact: false },
  { href: '/performance/risks', label: 'Risks', exact: false },
] as const

export function PerformanceCommandNav() {
  const pathname = usePathname()

  return (
    <nav className="flex flex-wrap gap-2 border-b pb-3">
      {commandSubNav.map((item) => {
        const active = item.exact
          ? pathname === item.href
          : pathname === item.href || pathname.startsWith(`${item.href}/`)
        return (
          <Link
            key={item.href}
            href={item.href}
            className={cn(
              'rounded-md px-3 py-1.5 text-sm font-medium transition-colors',
              active
                ? 'bg-primary text-primary-foreground'
                : 'text-muted-foreground hover:bg-muted hover:text-foreground',
            )}
          >
            {item.label}
          </Link>
        )
      })}
    </nav>
  )
}
