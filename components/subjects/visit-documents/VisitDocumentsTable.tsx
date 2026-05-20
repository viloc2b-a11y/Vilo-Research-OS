'use client'

import { useActionState, useState } from 'react'
import { Button } from '@/components/ui/button'
import { VisitDocumentBadge } from '@/components/subjects/visit-documents/VisitDocumentBadge'
import { VisitDocumentPreview } from '@/components/subjects/visit-documents/VisitDocumentPreview'
import {
  deleteVisitDocumentAction,
} from '@/lib/subject/visit-documents/actions'
import {
  INITIAL_VISIT_DOCUMENT_STATE,
  type VisitDocumentRow,
} from '@/lib/subject/visit-documents/types'

type VisitDocumentsTableProps = {
  studyId: string
  subjectId: string
  visitId: string
  documents: VisitDocumentRow[]
}

function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`
}

function formatDate(value: string) {
  return new Date(value).toLocaleString()
}

function DeleteDocumentForm({
  studyId,
  subjectId,
  visitId,
  documentId,
}: {
  studyId: string
  subjectId: string
  visitId: string
  documentId: string
}) {
  const [state, action, pending] = useActionState(
    deleteVisitDocumentAction,
    INITIAL_VISIT_DOCUMENT_STATE,
  )

  return (
    <form action={action} className="inline-flex items-center gap-2">
      <input type="hidden" name="study_id" value={studyId} />
      <input type="hidden" name="study_subject_id" value={subjectId} />
      <input type="hidden" name="visit_id" value={visitId} />
      <input type="hidden" name="document_id" value={documentId} />
      <Button type="submit" size="sm" variant="ghost" disabled={pending}>
        {pending ? 'Removing…' : 'Delete'}
      </Button>
      {state.message && !state.ok ? (
        <span className="text-xs text-destructive">{state.message}</span>
      ) : null}
    </form>
  )
}

export function VisitDocumentsTable({
  studyId,
  subjectId,
  visitId,
  documents,
}: VisitDocumentsTableProps) {
  const [previewId, setPreviewId] = useState(documents[0]?.id ?? null)
  const preview = documents.find((doc) => doc.id === previewId) ?? null

  return (
    <div className="space-y-4">
      <VisitDocumentPreview document={preview} />

      {documents.length === 0 ? (
        <p className="text-sm text-muted-foreground">No visit documents uploaded yet.</p>
      ) : (
        <div className="overflow-x-auto rounded-md border">
          <table className="w-full min-w-[760px] text-sm">
            <thead className="bg-muted/40 text-left text-xs text-muted-foreground">
              <tr>
                <th className="px-3 py-2 font-medium">File Name</th>
                <th className="px-3 py-2 font-medium">Document Type</th>
                <th className="px-3 py-2 font-medium">Uploaded By</th>
                <th className="px-3 py-2 font-medium">Uploaded Date</th>
                <th className="px-3 py-2 font-medium">File Size</th>
                <th className="px-3 py-2 font-medium">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {documents.map((doc) => (
                <tr key={doc.id}>
                  <td className="max-w-[260px] px-3 py-3">
                    <p className="truncate font-medium">{doc.fileName}</p>
                    {doc.notes ? <p className="mt-1 text-xs text-muted-foreground">{doc.notes}</p> : null}
                  </td>
                  <td className="px-3 py-3">
                    <VisitDocumentBadge type={doc.documentType} />
                  </td>
                  <td className="px-3 py-3 font-mono text-xs text-muted-foreground">
                    {doc.uploadedBy?.slice(0, 8) ?? 'Unknown'}
                  </td>
                  <td className="px-3 py-3 text-xs text-muted-foreground">{formatDate(doc.uploadedAt)}</td>
                  <td className="px-3 py-3 text-xs text-muted-foreground">{formatBytes(doc.fileSize)}</td>
                  <td className="px-3 py-3">
                    <div className="flex flex-wrap items-center gap-2">
                      <Button type="button" size="sm" variant="outline" onClick={() => setPreviewId(doc.id)}>
                        Preview
                      </Button>
                      {doc.downloadUrl ? (
                        <a className="text-xs font-medium hover:underline" href={doc.downloadUrl}>
                          Download
                        </a>
                      ) : null}
                      <DeleteDocumentForm
                        studyId={studyId}
                        subjectId={subjectId}
                        visitId={visitId}
                        documentId={doc.id}
                      />
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
