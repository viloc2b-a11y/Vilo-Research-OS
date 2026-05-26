'use client'

import { useState } from 'react'
import { DocumentClassificationSelect } from './document-classification-select'
import { DocumentDestinationSelector } from './document-destination-selector'
import { CertifiedCopyAttestationBox } from './certified-copy-attestation-box'
import { ExpirationDateField } from './expiration-date-field'

export function DocumentUploadRuntimeShell() {
  const [file, setFile] = useState<File | null>(null)
  const [operationalName, setOperationalName] = useState('')
  const [classification, setClassification] = useState('')
  const [domain, setDomain] = useState('')
  const [entityType, setEntityType] = useState('')
  const [expirationDate, setExpirationDate] = useState('')
  const [isCertifiedCopy, setIsCertifiedCopy] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)

  const showCertifiedCopy = [
    'source_document',
    'external_medical_record',
    'lab_result',
    'imaging'
  ].includes(classification)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsSubmitting(true)
    // In a real implementation, this would call the server action,
    // upload the file to Supabase Storage, create the compliance registry row,
    // and append the audit ledger event.
    setTimeout(() => {
      alert('Document ingested into Compliance Runtime. Audit trail recorded.')
      setIsSubmitting(false)
      setFile(null)
      setOperationalName('')
      setClassification('')
      setDomain('')
      setEntityType('')
      setExpirationDate('')
      setIsCertifiedCopy(false)
    }, 1000)
  }

  return (
    <div className="mx-auto max-w-2xl rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
      <h2 className="mb-2 text-xl font-bold text-slate-800">Upload Operational Document</h2>
      <p className="mb-6 text-sm text-slate-500">
        This document will be ingested into the Vilo Compliance Runtime. An immutable audit trail will be recorded for all operational actions.
      </p>

      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="space-y-2">
          <label className="text-sm font-medium text-slate-700">Document File</label>
          <input
            type="file"
            onChange={(e) => {
              if (e.target.files && e.target.files[0]) {
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
          <label className="text-sm font-medium text-slate-700">Operational Display Name</label>
          <input
            type="text"
            value={operationalName}
            onChange={(e) => setOperationalName(e.target.value)}
            className="w-full rounded-md border border-slate-300 p-2 text-sm"
            placeholder="e.g. Protocol Amendment v3 Clean"
            required
          />
        </div>

        <DocumentClassificationSelect
          value={classification}
          onChange={setClassification}
        />

        <DocumentDestinationSelector
          domain={domain}
          onDomainChange={setDomain}
          entityType={entityType}
          onEntityTypeChange={setEntityType}
        />

        <ExpirationDateField
          value={expirationDate}
          onChange={setExpirationDate}
        />

        {showCertifiedCopy && (
          <CertifiedCopyAttestationBox
            isChecked={isCertifiedCopy}
            onChange={setIsCertifiedCopy}
          />
        )}

        <div className="pt-4">
          <button
            type="submit"
            disabled={!file || !classification || !domain || !entityType || isSubmitting}
            className="w-full rounded-md bg-indigo-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-indigo-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600 disabled:opacity-50"
          >
            {isSubmitting ? 'Ingesting into Runtime...' : 'Ingest Document'}
          </button>
        </div>
      </form>
    </div>
  )
}
