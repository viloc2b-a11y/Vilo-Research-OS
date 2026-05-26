import { describe, expect, it } from 'vitest'
import { buildStoragePath } from '../build-storage-path'
import { computeDocumentHash, computeAuditLedgerStateHash } from '../document-hash'
import { CERTIFIED_COPY_ATTESTATION_LOCKED_TEXT } from '../compliance-types'
import { validateDocumentUpload } from '../validate-document-upload'
import { validateDestinationMetadata } from '../validate-destination-metadata'
import * as auditLedger from '../audit-ledger'

describe('document intake phase 1b', () => {
  it('generates deterministic SHA-256 hashes', () => {
    const buffer = Buffer.from('phase-1b-smoke-content')
    expect(computeDocumentHash(buffer)).toBe(computeDocumentHash(buffer))
    expect(computeDocumentHash(buffer)).toHaveLength(64)
  })

  it('builds storage paths per convention', () => {
    const path = buildStoragePath({
      organizationId: 'org-1',
      studyId: 'study-1',
      subjectId: 'subject-1',
      documentId: 'doc-1',
      filename: 'Scan Report.PDF',
    })
    expect(path).toBe('org-1/studies/study-1/subjects/subject-1/documents/doc-1/scan-report.pdf')

    const fallback = buildStoragePath({
      organizationId: 'org-1',
      documentId: 'doc-2',
      filename: 'memo.docx',
    })
    expect(fallback).toBe('org-1/general/documents/doc-2/memo.docx')
  })

  it('preserves certified copy attestation text exactly', () => {
    expect(CERTIFIED_COPY_ATTESTATION_LOCKED_TEXT).toBe(
      'I certify that this document is an exact copy having all of the same information and attributes as the original.',
    )
  })

  it('rejects invalid uploads', () => {
    expect(validateDocumentUpload(null).ok).toBe(false)
    expect(
      validateDocumentUpload({ size: 0, type: 'application/pdf', name: 'x.pdf' } as File).ok,
    ).toBe(false)
    expect(
      validateDocumentUpload({
        size: 100,
        type: 'text/plain',
        name: 'notes.txt',
      } as File).ok,
    ).toBe(false)
  })

  it('requires destination metadata', () => {
    expect(
      validateDestinationMetadata({
        destinationDomain: null,
        destinationEntityType: 'study',
        destinationEntityId: null,
      }).ok,
    ).toBe(false)
    expect(
      validateDestinationMetadata({
        destinationDomain: 'study_documents',
        destinationEntityType: 'subject',
        destinationEntityId: null,
      }).ok,
    ).toBe(false)
  })

  it('audit ledger exposes append-only API', () => {
    expect(typeof auditLedger.appendComplianceAuditEvent).toBe('function')
    expect(Object.keys(auditLedger)).toEqual(['appendComplianceAuditEvent'])
  })

  it('computes audit ledger state hashes deterministically', () => {
    const hashA = computeAuditLedgerStateHash('doc-1', 'document_ingested', '2026-01-01T00:00:00.000Z', {
      a: 1,
    })
    const hashB = computeAuditLedgerStateHash('doc-1', 'document_ingested', '2026-01-01T00:00:00.000Z', {
      a: 1,
    })
    expect(hashA).toBe(hashB)
  })
})
