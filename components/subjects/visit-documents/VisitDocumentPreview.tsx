import type { VisitDocumentRow } from '@/lib/subject/visit-documents/types'

export function VisitDocumentPreview({ document }: { document: VisitDocumentRow | null }) {
  if (!document) {
    return (
      <div className="rounded-md border bg-muted/20 p-4 text-sm text-muted-foreground">
        Upload a document or use Preview from the table.
      </div>
    )
  }

  if (!document.previewUrl) {
    return (
      <div className="rounded-md border bg-muted/20 p-4 text-sm text-muted-foreground">
        Preview is not available for this document.
      </div>
    )
  }

  if (document.mimeType === 'application/pdf') {
    return (
      <div className="overflow-hidden rounded-md border">
        <div className="border-b bg-muted/30 px-3 py-2 text-sm font-medium">{document.fileName}</div>
        <iframe title={document.fileName} src={document.previewUrl} className="h-[520px] w-full bg-background" />
      </div>
    )
  }

  return (
    <div className="overflow-hidden rounded-md border">
      <div className="border-b bg-muted/30 px-3 py-2 text-sm font-medium">{document.fileName}</div>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={document.previewUrl} alt={document.fileName} className="max-h-[520px] w-full object-contain" />
    </div>
  )
}
