'use client'

import { useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  Calendar,
  FolderKanban,
  CheckSquare,
  Users,
  Mail,
  Shield,
  DollarSign,
  Activity,
  GraduationCap,
  BarChart3,
  Settings,
  FileSearch,
  ClipboardList,
  Scale,
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
  availability?: string
  /** Shown to all authenticated org members (e.g. Studies). */
  allMembers?: boolean
  /** Coordinator / data-coordinator workspace items. */
  coordinatorWorkspace?: boolean
  /** CRM workspaces. */
  crm?: boolean
  /** Communications / mail shell. */
  communications?: boolean
  /** Source builder and eSource draft workflows. */
  sourceWorkflow?: boolean
  /** Financial workspaces. */
  financial?: boolean
  /** VPI command center — hidden from data_coordinator and read-only personas. */
  vpi?: boolean
}

type NavSection = {
  id: string
  label: string
  items: NavItem[]
}

const navSections: NavSection[] = [
  {
    id: 'work-today',
    label: 'Work Today',
    items: [
  { id: 'operations', label: 'Operations',  href: '/command-center', icon: Calendar, coordinatorWorkspace: true },
  { id: 'calendar',   label: 'Operational Calendar', href: '/operational-calendar', icon: Calendar, coordinatorWorkspace: true },
  { id: 'studies',    label: 'Studies',     href: '/studies',    icon: FolderKanban, allMembers: true },
    ],
  },
  {
    id: 'build-documents',
    label: 'Build / Documents',
    items: [
  { id: 'study-setup', label: 'Study Setup', href: '/studies', icon: ClipboardList, coordinatorWorkspace: true },
  { id: 'document-center', label: 'Document Center', href: '/document-center', icon: FileSearch, coordinatorWorkspace: true },
  {
    id: 'document-intelligence',
    label: 'Study Copilot',
    href: '/document-intelligence',
    icon: FileSearch,
    coordinatorWorkspace: true,
  },
    ],
  },
  {
    id: 'crm-communications',
    label: 'CRM / Communications',
    items: [
  { id: 'contacts', label: 'Contacts', href: '/contacts', icon: Users, crm: true },
  { id: 'crm', label: 'CRM', href: '/crm', icon: Users, crm: true },
  { id: 'communications', label: 'Communications', href: '/communications', icon: Mail, communications: true },
    ],
  },
  {
    id: 'oversight',
    label: 'Oversight',
    items: [
  { id: 'signatures', label: 'Signatures', href: '/operational-signatures', icon: ClipboardList, coordinatorWorkspace: true },
  { id: 'negotiation', label: 'Negotiation', href: '/negotiation', icon: Scale, financial: true },
  { id: 'deliverables', label: 'Deliverables', href: '/deliverables', icon: ClipboardList, coordinatorWorkspace: true },
  { id: 'scientific-events', label: 'Scientific Events', href: '/scientific-events', icon: Calendar, crm: true },
  { id: 'governance', label: 'Governance', href: '/governance', icon: Shield, soon: true, availability: 'Governance is not wired into the live ops shell yet.' },
  { id: 'vpi',        label: 'VPI',         href: '/performance', icon: Activity, vpi: true },
    ],
  },
  {
    id: 'planned',
    label: 'Planned',
    items: [
  { id: 'tasks',      label: 'Tasks',       href: '/tasks',      icon: CheckSquare, soon: true, availability: 'Planned for the next operational workflow release.' },
  { id: 'recruitment',label: 'Recruitment', href: '/recruitment',icon: Users, soon: true, availability: 'Planned after coordinator cockpit stabilization.' },
  { id: 'regulatory', label: 'Regulatory',  href: '/regulatory', icon: Shield, soon: true, availability: 'Regulatory workspace is planned for an upcoming release.' },
  { id: 'financial',  label: 'Financial',   href: '/financial',  icon: DollarSign, soon: true, availability: 'ClinIQ financial workspace is planned for a later internal release.' },
  { id: 'academy',    label: 'Academy',     href: '/academy',    icon: GraduationCap, soon: true, availability: 'Training content is not enabled in this internal deployment.' },
  { id: 'reports',    label: 'Reports',     href: '/reports',    icon: BarChart3, soon: true, availability: 'Reports will follow the operational read-model hardening phase.' },
    ],
  },
]

const adminNavItem: NavItem = {
  id: 'admin',
  label: 'Admin',
  href: '/admin',
  icon: Settings,
}

/** Phase 7E sub-nav for the Command Center. Rendered when on /performance/*. */
const commandSubNav: { href: string; label: string }[] = [
  { href: '/performance',       label: 'Portfolio' },
  { href: '/performance/today', label: 'Today' },
  { href: '/performance/risks', label: 'Risks' },
]

type SidebarNavProps = {
  organizationName?: string | null
  canAccessAdmin?: boolean
  canViewFinancial?: boolean
  canAccessCoordinatorWorkspace?: boolean
  canAccessCRM?: boolean
  canAccessCommunications?: boolean
  canAccessSourceWorkflow?: boolean
  canViewVpi?: boolean
}

export function SidebarNav({
  organizationName,
  canAccessAdmin = false,
  canViewFinancial = false,
  canAccessCoordinatorWorkspace = false,
  canAccessCRM = false,
  canAccessCommunications = false,
  canAccessSourceWorkflow = false,
  canViewVpi = false,
}: SidebarNavProps) {
  const [collapsed, setCollapsed] = useState(false)
  const pathname = usePathname()

  function isActive(item: NavItem): boolean {
    if (item.href === '/') return pathname === '/'
    return pathname === item.href || pathname.startsWith(`${item.href}/`)
  }

  const inCommandCenter =
    pathname === '/performance' || pathname.startsWith('/performance/')

  function canShowItem(item: NavItem) {
    if (item.id === 'financial') return canViewFinancial
    if (item.allMembers) return true
    if (item.coordinatorWorkspace && !canAccessCoordinatorWorkspace) return false
    if (item.crm && !canAccessCRM) return false
    if (item.communications && !canAccessCommunications) return false
    if (item.sourceWorkflow && !canAccessSourceWorkflow) return false
    if (item.financial && !canViewFinancial) return false
    if (item.vpi && !canViewVpi) return false
    return true
  }

  const visibleSections = navSections
    .map((section) => ({
      ...section,
      items: section.items.filter(canShowItem),
    }))
    .filter((section) => section.items.length > 0)

  if (canAccessAdmin) {
    visibleSections.push({
      id: 'admin',
      label: 'Admin',
      items: [adminNavItem],
    })
  }

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
        {visibleSections.map((section) => (
          <div key={section.id} className="space-y-0.5">
            {!collapsed ? (
              <p className="px-3 pb-1 pt-3 text-[10px] font-semibold uppercase tracking-[0.16em] text-white/30 first:pt-0">
                {section.label}
              </p>
            ) : null}
            {section.items.map((item) => {
              const Icon = item.icon
              const active = isActive(item)
              const isVpi = item.id === 'vpi'

              return (
                <div key={item.id} title={item.soon ? item.availability : undefined}>
                  <Link
                    href={item.soon ? '#' : item.href}
                    className={cn(
                      'w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all',
                      active
                        ? 'bg-[#34a090]/15 text-[#34a090]'
                        : 'text-white/60 hover:text-white hover:bg-white/5',
                      item.soon && 'opacity-45 cursor-not-allowed pointer-events-none',
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
          </div>
        ))}
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
