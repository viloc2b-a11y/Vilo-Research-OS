'use client'

import { useState } from 'react'
import { DocumentClassificationSelect } from './document-classification-select'
import { DocumentDestinationSelector } from './document-destination-selector'
import { CertifiedCopyAttestationBox } from './certified-copy-attestation-box'
import { ExpirationDateField } from './expiration-date-field'

type DocumentUploadRuntimeShellProps = {
  organizationId: string
  studyId?: string | null
  subjectId?: string | null
  visitId?: string | null
  procedureExecutionId?: string | null
  onUploaded?: () => void
}

export function DocumentUploadRuntimeShell({
  organizationId,
  studyId = null,
  subjectId = null,
  visitId = null,
  procedureExecutionId = null,
  onUploaded,
}: DocumentUploadRuntimeShellProps) {
  const [file, setFile] = useState<File | null>(null)
  const [operationalName, setOperationalName] = useState('')
  const [classification, setClassification] = useState('')
  const [domain, setDomain] = useState('')
  const [entityType, setEntityType] = useState('')
  const [destinationEntityId, setDestinationEntityId] = useState('')
  const [expirationDate, setExpirationDate] = useState('')
  const [operationalNotes, setOperationalNotes] = useState('')
  const [isCertifiedCopy, setIsCertifiedCopy] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)

  const showCertifiedCopy = [
    'source_document',
    'external_medical_record',
    'lab_result',
    'imaging',
  ].includes(classification)

  const needsEntityId = ['subject', 'visit', 'procedure'].includes(entityType)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!file || !classification || !domain || !entityType) return
    if (needsEntityId && !destinationEntityId.trim()) {
      setError('Destination entity id is required for this target level.')
      return
    }

    setIsSubmitting(true)
    setError(null)
    setSuccess(false)

    try {
      const formData = new FormData()
      formData.append('file', file)
      formData.append('organization_id', organizationId)
      if (studyId) formData.append('study_id', studyId)
      if (subjectId) formData.append('subject_id', subjectId)
      if (visitId) formData.append('visit_id', visitId)
      if (procedureExecutionId) formData.append('procedure_execution_id', procedureExecutionId)
      formData.append('operational_display_name', operationalName)
      formData.append('document_classification', classification)
      formData.append('destination_domain', domain)
      formData.append('destination_entity_type', entityType)
      if (destinationEntityId.trim()) formData.append('destination_entity_id', destinationEntityId.trim())
      if (expirationDate) formData.append('expiration_date', expirationDate)
      if (operationalNotes.trim()) formData.append('operational_notes', operationalNotes.trim())
      formData.append('certified_copy_attested', String(isCertifiedCopy))

      const res = await fetch('/api/document-intake/upload', {
        method: 'POST',
        body: formData,
      })

      const data = (await res.json()) as { error?: string; ok?: boolean }
      if (!res.ok) {
        throw new Error(data.error || 'Upload failed')
      }

      setSuccess(true)
      setFile(null)
      setOperationalName('')
      setClassification('')
      setDomain('')
      setEntityType('')
      setDestinationEntityId('')
      setExpirationDate('')
      setOperationalNotes('')
      setIsCertifiedCopy(false)
      onUploaded?.()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Upload failed')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="mx-auto max-w-2xl rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
      <h2 className="mb-2 text-xl font-bold text-slate-800">Upload operational document</h2>
      <p className="mb-6 text-sm text-slate-500">
        Upload a file for site operations. An immutable audit trail will be recorded.
      </p>

      {error ? (
        <div className="mb-4 rounded-md bg-red-50 p-4 text-sm text-red-700">{error}</div>
      ) : null}

      {success ? (
        <div className="mb-4 rounded-md bg-green-50 p-4 text-sm text-green-700">
          Document uploaded. Audit events recorded.
        </div>
      ) : null}

      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="space-y-2">
          <label className="text-sm font-medium text-slate-700">Document file</label>
          <input
            type="file"
            accept=".pdf,.png,.jpg,.jpeg,.docx,application/pdf,image/png,image/jpeg,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
            onChange={(e) => {
              if (e.target.files?.[0]) {
                setFile(e.target.files[0])
                if (!operationalName) {
                  setOperationalName(e.target.files[0].name)
                }
              }
            }}
            className="w-full rounded-md border border-slate-300 p-2 text-sm"
            required
          />
        </div>

        <div className="space-y-2">
          <label className="text-sm font-medium text-slate-700">Operational display name</label>
          <input
            type="text"
            value={operationalName}
            onChange={(e) => setOperationalName(e.target.value)}
            className="w-full rounded-md border border-slate-300 p-2 text-sm"
            placeholder="e.g. Protocol Amendment v3 Clean"
            required
          />
        </div>

        <DocumentClassificationSelect value={classification} onChange={setClassification} />

        <DocumentDestinationSelector
          domain={domain}
          onDomainChange={setDomain}
          entityType={entityType}
          onEntityTypeChange={setEntityType}
          destinationEntityId={destinationEntityId}
          onDestinationEntityIdChange={setDestinationEntityId}
          showEntityId={needsEntityId}
        />

        <ExpirationDateField value={expirationDate} onChange={setExpirationDate} />

        <div className="space-y-2">
          <label className="text-sm font-medium text-slate-700">Operational notes (optional)</label>
          <textarea
            value={operationalNotes}
            onChange={(e) => setOperationalNotes(e.target.value)}
            className="min-h-[72px] w-full rounded-md border border-slate-300 p-2 text-sm"
            placeholder="Coordinator context for this upload"
          />
        </div>

        {showCertifiedCopy ? (
          <CertifiedCopyAttestationBox isChecked={isCertifiedCopy} onChange={setIsCertifiedCopy} />
        ) : null}

        <div className="pt-4">
          <button
            type="submit"
            disabled={!file || !classification || !domain || !entityType || isSubmitting}
            className="w-full rounded-md bg-indigo-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-indigo-500 disabled:opacity-50"
          >
            {isSubmitting ? 'Uploading…' : 'Upload document'}
          </button>
        </div>
      </form>
    </div>
  )
}
