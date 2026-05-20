import type { ElementType } from 'react'
import Link from 'next/link'
import {
  Building2,
  Calendar,
  ChevronRight,
  FileStack,
  FolderKanban,
  Users,
  UserCog,
} from 'lucide-react'
import { cn } from '@/lib/utils'

export type AdminHubCard = {
  id: string
  title: string
  description: string
  href: string | null
  icon: ElementType
  status: 'active' | 'coming_soon'
  footnote?: string
}

export const ADMIN_HUB_CARDS: AdminHubCard[] = [
  {
    id: 'organization',
    title: 'Organization',
    description: 'Workspace profile, sites, and organization-level configuration.',
    href: null,
    icon: Building2,
    status: 'coming_soon',
  },
  {
    id: 'studies',
    title: 'Studies',
    description: 'Portfolio, study workspaces, and study creation (owner/admin).',
    href: '/studies',
    icon: FolderKanban,
    status: 'active',
  },
  {
    id: 'subjects',
    title: 'Subjects',
    description: 'Enrollment and subject charts live inside each study workspace.',
    href: '/studies',
    icon: Users,
    status: 'active',
    footnote: 'Open a study, then manage subjects from the study workspace.',
  },
  {
    id: 'team',
    title: 'Team / Users',
    description: 'Invite coordinators, assign roles, and manage organization membership.',
    href: '/admin/users',
    icon: UserCog,
    status: 'active',
  },
  {
    id: 'source-builder',
    title: 'Templates / Source Builder',
    description: 'Build and maintain study source document packages before publish.',
    href: '/source-builder',
    icon: FileStack,
    status: 'active',
  },
  {
    id: 'calendar',
    title: 'Operational Calendar',
    description: 'Manual events, availability blocks, and protocol visit reschedules.',
    href: '/operational-calendar',
    icon: Calendar,
    status: 'active',
  },
]

type AdminHubCardsProps = {
  organizations: { id: string; name: string; role: string }[]
}

export function AdminHubCards({ organizations }: AdminHubCardsProps) {
  return (
    <div className="space-y-8">
      <section className="rounded-xl border border-border bg-card p-4">
        <h2 className="text-sm font-semibold text-foreground">Admin scope</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Tools below apply to organizations where you are an owner or admin. Data access follows
          organization membership and database row-level security.
        </p>
        <ul className="mt-3 space-y-1.5">
          {organizations.map((org) => (
            <li key={org.id} className="text-sm text-foreground">
              <span className="font-medium">{org.name}</span>
              <span className="text-muted-foreground"> · {org.role}</span>
            </li>
          ))}
        </ul>
      </section>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {ADMIN_HUB_CARDS.map((card) => {
          const Icon = card.icon
          const isActive = card.status === 'active' && card.href

          const body = (
            <>
              <div className="flex items-start justify-between gap-3">
                <div
                  className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg"
                  style={{ backgroundColor: 'rgba(52, 160, 144, 0.12)' }}
                >
                  <Icon className="h-5 w-5 text-primary" />
                </div>
                {card.status === 'coming_soon' ? (
                  <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                    Coming soon
                  </span>
                ) : (
                  <ChevronRight className="h-4 w-4 flex-shrink-0 text-muted-foreground" />
                )}
              </div>
              <h3 className="mt-4 text-sm font-semibold text-foreground">{card.title}</h3>
              <p className="mt-1 text-sm text-muted-foreground">{card.description}</p>
              {card.footnote ? (
                <p className="mt-2 text-xs text-muted-foreground">{card.footnote}</p>
              ) : null}
            </>
          )

          if (isActive && card.href) {
            return (
              <Link
                key={card.id}
                href={card.href}
                className={cn(
                  'vilo-card-interactive block p-5 transition-colors',
                  'hover:border-primary/30',
                )}
              >
                {body}
              </Link>
            )
          }

          return (
            <div
              key={card.id}
              className="vilo-card block p-5 opacity-80"
              aria-disabled
            >
              {body}
            </div>
          )
        })}
      </div>
    </div>
  )
}
