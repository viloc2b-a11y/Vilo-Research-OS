'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  Building2,
  FileStack,
  FolderKanban,
  Settings,
  ShieldAlert,
  Users,
  CreditCard,
  FileText,
  Mail
} from 'lucide-react'
import { cn } from '@/lib/utils'

export function AdminSidebar({
  canAccessCRM = false,
  canAccessCommunications = false,
}: {
  canAccessCRM?: boolean
  canAccessCommunications?: boolean
}) {
  const pathname = usePathname()

  // Base navigation groups (unchanged)
  const NAVIGATION_GROUPS = [
    {
      title: 'Organization',
      items: [
        { name: 'Company Profile', href: '/admin/organization', icon: Building2 },
        { name: 'Sites / Locations', href: '/admin/organization/sites', icon: FolderKanban },
      ],
    },
    {
      title: 'Users & Access',
      items: [
        { name: 'Users', href: '/admin/users', icon: Users },
        { name: 'Roles & Permissions', href: '/admin/users-access/roles', icon: ShieldAlert },
        { name: 'Login Audit', href: '/admin/users-access/login-audit', icon: FileStack },
      ],
    },
    {
      title: 'Clinical Configuration',
      items: [
        { name: 'Visit Templates', href: '/admin/clinical-config/visits', icon: Settings },
        { name: 'Protocol Engineering', href: '/admin/protocol-engineering', icon: FileStack },
      ],
    },
    {
      title: 'Study Operations',
      items: [
        { name: 'Sponsors & CROs', href: '/admin/study-ops-config/sponsors', icon: Building2 },
        { name: 'Vendors', href: '/admin/study-ops-config/vendors', icon: Users },
      ],
    },
    {
      title: 'Finance & eDocs',
      items: [
        { name: 'Invoice Formats', href: '/admin/finance-edocs-config/invoices', icon: CreditCard },
        { name: 'eDocs Templates', href: '/admin/finance-edocs-config/edocs', icon: FileText },
      ],
    },
  ]

  // New Operations group – rendered conditionally based on RBAC flags
  const OPS_GROUP = {
    title: 'Operations',
    items: [
      canAccessCRM && { name: 'CRM', href: '/ops/crm', icon: Users },
      canAccessCommunications && { name: 'Communications', href: '/ops/communications', icon: Mail },
    ].filter(Boolean),
  }

  const groups = OPS_GROUP.items.length ? [...NAVIGATION_GROUPS, OPS_GROUP] : NAVIGATION_GROUPS

  return (
    <aside className="w-full shrink-0 border-r border-border bg-card lg:w-64">
      <div className="flex h-full flex-col">
        <div className="p-4 border-b border-border">
          <h2 className="text-base font-semibold text-foreground">Admin Center</h2>
        </div>
        <div className="flex-1 overflow-y-auto p-4 scrollbar-thin">
          <nav className="space-y-6">
            {groups.map((group) => (
              <div key={group.title}>
                <h3 className="mb-2 px-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  {group.title}
                </h3>
                <ul className="space-y-1">
                  {group.items.filter(Boolean).map((item: any) => {
                    const isActive = pathname === item.href || pathname?.startsWith(`${item.href}/`)
                    const Icon = item.icon
                    return (
                      <li key={item.name}>
                        <Link
                          href={item.href}
                          className={cn(
                            'group flex items-center gap-3 rounded-md px-2 py-1.5 text-sm font-medium transition-colors',
                            isActive ? 'bg-primary/10 text-primary' : 'text-muted-foreground hover:bg-accent hover:text-foreground'
                          )}
                        >
                          <Icon className={cn('h-4 w-4 flex-shrink-0', isActive ? 'text-primary' : 'text-muted-foreground group-hover:text-foreground')} />
                          {item.name}
                        </Link>
                      </li>
                    )
                  })}
                </ul>
              </div>
            ))}
          </nav>
        </div>
      </div>
    </aside>
  )
}
