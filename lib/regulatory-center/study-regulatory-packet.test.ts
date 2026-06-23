import { describe, expect, it } from 'vitest'
import { buildStudyRegulatoryPacket } from './study-regulatory-packet'
import type { StudyLinkWithDetails, StudyInfo } from './study-regulatory-links'

function makeStudy(over: Partial<StudyInfo> = {}): StudyInfo {
  return { id: 'study-1', name: 'Test Study', status: 'active', ...over }
}

function makeLink(over: Partial<StudyLinkWithDetails> = {}): StudyLinkWithDetails {
  return {
    id: 'link-1',
    organization_id: 'org-1',
    study_id: 'study-1',
    link_type: 'personnel',
    personnel_id: 'p-1',
    master_document_id: null,
    required: false,
    status: 'active',
    notes: null,
    created_by: null,
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-01-01T00:00:00Z',
    ...over,
  }
}

const futureDate = (daysFromNow: number): string => {
  const d = new Date(); d.setDate(d.getDate() + daysFromNow); return d.toISOString().slice(0, 10)
}
const pastDate = (daysAgo: number): string => {
  const d = new Date(); d.setDate(d.getDate() - daysAgo); return d.toISOString().slice(0, 10)
}

describe('buildStudyRegulatoryPacket', () => {
  it('returns empty packet for study with no links', () => {
    const packet = buildStudyRegulatoryPacket(makeStudy(), [])
    expect(packet.totalLinkedPersonnel).toBe(0)
    expect(packet.totalLinkedDocuments).toBe(0)
    expect(packet.required.total).toBe(0)
    expect(packet.readiness).toBeNull()
    expect(packet.readinessLabel).toBe('No Required Items')
  })

  it('counts personnel and document links correctly', () => {
    const links: StudyLinkWithDetails[] = [
      makeLink({ id: '1', link_type: 'personnel', personnel_name: 'Dr. A', personnel_role: 'PI' }),
      makeLink({ id: '2', link_type: 'personnel', personnel_name: 'Dr. B', personnel_role: 'Sub-I' }),
      makeLink({ id: '3', link_type: 'document', document_title: 'CV', document_type: 'CV' }),
    ]
    const packet = buildStudyRegulatoryPacket(makeStudy(), links)
    expect(packet.totalLinkedPersonnel).toBe(2)
    expect(packet.totalLinkedDocuments).toBe(1)
    expect(packet.allLinks).toHaveLength(3)
  })

  it('excludes inactive links from counts', () => {
    const links: StudyLinkWithDetails[] = [
      makeLink({ id: '1', link_type: 'personnel', personnel_name: 'Dr. A', status: 'active' }),
      makeLink({ id: '2', link_type: 'personnel', personnel_name: 'Dr. B', status: 'inactive' }),
    ]
    const packet = buildStudyRegulatoryPacket(makeStudy(), links)
    expect(packet.totalLinkedPersonnel).toBe(1)
    expect(packet.allLinks).toHaveLength(1)
  })

  it('calculates readiness correctly when all required are complete', () => {
    const links: StudyLinkWithDetails[] = [
      makeLink({ id: '1', link_type: 'personnel', personnel_name: 'Dr. A', required: true }),
      makeLink({ id: '2', link_type: 'document', document_title: 'CV', required: true, expiration_date: futureDate(200), expiration_bucket: 'valid' }),
    ]
    const packet = buildStudyRegulatoryPacket(makeStudy(), links)
    expect(packet.required.total).toBe(2)
    expect(packet.required.complete).toBe(2)
    expect(packet.readiness).toBe(100)
    expect(packet.readinessLabel).toBe('Complete')
  })

  it('flags expired required documents as incomplete', () => {
    const links: StudyLinkWithDetails[] = [
      makeLink({ id: '1', link_type: 'document', document_title: 'License', required: true, expiration_date: pastDate(10), expiration_bucket: 'expired' }),
    ]
    const packet = buildStudyRegulatoryPacket(makeStudy(), links)
    expect(packet.required.total).toBe(1)
    expect(packet.required.complete).toBe(0)
    expect(packet.required.incomplete).toBe(1)
    expect(packet.readiness).toBe(0)
    expect(packet.expired).toHaveLength(1)
  })

  it('categories expiring documents correctly', () => {
    const links: StudyLinkWithDetails[] = [
      makeLink({ id: '1', link_type: 'document', document_title: 'GCP', expiration_date: futureDate(15), expiration_bucket: 'expiring_30' }),
      makeLink({ id: '2', link_type: 'document', document_title: 'License', expiration_date: futureDate(45), expiration_bucket: 'expiring_60' }),
      makeLink({ id: '3', link_type: 'document', document_title: 'DEA', expiration_date: futureDate(200), expiration_bucket: 'valid' }),
    ]
    const packet = buildStudyRegulatoryPacket(makeStudy(), links)
    expect(packet.expiring).toHaveLength(2)
    expect(packet.expired).toHaveLength(0)
  })

  it('flags needs_review links', () => {
    const links: StudyLinkWithDetails[] = [
      makeLink({ id: '1', link_type: 'document', document_title: 'CV', status: 'needs_review' }),
    ]
    const packet = buildStudyRegulatoryPacket(makeStudy(), links)
    expect(packet.needsReview).toHaveLength(1)
  })
})
