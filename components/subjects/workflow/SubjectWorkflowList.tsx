'use client'

import Link from 'next/link'
import { useActionState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import {
  INITIAL_WORKFLOW_ACTION_STATE,
  resolveSubjectWorkflowAction,
} from '@/lib/subject/workflow/actions'
import type { SubjectWorkflowAction } from '@/lib/subject/workflow/types'

type SubjectWorkflowListProps = {
  title: string
  actions: SubjectWorkflowAction[]
  organizationId: string
  studyId: string
  subjectId: string
}

function badge(value: string) {
  return value.replace(/_/g, ' ')
}

function isUnresolved(action: SubjectWorkflowAction) {
  return action.status === 'open' || action.status === 'in_progress'
}

function ResolveForm({
  action,
  organizationId,
  studyId,
  subjectId,
}: {
  action: SubjectWorkflowAction
  organizationId: string
  studyId: string
  subjectId: string
}) {
  const [state, formAction, pending] = useActionState(
    resolveSubjectWorkflowAction,
    INITIAL_WORKFLOW_ACTION_STATE,
  )

  if (!isUnresolved(action)) {
    return action.resolvedAt ? (
      <span className="text-xs text-muted-foreground">Resolved {action.resolvedAt}</span>
    ) : null
  }

  return (
    <form action={formAction} className="flex flex-wrap items-center gap-2">
      <input type="hidden" name="workflow_action_id" value={action.id} />
      <input type="hidden" name="organization_id" value={organizationId} />
      <input type="hidden" name="study_id" value={studyId} />
      <input type="hidden" name="study_subject_id" value={subjectId} />
      {action.visitId ? <input type="hidden" name="visit_id" value={action.visitId} /> : null}
      <input
        name="resolution_note"
        className="h-8 min-w-[10rem] flex-1 rounded-md border bg-background px-2 text-xs"
        placeholder="Resolution note"
      />
      <Button type="submit" size="sm" variant="outline" disabled={pending}>
        Resolve
      </Button>
      {state.message ? <span className="text-xs text-muted-foreground">{state.message}</span> : null}
    </form>
  )
}

export function SubjectWorkflowList({
  title,
  actions,
  organizationId,
  studyId,
  subjectId,
}: SubjectWorkflowListProps) {
  useEffect(() => {
    if (typeof window === 'undefined' || !window.location.hash.startsWith('#workflow-')) return
    const id = window.location.hash.slice(1)
    const el = document.getElementById(id)
    el?.scrollIntoView({ behavior: 'smooth', block: 'center' })
    el?.classList.add('ring-2', 'ring-primary')
  }, [actions])

  return (
    <section className="rounded-md border bg-background">
      <div className="border-b px-4 py-3">
        <h3 className="text-sm font-semibold">{title}</h3>
      </div>
      {actions.length === 0 ? (
        <p className="px-4 py-6 text-sm text-muted-foreground">No workflow activity in this group.</p>
      ) : (
        <ul className="divide-y">
          {actions.map((action) => {
            const open = isUnresolved(action)
            return (
              <li
                key={action.id}
                id={`workflow-${action.id}`}
                className={`space-y-2 px-4 py-3 transition-shadow ${open ? 'bg-amber-50/40 dark:bg-amber-950/20' : ''}`}
              >
                <div className="flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="rounded bg-muted px-2 py-0.5 text-xs font-medium">
                        {badge(action.actionType)}
                      </span>
                      <span className="rounded bg-muted px-2 py-0.5 text-xs">{badge(action.status)}</span>
                      <span className="rounded bg-muted px-2 py-0.5 text-xs">{action.priority}</span>
                      {open && action.assignedRole ? (
                        <span className="rounded bg-primary/15 px-2 py-0.5 text-xs font-medium text-primary">
                          Assigned {action.assignedRole.toUpperCase()}
                        </span>
                      ) : null}
                      {open ? (
                        <span className="rounded bg-amber-200 px-2 py-0.5 text-xs font-medium text-amber-950 dark:bg-amber-900 dark:text-amber-100">
                          Open
                        </span>
                      ) : null}
                      {action.dueDate ? (
                        <span className="text-xs text-muted-foreground">Due {action.dueDate}</span>
                      ) : null}
                    </div>
                    <p className="mt-1 font-medium">{action.title}</p>
                    {action.description ? (
                      <p className="text-sm text-muted-foreground">{action.description}</p>
                    ) : null}
                    <p className="mt-1 text-xs text-muted-foreground">Created {action.createdAt}</p>
                  </div>
                  <Link href={action.deepLink} className="shrink-0 text-sm font-medium hover:underline">
                    Open context →
                  </Link>
                </div>
                <ResolveForm
                  action={action}
                  organizationId={organizationId}
                  studyId={studyId}
                  subjectId={subjectId}
                />
              </li>
            )
          })}
        </ul>
      )}
    </section>
  )
}
