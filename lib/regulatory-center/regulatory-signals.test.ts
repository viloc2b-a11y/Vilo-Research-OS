import { describe, expect, it } from 'vitest'
import { buildStudyRegulatorySignals, countRegulatorySignals } from './regulatory-signals'
import { buildStudyRegulatoryPacket } from './study-regulatory-packet'
import type { StudyLinkWithDetails, StudyInfo } from './study-regulatory-links'
import type { StudyRegulatoryDocumentEntry } from './study-regulatory-documents'

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

describe('buildStudyRegulatorySignals', () => {
  it('returns empty for clean study with no issues', () => {
    const study = makeStudy()
    const links: StudyLinkWithDetails[] = []
    const docs: StudyRegulatoryDocumentEntry[] = [
      makeStudyDoc({ document_type: 'IRB Approval', status: 'approved' }),
      makeStudyDoc({ document_type: '1572', status: 'received' }),
      makeStudyDoc({ document_type: 'Delegation Log', status: 'received' }),
    ]
    const packet = buildStudyRegulatoryPacket(study, links, docs)
    const signals = buildStudyRegulatorySignals(study.id, packet, docs)
    const counts = countRegulatorySignals(signals)
    // Only signals are the 1572, IRB, Delegation Log checks — but they're all satisfied
    expect(counts.total).toBe(0)
  })

  it('flags expired inherited document as critical', () => {
    const study = makeStudy()
    const links: StudyLinkWithDetails[] = [
      makeLink({ id: 'l-1', link_type: 'document', document_title: 'Medical License', expiration_date: '2024-01-01', expiration_bucket: 'expired', required: true }),
    ]
    const docs: StudyRegulatoryDocumentEntry[] = [
      makeStudyDoc({ document_type: 'IRB Approval', status: 'approved' }),
      makeStudyDoc({ document_type: '1572', status: 'received' }),
      makeStudyDoc({ document_type: 'Delegation Log', status: 'received' }),
    ]
    const packet = buildStudyRegulatoryPacket(study, links, docs)
    const signals = buildStudyRegulatorySignals(study.id, packet, docs)
    const counts = countRegulatorySignals(signals)
    expect(counts.critical).toBeGreaterThanOrEqual(1)
    expect(signals.some((s) => s.title.includes('Expired'))).toBe(true)
  })

  it('flags missing required study-specific doc as critical', () => {
    const study = makeStudy()
    const docs: StudyRegulatoryDocumentEntry[] = [
      makeStudyDoc({ id: 'sd-1', document_type: 'IRB Approval', status: 'missing', required: true }),
      makeStudyDoc({ id: 'sd-2', document_type: '1572', status: 'received' }),
      makeStudyDoc({ id: 'sd-3', document_type: 'Delegation Log', status: 'received' }),
    ]
    const packet = buildStudyRegulatoryPacket(study, [], docs)
    const signals = buildStudyRegulatorySignals(study.id, packet, docs)
    const critical = signals.filter((s) => s.severity === 'critical')
    expect(critical.some((s) => s.title.includes('IRB Approval'))).toBe(true)
  })

  it('flags rejected study-specific document as critical', () => {
    const study = makeStudy()
    const docs: StudyRegulatoryDocumentEntry[] = [
      makeStudyDoc({ id: 'sd-1', document_type: 'ICF Approval', status: 'rejected' }),
      makeStudyDoc({ document_type: 'IRB Approval', status: 'approved' }),
      makeStudyDoc({ document_type: '1572', status: 'received' }),
      makeStudyDoc({ document_type: 'Delegation Log', status: 'received' }),
    ]
    const packet = buildStudyRegulatoryPacket(study, [], docs)
    const signals = buildStudyRegulatorySignals(study.id, packet, docs)
    expect(signals.some((s) => s.title.includes('Rejected'))).toBe(true)
  })

  it('flags missing IRB Approval, 1572, and Delegation Log', () => {
    const study = makeStudy()
    const docs: StudyRegulatoryDocumentEntry[] = [] // nothing recorded
    const packet = buildStudyRegulatoryPacket(study, [], docs)
    const signals = buildStudyRegulatorySignals(study.id, packet, docs)
    expect(signals.some((s) => s.id === 'reg-irb-approval')).toBe(true)
    expect(signals.some((s) => s.id === 'reg-1572')).toBe(true)
    expect(signals.some((s) => s.id === 'reg-delegation-log')).toBe(true)
  })

  it('countRegulatorySignals returns correct counts', () => {
    const study = makeStudy()
    const docs: StudyRegulatoryDocumentEntry[] = []
    const packet = buildStudyRegulatoryPacket(study, [], docs)
    const signals = buildStudyRegulatorySignals(study.id, packet, docs)
    const counts = countRegulatorySignals(signals)
    // IRB (critical), 1572 (critical), Delegation Log (warning)
    expect(counts.critical).toBe(2)
    expect(counts.warning).toBe(1)
    expect(counts.total).toBe(3)
  })
})
