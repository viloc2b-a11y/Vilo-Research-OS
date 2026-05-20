'use client'

import { useActionState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  uploadVisitDocumentAction,
} from '@/lib/subject/visit-documents/actions'
import {
  INITIAL_VISIT_DOCUMENT_STATE,
  VISIT_DOCUMENT_TYPES,
} from '@/lib/subject/visit-documents/types'

type VisitDocumentUploaderProps = {
  studyId: string
  subjectId: string
  visitId: string
}

export function VisitDocumentUploader({
  studyId,
  subjectId,
  visitId,
}: VisitDocumentUploaderProps) {
  const [state, action, pending] = useActionState(
    uploadVisitDocumentAction,
    INITIAL_VISIT_DOCUMENT_STATE,
  )

  return (
    <form action={action} className="space-y-4 rounded-md border border-dashed p-4">
      <input type="hidden" name="study_id" value={studyId} />
      <input type="hidden" name="study_subject_id" value={subjectId} />
      <input type="hidden" name="visit_id" value={visitId} />

      <div className="grid gap-4 md:grid-cols-[220px_minmax(0,1fr)]">
        <div className="space-y-1">
          <Label htmlFor="document_type">Document type</Label>
          <select
            id="document_type"
            name="document_type"
            className="h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm"
            defaultValue="Source Document"
          >
            {VISIT_DOCUMENT_TYPES.map((type) => (
              <option key={type} value={type}>
                {type}
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-1">
          <Label htmlFor="file">File</Label>
          <Input id="file" name="file" type="file" accept=".pdf,.jpg,.jpeg,.png,application/pdf,image/jpeg,image/png" />
          <p className="text-xs text-muted-foreground">PDF preferred. JPG and PNG supported.</p>
        </div>
      </div>

      <div className="space-y-1">
        <Label htmlFor="notes">Notes</Label>
        <textarea
          id="notes"
          name="notes"
          className="min-h-16 w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm"
          placeholder="Optional coordinator note"
        />
      </div>

      {state.message ? (
        <p className={state.ok ? 'text-sm text-emerald-700' : 'text-sm text-destructive'} role="status">
          {state.message}
        </p>
      ) : null}

      <Button type="submit" disabled={pending}>
        {pending ? 'Uploading…' : 'Upload document'}
      </Button>
    </form>
  )
}
