'use client'

import { useState } from 'react'
import { DocumentUploadRuntimeShell } from '@/components/document-intake/document-upload-runtime-shell'
import { RecentDocumentRuntimeEvents } from '@/components/document-intake/recent-document-runtime-events'

export function DocumentIntakeClient({ organizationId }: { organizationId: string }) {
  const [refreshKey, setRefreshKey] = useState(0)

  return (
    <div className="space-y-2 p-6">
      <header className="mb-4 max-w-2xl">
        <h1 className="text-2xl font-semibold tracking-tight text-slate-900">Document intake</h1>
        <p className="mt-1 text-sm text-slate-500">
          Upload operational documents with server-side hashing and immutable audit events.
        </p>
      </header>

      <DocumentUploadRuntimeShell
        organizationId={organizationId}
        onUploaded={() => setRefreshKey((value) => value + 1)}
      />
      <RecentDocumentRuntimeEvents
        key={refreshKey}
        organizationId={organizationId}
      />
    </div>
  )
}
