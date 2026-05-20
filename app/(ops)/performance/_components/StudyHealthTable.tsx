'use client'

import Link from 'next/link'
import { useState } from 'react'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { OperationalStateBadge } from '@/app/(ops)/performance/_components/OperationalStateBadge'
import { performanceScopeDescription } from '@/app/(ops)/performance/_lib/performance-risk'
import type {
  PerformanceLoadStatus,
  StudyPerformanceCard,
} from '@/app/(ops)/performance/_lib/performance-types'
import {
  formatCriticalIssues,
  formatNeedsAttentionToday,
} from '@/lib/performance/portfolio'
import type { OperationalState } from '@/lib/performance/scoring/types'
import { recommendedActionLabel } from '@/lib/performance/scoring/recommended-actions'

type StudyHealthTableProps = {
  cards: StudyPerformanceCard[]
  status: PerformanceLoadStatus
  loadFailed: boolean
  selectedStudyName: string | null
}

export function StudyHealthTable({
  cards,
  status,
  loadFailed,
  selectedStudyName,
}: StudyHealthTableProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Study health</CardTitle>
        <CardDescription>
          Portfolio operational state — critical issues and today&apos;s attention.{' '}
          {performanceScopeDescription(selectedStudyName)}
        </CardDescription>
      </CardHeader>
      <CardContent>
        {loadFailed ? (
          <p className="text-sm text-destructive">
            Study metrics are unavailable due to a query error. See the banner above.
          </p>
        ) : cards.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            {status === 'empty'
              ? 'No studies are in scope for your organization.'
              : 'No study metrics match the current filter.'}
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] text-sm">
              <thead>
                <tr className="border-b text-left text-xs text-muted-foreground">
                  <th className="pb-2 pr-4 font-medium">Study</th>
                  <th className="pb-2 pr-4 font-medium">State</th>
                  <th className="pb-2 pr-4 font-medium">Critical issues</th>
                  <th className="pb-2 font-medium">Needs attention today</th>
                  <th className="pb-2 pl-2 font-medium" aria-label="Expand" />
                </tr>
              </thead>
              <tbody>
                {cards.map((card) => (
                  <StudyHealthRow key={card.studyId} card={card} />
                ))}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

function StudyHealthRow({ card }: { card: StudyPerformanceCard }) {
  const [open, setOpen] = useState(false)
  const state: OperationalState = card.operationalState ?? 'healthy'

  return (
    <>
      <tr className="border-b align-top">
        <td className="py-3 pr-4">
          <Link href={card.href} className="font-medium text-primary hover:underline">
            {card.studyName}
          </Link>
        </td>
        <td className="py-3 pr-4">
          <OperationalStateBadge state={state} />
        </td>
        <td className="py-3 pr-4 text-muted-foreground">{formatCriticalIssues(card)}</td>
        <td className="py-3 text-muted-foreground">{formatNeedsAttentionToday(card)}</td>
        <td className="py-3 pl-2">
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            className="text-xs font-medium text-primary hover:underline"
            aria-expanded={open}
          >
            {open ? 'Hide' : 'Details'}
          </button>
        </td>
      </tr>
      {open ? (
        <tr className="border-b bg-muted/30">
          <td colSpan={5} className="px-4 py-3">
            <dl className="grid gap-2 text-xs sm:grid-cols-2 lg:grid-cols-3">
              <Detail label="Subjects" value={String(card.subjectCount)} />
              <Detail
                label="Enrolled"
                value={String(card.enrolledCount ?? card.subjectCount)}
              />
              <Detail label="Active visits" value={String(card.activeVisitCount)} />
              <Detail label="Open queries" value={String(card.openQueryCount)} />
              <Detail
                label="Open findings"
                value={String(card.openFindingsCount ?? 0)}
              />
              <Detail
                label="Last activity"
                value={card.lastActivityAt?.slice(0, 10) ?? '—'}
              />
              {card.recommendedAction ? (
                <Detail
                  label="Recommended action"
                  value={recommendedActionLabel(card.recommendedAction)}
                />
              ) : null}
            </dl>
          </td>
        </tr>
      ) : null}
    </>
  )
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="font-medium text-foreground">{value}</dd>
    </div>
  )
}
