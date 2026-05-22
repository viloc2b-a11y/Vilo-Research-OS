'use client'

import { useTransition } from 'react'
import { useRouter } from 'next/navigation'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import type {
  IntakeReviewPackage,
  ReviewSectionId,
  ReviewWorkspaceState,
} from '@/lib/protocol-intake-review/types'
import {
  acceptHighConfidenceInSectionAction,
  approveSectionAction,
} from '@/lib/protocol-intake-review/actions'
import { ReviewItemCard } from '@/components/source-builder/intake-review/review-item-card'

const SECTION_TITLES: Record<ReviewSectionId, string> = {
  study_metadata: 'Study metadata',
  visits: 'Visits',
  procedures: 'Procedures',
  source_composition: 'Source sections',
  eligibility: 'Eligibility',
  missing: 'Missing information',
  conflicts: 'Conflicts',
  approval_summary: 'Approval summary',
}

export function ReviewSectionPanel(props: {
  draft_key: string
  section: ReviewSectionId
  pkg: IntakeReviewPackage
  workspace: ReviewWorkspaceState
}) {
  const { draft_key, section, pkg, workspace } = props
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const items = pkg.items.filter((i) => i.section === section)
  const sectionState = workspace.sections[section]

  function refresh() {
    router.refresh()
  }

  if (section === 'approval_summary') {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">{SECTION_TITLES[section]}</CardTitle>
          <CardDescription>
            Generate the approved handoff artifact after all operational sections are approved.
          </CardDescription>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground">
          <p>Accepted: {workspace.audit.filter((a) => a.reviewer_status === 'edited').length} edits logged</p>
          <p className="mt-2">
            Rejected items are retained in the approved artifact under rejected_items for audit.
          </p>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card id={`section-${section}`}>
      <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-2">
        <div>
          <CardTitle className="text-lg">{SECTION_TITLES[section]}</CardTitle>
          <CardDescription>
            {items.length} item(s) · Section status:{' '}
            <Badge variant="outline">{sectionState?.section_status ?? 'pending'}</Badge>
          </CardDescription>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            size="sm"
            variant="outline"
            disabled={pending}
            onClick={() =>
              startTransition(async () => {
                await acceptHighConfidenceInSectionAction({ draft_key, section })
                refresh()
              })
            }
          >
            Accept all high-confidence
          </Button>
          <Button
            size="sm"
            disabled={pending || sectionState?.section_status === 'approved'}
            onClick={() =>
              startTransition(async () => {
                await approveSectionAction({ draft_key, section })
                refresh()
              })
            }
          >
            Approve section
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {items.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nothing in this section.</p>
        ) : (
          items.map((item) => (
            <ReviewItemCard
              key={item.item_id}
              draft_key={draft_key}
              item={item}
              state={workspace.items[item.item_id]}
              onUpdated={refresh}
            />
          ))
        )}
      </CardContent>
    </Card>
  )
}
