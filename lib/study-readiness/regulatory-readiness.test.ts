import { describe, expect, it } from 'vitest'
import { evaluateRegulatoryReadiness } from './regulatory-readiness'
import { buildStudyRegulatoryPacket } from '@/lib/regulatory-center/study-regulatory-packet'
import { buildStudyRegulatorySignals } from '@/lib/regulatory-center/regulatory-signals'
import type { StudyLinkWithDetails, StudyInfo } from '@/lib/regulatory-center/study-regulatory-links'
import type { StudyRegulatoryDocumentEntry } from '@/lib/regulatory-center/study-regulatory-documents'

function makeStudy(): StudyInfo {
  return { id: 's-1', name: 'Test Study', status: 'active' }
}

function makeLink(over: Partial<StudyLinkWithDetails> = {}): StudyLinkWithDetails {
  return {
    id: 'l-1', organization_id: 'org-1', study_id: 's-1',
    link_type: 'document', personnel_id: null, master_document_id: 'md-1',
    required: false, status: 'active', notes: null,
    created_by: null, created_at: '2026-01-01T00:00:00Z', updated_at: '2026-01-01T00:00:00Z',
    ...over,
  }
}

function makeStudyDoc(over: Partial<StudyRegulatoryDocumentEntry> = {}): StudyRegulatoryDocumentEntry {
  return {
    id: 'sd-1', organization_id: 'org-1', study_id: 's-1',
    document_type: '1572', document_title: 'FDA 1572',
    document_reference: null, version: null,
    effective_date: null, expiration_date: null,
    status: 'missing', owner_role: null, required: false, notes: null,
    created_by: null, created_at: '2026-01-01T00:00:00Z', updated_at: '2026-01-01T00:00:00Z',
    ...over,
  }
}

const futureDate = (d: number) => { const n = new Date(); n.setDate(n.getDate() + d); return n.toISOString().slice(0, 10) }

