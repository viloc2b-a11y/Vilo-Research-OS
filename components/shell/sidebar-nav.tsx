'use client'

import { useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  Calendar,
  FolderKanban,
  CheckSquare,
  Users,
  Shield,
  DollarSign,
  Activity,
  GraduationCap,
  BarChart3,
  Settings,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react'
import { cn } from '@/lib/utils'

type NavItem = {
  id: string
  label: string
  href: string
  icon: React.ElementType
  soon?: boolean
}

const navItems: NavItem[] = [
  { id: 'operations', label: 'Operations',  href: '/command-center', icon: Calendar },
  { id: 'studies',    label: 'Studies',     href: '/studies',    icon: FolderKanban },
  { id: 'tasks',      label: 'Tasks',       href: '/tasks',      icon: CheckSquare, soon: true },
  { id: 'recruitment',label: 'Recruitment', href: '/recruitment',icon: Users, soon: true },
  { id: 'regulatory', label: 'Regulatory',  href: '/regulatory', icon: Shield, soon: true },
  { id: 'financial',  label: 'Financial',   href: '/financial',  icon: DollarSign, soon: true },
  { id: 'vpi',        label: 'VPI',         href: '/performance', icon: Activity },
  { id: 'academy',    label: 'Academy',     href: '/academy',    icon: GraduationCap, soon: true },
  { id: 'reports',    label: 'Reports',     href: '/reports',    icon: BarChart3, soon: true },
  { id: 'admin',      label: 'Admin',       href: '/admin',      icon: Settings, soon: true },
]

/** Phase 7E sub-nav for the Command Center. Rendered when on /performance/*. */
const commandSubNav: { href: string; label: string }[] = [
  { href: '/performance',       label: 'Portfolio' },
  { href: '/performance/today', label: 'Today' },
  { href: '/performance/risks', label: 'Risks' },
]

type SidebarNavProps = {
  organizationName?: string | null
}

export function SidebarNav({ organizationName }: SidebarNavProps) {
  const [collapsed, setCollapsed] = useState(false)
  const pathname = usePathname()

  function isActive(item: NavItem): boolean {
    if (item.href === '/') return pathname === '/'
    return pathname === item.href || pathname.startsWith(`${item.href}/`)
  }

  const inCommandCenter =
    pathname === '/performance' || pathname.startsWith('/performance/')

  return (
    <aside
      className={cn(
        'h-screen flex flex-col flex-shrink-0 transition-all duration-300 overflow-hidden',
        collapsed ? 'w-16' : 'w-56',
      )}
      style={{ backgroundColor: '#10253e' }}
    >
      {/* Logo */}
      <div
        className={cn(
          'h-16 flex items-center flex-shrink-0',
          collapsed ? 'justify-center px-2' : 'justify-between px-4',
        )}
        style={{ borderBottom: '1px solid rgba(255,255,255,0.08)' }}
      >
        <div className="flex items-center gap-2.5">
          {/* Vilo layered hexagon mark */}
          <div
            className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0"
            style={{ backgroundColor: '#34a090' }}
          >
            <svg viewBox="0 0 24 24" fill="none" className="w-5 h-5 text-white">
              <path d="M12 2L2 7L12 12L22 7L12 2Z"   stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
              <path d="M2 17L12 22L22 17"             stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
              <path d="M2 12L12 17L22 12"             stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </div>
          {!collapsed && (
            <div className="flex items-baseline gap-1">
              <span className="text-base font-bold text-white tracking-tight">VILO</span>
              <span className="text-[10px] font-semibold uppercase tracking-[0.15em]" style={{ color: '#34a090' }}>OS</span>
            </div>
          )}
        </div>
        {!collapsed && (
          <button
            onClick={() => setCollapsed(true)}
            className="p-1.5 rounded-md hover:bg-white/5 transition-colors text-white/40 hover:text-white/70"
            aria-label="Collapse sidebar"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* Nav items */}
      <nav className="flex-1 py-3 px-2.5 space-y-0.5 overflow-y-auto scrollbar-thin">
        {navItems.map((item) => {
          const Icon = item.icon
          const active = isActive(item)
          const isVpi = item.id === 'vpi'

          return (
            <div key={item.id}>
              <Link
                href={item.soon ? '#' : item.href}
                className={cn(
                  'w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all',
                  active
                    ? 'bg-[#34a090]/15 text-[#34a090]'
                    : 'text-white/60 hover:text-white hover:bg-white/5',
                  item.soon && 'opacity-50 cursor-not-allowed pointer-events-none',
                )}
                aria-current={active ? 'page' : undefined}
                tabIndex={item.soon ? -1 : undefined}
              >
                <Icon className="w-[18px] h-[18px] flex-shrink-0" />
                {!collapsed && (
                  <>
                    <span className="flex-1 truncate">{item.label}</span>
                    {item.soon && (
                      <span className="text-[9px] font-semibold uppercase tracking-wide text-white/25">
                        soon
                      </span>
                    )}
                    {active && !item.soon && (
                      <div className="w-1.5 h-1.5 rounded-full bg-[#34a090] flex-shrink-0" />
                    )}
                  </>
                )}
              </Link>

              {/* Phase 7E — Command Center sub-nav, expanded under VPI when active */}
              {isVpi && inCommandCenter && !collapsed && (
                <div className="ml-7 mt-0.5 mb-1 space-y-0.5">
                  {commandSubNav.map((sub) => {
                    const subActive =
                      sub.href === '/performance'
                        ? pathname === '/performance'
                        : pathname === sub.href || pathname.startsWith(`${sub.href}/`)
                    return (
                      <Link
                        key={sub.href}
                        href={sub.href}
                        className={cn(
                          'block px-3 py-1.5 rounded-md text-xs font-medium transition-colors',
                          subActive
                            ? 'text-[#34a090] bg-[#34a090]/10'
                            : 'text-white/50 hover:text-white hover:bg-white/5',
                        )}
                        aria-current={subActive ? 'page' : undefined}
                      >
                        {sub.label}
                      </Link>
                    )
                  })}
                </div>
              )}
            </div>
          )
        })}
      </nav>

      {/* Expand button (collapsed state) */}
      {collapsed && (
        <div className="p-2 flex-shrink-0" style={{ borderTop: '1px solid rgba(255,255,255,0.08)' }}>
          <button
            onClick={() => setCollapsed(false)}
            className="w-full flex items-center justify-center py-2.5 rounded-lg text-white/40 hover:text-white/70 hover:bg-white/5 transition-colors"
            aria-label="Expand sidebar"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Site / org footer */}
      {!collapsed && (
        <div className="p-3 flex-shrink-0" style={{ borderTop: '1px solid rgba(255,255,255,0.08)' }}>
          <div className="flex items-center gap-3 px-3 py-2.5 rounded-lg bg-white/5">
            <div
              className="w-8 h-8 rounded-lg flex items-center justify-center text-white text-xs font-bold flex-shrink-0"
              style={{ backgroundColor: '#34a090' }}
            >
              VR
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-medium text-white truncate">
                {organizationName ?? 'Vilo Research Group'}
              </p>
              <p className="text-[10px] text-white/50">Houston Network</p>
            </div>
          </div>
        </div>
      )}
    </aside>
  )
}
