'use client'

import { useState } from 'react'
import { DocumentUploadRuntimeShell } from '@/components/document-intake/document-upload-runtime-shell'
import { RecentDocumentRuntimeEvents } from '@/components/document-intake/recent-document-runtime-events'
import { PendingObligationsPanel } from '@/components/document-intake/pending-obligations-panel'

export function DocumentIntakeClient({ organizationId }: { organizationId: string }) {
  const [refreshKey, setRefreshKey] = useState(0)

  return (
    <div className="space-y-6 p-6">
      <header className="mb-2 max-w-2xl">
        <h1 className="text-2xl font-semibold tracking-tight text-slate-900">Document intake</h1>
        <p className="mt-1 text-sm text-slate-500">
          Upload documents, request signatures or acknowledgements, and track pending actions. An
          immutable audit trail will be recorded.
        </p>
      </header>

      <DocumentUploadRuntimeShell
        organizationId={organizationId}
        onUploaded={() => setRefreshKey((value) => value + 1)}
      />
      <PendingObligationsPanel
        key={`pending-${refreshKey}`}
        organizationId={organizationId}
        refreshKey={refreshKey}
        onObligationChanged={() => setRefreshKey((value) => value + 1)}
      />
      <RecentDocumentRuntimeEvents key={`recent-${refreshKey}`} organizationId={organizationId} />
    </div>
  )
}