describe('evaluateRegulatoryReadiness', () => {
  it('returns ready when packet is clean with no signals', () => {
    const study = makeStudy()
    const links: StudyLinkWithDetails[] = []
    const docs: StudyRegulatoryDocumentEntry[] = [
      makeStudyDoc({ document_type: 'IRB Approval', status: 'approved' }),
      makeStudyDoc({ document_type: '1572', status: 'received' }),
      makeStudyDoc({ document_type: 'Delegation Log', status: 'received' }),
    ]
    const packet = buildStudyRegulatoryPacket(study, links, docs)
    const signals = buildStudyRegulatorySignals(study.id, packet, docs)
    const result = evaluateRegulatoryReadiness(packet, signals)
    expect(result.status).toBe('ready')
    expect(result.score).toBe(80)
    // No required inherited items → info level message
    expect(result.blockers.some((b) => b.message.includes('No required regulatory items'))).toBe(true)
  })

  it('returns blocked when critical signals exist (expired document)', () => {
    const study = makeStudy()
    const links: StudyLinkWithDetails[] = [
      makeLink({ id: 'l-1', link_type: 'document', document_title: 'License',
        required: true, expiration_date: '2024-01-01', expiration_bucket: 'expired' }),
    ]
    const docs: StudyRegulatoryDocumentEntry[] = [
      makeStudyDoc({ document_type: 'IRB Approval', status: 'approved' }),
      makeStudyDoc({ document_type: '1572', status: 'received' }),
      makeStudyDoc({ document_type: 'Delegation Log', status: 'received' }),
    ]
    const packet = buildStudyRegulatoryPacket(study, links, docs)
    const signals = buildStudyRegulatorySignals(study.id, packet, docs)
    const result = evaluateRegulatoryReadiness(packet, signals)
    expect(result.status).toBe('blocked')
    expect(result.score).toBeLessThan(50)
    expect(result.blockers.some((b) => b.message.includes('Expired'))).toBe(true)
  })

  it('returns blocked when critical signals exist (missing IRB)', () => {
    const study = makeStudy()
    const docs: StudyRegulatoryDocumentEntry[] = [] // nothing recorded
    const packet = buildStudyRegulatoryPacket(study, [], docs)
    const signals = buildStudyRegulatorySignals(study.id, packet, docs)
    const result = evaluateRegulatoryReadiness(packet, signals)
    expect(result.status).toBe('blocked')
    expect(result.blockers.some((b) => b.message.includes('IRB Approval'))).toBe(true)
  })

  it('returns blocked when critical signals exist (missing 1572)', () => {
    const study = makeStudy()
    const docs: StudyRegulatoryDocumentEntry[] = [
      makeStudyDoc({ document_type: 'IRB Approval', status: 'approved' }),
      // 1572 missing
    ]
    const packet = buildStudyRegulatoryPacket(study, [], docs)
    const signals = buildStudyRegulatorySignals(study.id, packet, docs)
    const result = evaluateRegulatoryReadiness(packet, signals)
    expect(result.status).toBe('blocked')
    expect(result.blockers.some((b) => b.message.includes('1572'))).toBe(true)
  })

  it('returns warning when only warning signals exist (missing Delegation Log)', () => {
    const study = makeStudy()
    const docs: StudyRegulatoryDocumentEntry[] = [
      makeStudyDoc({ document_type: 'IRB Approval', status: 'approved' }),
      makeStudyDoc({ document_type: '1572', status: 'received' }),
      // Delegation Log missing = warning
    ]
    const packet = buildStudyRegulatoryPacket(study, [], docs)
    const signals = buildStudyRegulatorySignals(study.id, packet, docs)
    const result = evaluateRegulatoryReadiness(packet, signals)
    expect(result.status).toBe('warning')
    expect(result.score).toBeGreaterThanOrEqual(50)
    expect(result.score).toBeLessThan(80)
    expect(result.blockers.some((b) => b.message.includes('Delegation Log'))).toBe(true)
  })

  it('returns warning when expiring documents exist', () => {
    const study = makeStudy()
    const links: StudyLinkWithDetails[] = [
      makeLink({ id: 'l-1', link_type: 'document', document_title: 'GCP',
        expiration_date: futureDate(15), expiration_bucket: 'expiring_30' }),
    ]
    const docs: StudyRegulatoryDocumentEntry[] = [
      makeStudyDoc({ document_type: 'IRB Approval', status: 'approved' }),
      makeStudyDoc({ document_type: '1572', status: 'received' }),
      makeStudyDoc({ document_type: 'Delegation Log', status: 'received' }),
    ]
    const packet = buildStudyRegulatoryPacket(study, links, docs)
    const signals = buildStudyRegulatorySignals(study.id, packet, docs)
    const result = evaluateRegulatoryReadiness(packet, signals)
    expect(result.status).toBe('warning')
    expect(result.blockers.some((b) => b.message.includes('Expiring'))).toBe(true)
  })

  it('returns ready with info when no required inherited items but study-specific satisfied', () => {
    const study = makeStudy()
    const docs: StudyRegulatoryDocumentEntry[] = [
      makeStudyDoc({ document_type: 'IRB Approval', status: 'approved' }),
      makeStudyDoc({ document_type: '1572', status: 'received' }),
      makeStudyDoc({ document_type: 'Delegation Log', status: 'received' }),
    ]
    const packet = buildStudyRegulatoryPacket(study, [], docs)
    const signals = buildStudyRegulatorySignals(study.id, packet, docs)
    // With IRB + 1572 + Delegation Log satisfied, no signals
    const result = evaluateRegulatoryReadiness(packet, signals)
    expect(result.status).toBe('ready')
    expect(result.score).toBe(80) // readiness null → score 80 with info message
  })

  it('no required items with no links returns warning with info message', () => {
    const study = makeStudy()
    const docs: StudyRegulatoryDocumentEntry[] = [] // empty
    const packet = buildStudyRegulatoryPacket(study, [], docs)
    const signals = buildStudyRegulatorySignals(study.id, packet, docs)
    // With no docs, we get IRB + 1572 + Delegation Log critical signals
    const result = evaluateRegulatoryReadiness(packet, signals)
    expect(result.status).toBe('blocked')
  })

  it('maps regulatory signal severity to readiness blocker severity', () => {
    const study = makeStudy()
    const docs: StudyRegulatoryDocumentEntry[] = [
      makeStudyDoc({ document_type: 'IRB Approval', status: 'approved' }),
      makeStudyDoc({ document_type: '1572', status: 'received' }),
      // Delegation Log missing = warning
    ]
    const packet = buildStudyRegulatoryPacket(study, [], docs)
    const signals = buildStudyRegulatorySignals(study.id, packet, docs)
    const result = evaluateRegulatoryReadiness(packet, signals)
    // Delegation Log should map to warning
    const dlBlocker = result.blockers.find((b) => b.message.includes('Delegation Log'))
    expect(dlBlocker).toBeDefined()
    expect(dlBlocker!.severity).toBe('warning')
  })
})
