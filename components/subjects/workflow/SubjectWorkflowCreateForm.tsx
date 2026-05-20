'use client'

import { useActionState } from 'react'
import { Button } from '@/components/ui/button'
import {
  createSubjectWorkflowAction,
  INITIAL_WORKFLOW_ACTION_STATE,
} from '@/lib/subject/workflow/actions'

type SubjectWorkflowCreateFormProps = {
  organizationId: string
  studyId: string
  subjectId: string
  visitId?: string | null
  procedureExecutionId?: string | null
  sourceResponseSetId?: string | null
  sourceSectionKey?: string | null
}

export function SubjectWorkflowCreateForm({
  organizationId,
  studyId,
  subjectId,
  visitId = null,
  procedureExecutionId = null,
  sourceResponseSetId = null,
  sourceSectionKey = null,
}: SubjectWorkflowCreateFormProps) {
  const [state, action, pending] = useActionState(
    createSubjectWorkflowAction,
    INITIAL_WORKFLOW_ACTION_STATE,
  )

  return (
    <form action={action} className="space-y-3 rounded-md border bg-muted/10 p-4">
      <input type="hidden" name="organization_id" value={organizationId} />
      <input type="hidden" name="study_id" value={studyId} />
      <input type="hidden" name="study_subject_id" value={subjectId} />
      {visitId ? <input type="hidden" name="visit_id" value={visitId} /> : null}
      {procedureExecutionId ? <input type="hidden" name="procedure_execution_id" value={procedureExecutionId} /> : null}
      {sourceResponseSetId ? <input type="hidden" name="source_response_set_id" value={sourceResponseSetId} /> : null}
      {sourceSectionKey ? <input type="hidden" name="source_section_key" value={sourceSectionKey} /> : null}

      <div className="grid gap-3 md:grid-cols-[1.2fr_0.8fr_0.8fr_0.8fr]">
        <label className="space-y-1 text-sm">
          <span className="font-medium">Create Action</span>
          <input name="title" className="h-9 w-full rounded-md border bg-background px-3 text-sm" required />
        </label>
        <label className="space-y-1 text-sm">
          <span className="font-medium">Type</span>
          <select name="action_type" className="h-9 w-full rounded-md border bg-background px-2 text-sm">
            <option value="action">Action</option>
            <option value="query">Query</option>
            <option value="signature_request">Signature Request</option>
            <option value="follow_up">Follow-up</option>
            <option value="correction">Correction</option>
          </select>
        </label>
        <label className="space-y-1 text-sm">
          <span className="font-medium">Assigned</span>
          <select name="assigned_role" className="h-9 w-full rounded-md border bg-background px-2 text-sm">
            <option value="crc">CRC</option>
            <option value="cra">CRA</option>
            <option value="pi">PI</option>
            <option value="sub_i">Sub-I</option>
            <option value="site">Site</option>
          </select>
        </label>
        <label className="space-y-1 text-sm">
          <span className="font-medium">Due</span>
          <input name="due_date" type="date" className="h-9 w-full rounded-md border bg-background px-3 text-sm" />
        </label>
      </div>

      <div className="grid gap-3 md:grid-cols-[1fr_auto]">
        <textarea
          name="description"
          className="min-h-16 rounded-md border bg-background px-3 py-2 text-sm"
          placeholder="Operational note, query detail, correction request, or follow-up context"
        />
        <div className="flex flex-col gap-2">
          <select name="priority" className="h-9 rounded-md border bg-background px-2 text-sm">
            <option value="normal">Normal</option>
            <option value="low">Low</option>
            <option value="high">High</option>
            <option value="urgent">Urgent</option>
          </select>
          <Button type="submit" disabled={pending}>{pending ? 'Creating…' : 'Create'}</Button>
        </div>
      </div>

      {state.message ? (
        <p className={state.ok ? 'text-sm text-emerald-700' : 'text-sm text-destructive'}>
          {state.message}
        </p>
      ) : null}
    </form>
  )
}
