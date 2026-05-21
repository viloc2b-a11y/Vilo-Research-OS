import Link from 'next/link'
import type { LucideIcon } from 'lucide-react'
import { buttonVariants } from '@/components/ui/button'
import { cn } from '@/lib/utils'

type VisitClinicalLinkPanelProps = {
  icon: LucideIcon
  title: string
  description: string
  primaryLabel: string
  primaryHref: string
  secondaryNote?: string
}

export function VisitClinicalLinkPanel({
  icon: Icon,
  title,
  description,
  primaryLabel,
  primaryHref,
  secondaryNote,
}: VisitClinicalLinkPanelProps) {
  return (
    <div className="vilo-card max-w-[900px] p-6">
      <div className="flex items-start gap-4">
        <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg bg-muted">
          <Icon className="h-5 w-5 text-primary" />
        </div>
        <div className="min-w-0 flex-1 space-y-3">
          <div>
            <h2 className="text-sm font-semibold text-foreground">{title}</h2>
            <p className="mt-1 text-sm text-muted-foreground">{description}</p>
            {secondaryNote ? (
              <p className="mt-2 text-xs text-muted-foreground">{secondaryNote}</p>
            ) : null}
          </div>
          <Link href={primaryHref} className={cn(buttonVariants({ variant: 'default' }))}>
            {primaryLabel}
          </Link>
        </div>
      </div>
    </div>
  )
}

type VisitGuidancePanelProps = {
  icon: LucideIcon
  title: string
  description: string
  actions: { label: string; href: string; variant?: 'default' | 'outline' }[]
}

export function VisitGuidancePanel({
  icon: Icon,
  title,
  description,
  actions,
}: VisitGuidancePanelProps) {
  return (
    <div className="vilo-card max-w-[900px] p-6">
      <div className="flex items-start gap-4">
        <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg bg-muted">
          <Icon className="h-5 w-5 text-muted-foreground" />
        </div>
        <div className="min-w-0 flex-1 space-y-3">
          <div>
            <h2 className="text-sm font-semibold text-foreground">{title}</h2>
            <p className="mt-1 text-sm text-muted-foreground">{description}</p>
          </div>
          <div className="flex flex-wrap gap-2">
            {actions.map((action) => (
              <Link
                key={action.href}
                href={action.href}
                className={cn(
                  buttonVariants({ variant: action.variant ?? 'default' }),
                )}
              >
                {action.label}
              </Link>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
