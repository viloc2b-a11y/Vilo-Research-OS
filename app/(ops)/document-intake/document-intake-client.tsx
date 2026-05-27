'use client'

import { useState } from 'react'
import { DocumentUploadRuntimeShell } from '@/components/document-intake/document-upload-runtime-shell'
import { RecentDocumentRuntimeEvents } from '@/components/document-intake/recent-document-runtime-events'
import { PendingObligationsPanel } from '@/components/document-intake/pending-obligations-panel'
import { ExpirationAlertsPanel } from '@/components/document-intake/expiration-alerts-panel'

export function DocumentIntakeClient({
  organizationId,
  initialStudyId = null,
}: {
  organizationId: string
  initialStudyId?: string | null
}) {
  const [refreshKey, setRefreshKey] = useState(0)

  return (
    <div className="space-y-6 p-6">
      <header className="mb-2 max-w-2xl">
        <h1 className="text-2xl font-semibold tracking-tight text-slate-900">Document Intake</h1>
        <p className="mt-1 text-sm text-slate-500">
          Upload or register study documents before intelligence processing. Request signatures or
          acknowledgements, track expirations, and manage renewal alerts. An immutable audit trail
          will be recorded.
        </p>
        {initialStudyId ? (
          <p className="mt-2 text-xs text-teal-800">
            Study context applied to uploads. Continue to Document Intelligence after registering
            documents.
          </p>
        ) : null}
      </header>

      <DocumentUploadRuntimeShell
        organizationId={organizationId}
        studyId={initialStudyId}
        onUploaded={() => setRefreshKey((value) => value + 1)}
      />
      <PendingObligationsPanel
        key={`pending-${refreshKey}`}
        organizationId={organizationId}
        refreshKey={refreshKey}
        onObligationChanged={() => setRefreshKey((value) => value + 1)}
      />
      <ExpirationAlertsPanel
        key={`expiration-${refreshKey}`}
        organizationId={organizationId}
        refreshKey={refreshKey}
        onAlertsChanged={() => setRefreshKey((value) => value + 1)}
      />
      <RecentDocumentRuntimeEvents key={`recent-${refreshKey}`} organizationId={organizationId} />
    </div>
  )
}
