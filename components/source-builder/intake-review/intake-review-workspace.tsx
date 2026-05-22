'use client'

import { useTransition } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { buttonVariants } from '@/components/ui/button'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { cn } from '@/lib/utils'
import type { IntakeReviewPackage, ReviewWorkspaceState } from '@/lib/protocol-intake-review/types'
import { REVIEW_SAFETY } from '@/lib/protocol-intake-review/types'
import { generateApprovedDraftAction } from '@/lib/protocol-intake-review/actions'
import { ReviewSectionPanel } from '@/components/source-builder/intake-review/review-section-panel'

const SECTION_ORDER = [
  'study_metadata',
  'visits',
  'procedures',
  'source_composition',
  'eligibility',
  'missing',
  'conflicts',
  'approval_summary',
] as const

export function IntakeReviewWorkspace(props: {
  pkg: IntakeReviewPackage
  workspace: ReviewWorkspaceState
  hasApprovedArtifact: boolean
}) {
  const { pkg, workspace, hasApprovedArtifact } = props
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const summary = pkg.summary

  return (
    <div className="space-y-6">
      <header className="space-y-2">
        <Link
          href="/source-builder/intake"
          className={cn(buttonVariants({ variant: 'outline', size: 'sm' }))}
        >
          ← Intake drafts
        </Link>
        <h1 className="text-2xl font-semibold tracking-tight">
          Review: {pkg.package_label}
        </h1>
        <p className="max-w-3xl text-sm text-muted-foreground">
          Human review workspace — edit, accept, or reject each proposal. Nothing here publishes
          or binds to runtime.
        </p>
        <div className="flex flex-wrap gap-2 text-xs">
          <span className="rounded border border-red-500/30 bg-red-500/10 px-2 py-1 font-medium text-red-900 dark:text-red-200">
            Not published · Not bound
          </span>
          {hasApprovedArtifact ? (
            <>
              <span className="rounded border border-emerald-500/30 bg-emerald-500/10 px-2 py-1">
                Approved artifact on file
              </span>
              <Link
                href={`/source-builder/intake/publish-prep/${pkg.draft_key}`}
                className={cn(buttonVariants({ size: 'sm' }))}
              >
                Continue to publish prep →
              </Link>
            </>
          ) : null}
        </div>
      </header>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Coordinator summary</CardTitle>
          <CardDescription>From intake — not technical parser output</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 text-sm">
          <SummaryList title="Found" items={summary.found} />
          <SummaryList title="Needs review" items={summary.needs_review} />
          <SummaryList title="Missing" items={summary.missing} />
          <SummaryList title="Conflicts" items={summary.conflicts} />
          <SummaryList
            title="Recommended source sections"
            items={summary.recommended_source_sections}
          />
        </CardContent>
      </Card>

      <Card className="border-dashed">
        <CardHeader>
          <CardTitle className="text-lg">Finalize approved draft</CardTitle>
          <CardDescription>
            Writes approved_intake_draft.json and review_audit.json under data/intake-review-workspaces/
            {pkg.draft_key}/. Requires all operational sections approved.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap items-center gap-3">
          <Button
            disabled={pending}
            onClick={() =>
              startTransition(async () => {
                await generateApprovedDraftAction(pkg.draft_key)
                router.refresh()
              })
            }
          >
            Generate approved draft
          </Button>
          <p className="text-xs text-muted-foreground">
            Safety: publish={String(REVIEW_SAFETY.auto_publish)}, bind=
            {String(REVIEW_SAFETY.auto_bind)}, runtime=
            {String(REVIEW_SAFETY.runtime_mutation)}
          </p>
        </CardContent>
      </Card>

      <nav className="flex flex-wrap gap-2 text-sm">
        {SECTION_ORDER.map((s) => (
          <a
            key={s}
            href={`#section-${s}`}
            className="rounded-md border border-border px-2 py-1 hover:bg-muted"
          >
            {s.replace(/_/g, ' ')}
          </a>
        ))}
      </nav>

      {SECTION_ORDER.map((section) => (
        <ReviewSectionPanel
          key={section}
          draft_key={pkg.draft_key}
          section={section}
          pkg={pkg}
          workspace={workspace}
        />
      ))}
    </div>
  )
}

function SummaryList({ title, items }: { title: string; items: string[] }) {
  return (
    <div>
      <p className="font-medium">{title}</p>
      <ul className="mt-1 list-inside list-disc text-muted-foreground">
        {(items.length ? items : ['None']).slice(0, 12).map((item) => (
          <li key={item}>{item}</li>
        ))}
      </ul>
    </div>
  )
}
