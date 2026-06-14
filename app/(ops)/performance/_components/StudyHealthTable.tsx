'use client'

import Link from 'next/link'
import { useState } from 'react'
import { cn } from '@/lib/utils'
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
                  <th className="pb-2 pr-4 font-medium">Needs attention today</th>
                  <th className="pb-2 pr-4 font-medium">Leakage</th>
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
        <td className="py-3 pr-4 text-muted-foreground">{formatNeedsAttentionToday(card)}</td>
        <td className="py-3 pr-4">
          {(card.leakageScore ?? 0) > 0 ? (
            <span
              className={cn(
                'inline-block rounded px-1.5 py-0.5 text-xs font-semibold tabular-nums',
                (card.leakageScore ?? 0) >= 70
                  ? 'bg-destructive/10 text-destructive'
                  : (card.leakageScore ?? 0) >= 40
                    ? 'bg-orange-100 text-orange-700 dark:bg-orange-950 dark:text-orange-400'
                    : 'bg-yellow-50 text-yellow-700 dark:bg-yellow-950 dark:text-yellow-400',
              )}
            >
              {card.leakageScore}
            </span>
          ) : (
            <span className="text-muted-foreground">—</span>
          )}
        </td>
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
          <td colSpan={6} className="px-4 py-3">
            <dl className="grid gap-2 text-xs sm:grid-cols-2 lg:grid-cols-3">
              <Detail label="Subjects" value={String(card.subjectCount)} />
              <Detail
                label="Enrolled"
                value={String(card.enrolledCount ?? card.subjectCount)}
              />
              <Detail label="Screening" value={String(card.screeningCount ?? 0)} />
              <Detail label="Randomized" value={String(card.randomizedCount ?? 0)} />
              <Detail
                label="Source attributed"
                value={String(card.attributedSubjectCount ?? 0)}
              />
              <Detail
                label="Source missing"
                value={String(card.unattributedSubjectCount ?? 0)}
              />
              <Detail
                label="Enrollment target"
                value={card.enrollmentTarget ? String(card.enrollmentTarget) : '—'}
              />
              <Detail
                label="Enrollment closes"
                value={card.enrollmentEndDate?.slice(0, 10) ?? '—'}
              />
              <Detail
                label="Budget evidence"
                value={String(card.budgetEvidenceDocumentCount ?? 0)}
              />
              <Detail
                label="CTA evidence"
                value={String(card.contractEvidenceDocumentCount ?? 0)}
              />
              <Detail
                label="Active budget refs"
                value={String(
                  (card.activeBudgetReferenceCount ?? 0) +
                    (card.activeContractReferenceCount ?? 0),
                )}
              />
              <Detail
                label="Financial leakage"
                value={String(card.financialLeakageCount ?? 0)}
              />
              <Detail
                label="Leakage score"
                value={
                  (card.leakageScore ?? 0) > 0
                    ? String(card.leakageScore)
                    : '—'
                }
              />
              <Detail
                label="Budget negotiation"
                value={
                  card.budgetNegotiationReadiness
                    ? card.budgetNegotiationReadiness.replace('_', ' ')
                    : '—'
                }
              />
              <Detail
                label="Negotiation next step"
                value={card.budgetNegotiationNextStep ?? '—'}
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
