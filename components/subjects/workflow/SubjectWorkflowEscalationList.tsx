'use client'

import Link from 'next/link'
import { SignalListOverflow } from '@/components/subject/signal-density/SignalListOverflow'
import { Button } from '@/components/ui/button'
import {
  INITIAL_WORKFLOW_ACTION_STATE,
  resolveSubjectWorkflowAction,
} from '@/lib/subject/workflow/actions'
import type { SubjectWorkflowAction } from '@/lib/subject/workflow/types'
import type {
  WorkflowEscalationGroupSection,
  WorkflowEscalationItem,
} from '@/lib/subject/workflow-escalation/types'
import { cn } from '@/lib/utils'
import { useActionState } from 'react'

type SubjectWorkflowEscalationListProps = {
  sections: WorkflowEscalationGroupSection[]
  actionsById: Map<string, SubjectWorkflowAction>
  organizationId: string
  studyId: string
  subjectId: string
}

function groupTone(group: WorkflowEscalationGroupSection['group']): string {
  switch (group) {
    case 'critical_overdue':
      return 'border-rose-300 bg-rose-50/60'
    case 'due_soon':
      return 'border-amber-300 bg-amber-50/50'
    case 'pending_signatures':
      return 'border-sky-200 bg-sky-50/40'
    default:
      return 'border-slate-200 bg-background'
  }
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

  return (
    <form action={formAction} className="mt-2 flex flex-wrap items-center gap-2">
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

function EscalationRow({
  item,
  action,
  organizationId,
  studyId,
  subjectId,
}: {
  item: WorkflowEscalationItem
  action: SubjectWorkflowAction | null
  organizationId: string
  studyId: string
  subjectId: string
}) {
  return (
    <li
      id={item.workflowActionId ? `workflow-${item.workflowActionId}` : undefined}
      className={cn(
        'rounded-md border p-3 text-sm',
        item.isOverdue ? 'border-rose-300 bg-rose-50/80' : 'border-[#e5e5e5] bg-white',
      )}
    >
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="font-medium" style={{ color: '#10253e' }}>
            {item.title}
          </p>
          {item.description ? (
            <p className="mt-0.5 text-xs" style={{ color: '#64748b' }}>
              {item.description}
            </p>
          ) : null}
        </div>
        <div className="flex flex-wrap gap-1 text-[10px]">
          {item.sourceLabel ? (
            <span className="rounded border px-1.5 py-0.5 bg-white/80">{item.sourceLabel}</span>
          ) : null}
          {item.priority ? (
            <span className="rounded border px-1.5 py-0.5 bg-white/80 uppercase">
              {item.priority}
            </span>
          ) : null}
          {item.isOverdue ? (
            <span className="rounded border border-rose-300 bg-rose-50 px-1.5 py-0.5 text-rose-900">
              Overdue
            </span>
          ) : null}
          <span className="rounded border px-1.5 py-0.5 bg-white/80">{item.statusLabel}</span>
        </div>
      </div>

      <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs" style={{ color: '#98a5ad' }}>
        {item.dueDate ? <span>Due {item.dueDate}</span> : null}
        {item.visitName ? <span>Visit: {item.visitName}</span> : null}
        {item.assignedLabel ? <span>{item.assignedLabel}</span> : null}
      </div>

      <p className="mt-2 text-xs font-medium" style={{ color: '#2a8577' }}>
        Next: {item.recommendedAction}
      </p>

      {item.href ? (
        <Link
          href={item.href}
          className="mt-2 inline-block text-xs font-medium text-[#34a090] hover:underline"
        >
          Open evidence →
        </Link>
      ) : null}

      {action && item.workflowActionId ? (
        <ResolveForm
          action={action}
          organizationId={organizationId}
          studyId={studyId}
          subjectId={subjectId}
        />
      ) : null}
    </li>
  )
}

export function SubjectWorkflowEscalationList({
  sections,
  actionsById,
  organizationId,
  studyId,
  subjectId,
}: SubjectWorkflowEscalationListProps) {
  if (sections.length === 0) {
    return (
      <section
        className="rounded-lg border bg-white p-4"
        style={{ borderColor: '#e5e5e5' }}
      >
        <p className="text-sm" style={{ color: '#98a5ad' }}>
          No open escalation items. Create a workflow action below or check the General tab for
          visit-level status.
        </p>
      </section>
    )
  }

  return (
    <div className="space-y-4">
      {sections.map((section) => (
        <section
          key={section.group}
          className={cn('rounded-lg border p-4', groupTone(section.group))}
        >
          <h3 className="text-sm font-semibold mb-3" style={{ color: '#10253e' }}>
            {section.title}
            <span className="ml-2 font-normal text-muted-foreground">({section.items.length})</span>
          </h3>
          <ul className="space-y-2">
            {section.items.map((item) => (
              <EscalationRow
                key={item.id}
                item={item}
                action={
                  item.workflowActionId
                    ? actionsById.get(item.workflowActionId) ?? null
                    : null
                }
                organizationId={organizationId}
                studyId={studyId}
                subjectId={subjectId}
              />
            ))}
          </ul>
          <SignalListOverflow
            hiddenCount={section.hiddenCount}
            moreHref={section.moreHref}
            label="Open visits grid"
          />
        </section>
      ))}
    </div>
  )
}
