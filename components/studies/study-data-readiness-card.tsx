'use client'

import { useActionState, useEffect, useState } from 'react'
import Link from 'next/link'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  runStudyDataReadinessReviewAction,
  type StudyDataReadinessActionResult,
} from '@/lib/site-intelligence/study-data-readiness-actions'
import type { StudyDataReadinessResult } from '@/lib/site-intelligence/study-data-readiness-adapter'

export function StudyDataReadinessCard(props: {
  studyId: string
  organizationId: string
  initialReadiness: StudyDataReadinessResult | null
  initialCreatedAt: string | null
}) {
  const [acknowledgeWarnings, setAcknowledgeWarnings] = useState(false)
  const [state, formAction, pending] = useActionState<StudyDataReadinessActionResult | null, FormData>(
    runStudyDataReadinessReviewAction,
    props.initialReadiness
      ? {
          success: true,
          readiness: props.initialReadiness,
          reviewId: 'latest',
          createdAt: props.initialCreatedAt ?? props.initialReadiness.checkedAt,
        }
      : null,
  )

  useEffect(() => {
    setAcknowledgeWarnings(false)
  }, [state?.success, state?.readiness?.checkedAt])

  const readiness = state?.success ? state.readiness : props.initialReadiness
  const status = readiness?.status ?? 'ready'

  return (
    <section className="vilo-card p-5" id="study-data-readiness">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h3 className="text-sm font-semibold text-foreground">Study Data Readiness</h3>
          <p className="mt-1 text-xs text-muted-foreground">
            Run a site-first readiness review before external monitoring or workbook generation.
          </p>
        </div>
        <Badge variant={status === 'blocked' ? 'destructive' : status === 'ready_with_warnings' ? 'outline' : 'default'}>
          {status === 'ready' ? 'READY' : status === 'ready_with_warnings' ? 'READY WITH WARNINGS' : 'BLOCKED'}
        </Badge>
      </div>

      <form action={formAction} className="mt-4 space-y-4">
        <input type="hidden" name="studyId" value={props.studyId} />
        <input type="hidden" name="organizationId" value={props.organizationId} />
        <input type="hidden" name="mode" value="internal_review" />

        <div className="flex items-center gap-3">
          <Button type="submit" size="sm" disabled={pending}>
            {pending ? 'Running…' : 'Run Data Readiness Review'}
          </Button>
          {state?.success ? (
            <span className="text-xs text-muted-foreground">
              Last run {new Date(state.createdAt).toLocaleString()}
            </span>
          ) : props.initialCreatedAt ? (
            <span className="text-xs text-muted-foreground">
              Last run {new Date(props.initialCreatedAt).toLocaleString()}
            </span>
          ) : null}
        </div>

        {status === 'ready_with_warnings' ? (
          <label className="flex items-center gap-2 text-xs text-muted-foreground">
            <input
              type="checkbox"
              checked={acknowledgeWarnings}
              onChange={(event) => setAcknowledgeWarnings(event.target.checked)}
            />
            Acknowledge warnings before workbook generation
          </label>
        ) : null}
      </form>

      {readiness ? (
        <div className="mt-4 space-y-4">
          <div className="grid gap-3 sm:grid-cols-4">
            <SummaryStat label="Subjects reviewed" value={readiness.subjectsReviewed} />
            <SummaryStat label="Visits reviewed" value={readiness.visitsReviewed} />
            <SummaryStat label="Blocking issues" value={readiness.blockersCount} tone={readiness.blockersCount > 0 ? 'text-red-600' : 'text-foreground'} />
            <SummaryStat label="Warnings" value={readiness.warningsCount} tone={readiness.warningsCount > 0 ? 'text-amber-600' : 'text-foreground'} />
          </div>

          <ReadinessSection
            title="Consent"
            findings={readiness.findings.consent}
          />
          <ReadinessSection
            title="Signatures"
            findings={readiness.findings.signature}
          />
          <ReadinessSection
            title="Source Completion"
            findings={readiness.findings.source}
          />
          <ReadinessSection
            title="Visit Readiness"
            findings={readiness.findings.visit}
          />
          <ReadinessSection
            title="Version / Source Package"
            findings={readiness.findings.version}
          />
          <ReadinessSection
            title="Document Lineage"
            findings={readiness.findings.document_lineage}
          />

          {state?.success ? (
            <div className="rounded-md border border-border p-3 text-xs text-muted-foreground">
              Review saved successfully.
              {' '}
              <Link href={`/studies/${props.studyId}`} className="text-primary underline">
                Reload study workspace
              </Link>
              .
            </div>
          ) : null}
        </div>
      ) : (
        <p className="mt-4 text-xs text-muted-foreground">No saved readiness review yet.</p>
      )}
    </section>
  )
}

function SummaryStat(props: { label: string; value: number; tone?: string }) {
  return (
    <div className="rounded-md border border-border/60 bg-background p-3">
      <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">{props.label}</p>
      <p className={`mt-1 text-lg font-semibold ${props.tone ?? 'text-foreground'}`}>{props.value}</p>
    </div>
  )
}

function ReadinessSection(props: {
  title: string
  findings: StudyDataReadinessResult['findings'][keyof StudyDataReadinessResult['findings']]
}) {
  if (props.findings.length === 0) {
    return (
      <div className="rounded-md border border-border/60 bg-background p-3">
        <p className="text-xs font-medium text-foreground">{props.title}</p>
        <p className="mt-1 text-xs text-muted-foreground">No findings.</p>
      </div>
    )
  }

  return (
    <div className="rounded-md border border-border/60 bg-background p-3">
      <p className="text-xs font-medium text-foreground">{props.title}</p>
      <div className="mt-2 space-y-2">
        {props.findings.map((finding) => (
          <div key={finding.id} className="rounded border border-border/60 p-3">
            <div className="flex items-start justify-between gap-3">
              <div className="space-y-1">
                <p className="text-sm text-foreground">
                  {finding.subjectIdentifier ? `${finding.subjectIdentifier} · ` : ''}
                  {finding.visitName ? `${finding.visitName} · ` : ''}
                  {finding.issue}
                </p>
                <p className="text-xs text-muted-foreground">{finding.nextAction}</p>
              </div>
              <div className="flex shrink-0 flex-col items-end gap-2">
                <Badge variant={finding.severity === 'blocker' ? 'destructive' : finding.severity === 'warning' ? 'outline' : 'secondary'}>
                  {finding.severity.toUpperCase()}
                </Badge>
                {finding.severity !== 'info' && finding.targetRoute ? (
                  <Link
                    href={finding.targetRoute}
                    className="text-xs font-medium text-primary underline underline-offset-4"
                  >
                    [ Fix Now ]
                  </Link>
                ) : null}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
