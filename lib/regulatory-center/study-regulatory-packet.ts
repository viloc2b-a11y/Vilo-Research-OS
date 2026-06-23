import type { StudyLinkWithDetails, StudyInfo } from './study-regulatory-links'
import type { StudyRegulatoryDocumentEntry } from './study-regulatory-documents'
import { getExpirationBucket } from './regulatory-expiration'

// ── Types ────────────────────────────────────────────────────────────────────

export type PacketSection = {
  label: string
  items: PacketItem[]
}

export type PacketItem = {
  id: string
  source: 'inherited' | 'study_specific'
  type: 'personnel' | 'document'
  name: string
  subtitle: string | null
  status: string
  required: boolean
  expirationBucket?: string
  isComplete: boolean
}

export type StudyRegulatoryPacket = {
  study: StudyInfo
  personnelLinks: PacketItem[]
  documentLinks: PacketItem[]
  inheritedItems: PacketItem[]
  studySpecificItems: PacketItem[]
  allLinks: PacketItem[]
  required: {
    total: number
    complete: number
    incomplete: number
  }
  expiring: PacketItem[]
  expired: PacketItem[]
  needsReview: PacketItem[]
  readiness: number | null // 0–100, null if no required links
  readinessLabel: string
  totalLinkedPersonnel: number
  totalLinkedDocuments: number
  totalStudySpecific: number
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function getReadinessLabel(score: number | null): string {
  if (score === null) return 'No Required Items'
  if (score >= 100) return 'Complete'
  if (score >= 80) return 'Almost Complete'
  if (score >= 50) return 'In Progress'
  return 'Incomplete'
}

function isLinkComplete(link: StudyLinkWithDetails): boolean {
  if (link.status === 'inactive') return false
  if (link.status === 'needs_review') return false
  if (link.link_type === 'document') {
    const bucket = link.expiration_bucket
    if (bucket === 'expired' || bucket === 'needs_review') return false
  }
  return true
}

// ── Packet builder ───────────────────────────────────────────────────────────

/**
 * Build a regulatory packet for a study from its linked records.
 * No new DB queries — uses already-loaded data.
 */
export function buildStudyRegulatoryPacket(
  study: StudyInfo,
  links: StudyLinkWithDetails[],
  studySpecificDocs: StudyRegulatoryDocumentEntry[] = [],
): StudyRegulatoryPacket {
  // Include active + needs_review links; exclude inactive
  const relevantLinks = links.filter((l) => l.status !== 'inactive')

  // Build packet items from inherited links
  const inheritedItems: PacketItem[] = relevantLinks.map((link) => {
    const isPersonnel = link.link_type === 'personnel'
    return {
      id: link.id,
      source: 'inherited',
      type: link.link_type as 'personnel' | 'document',
      name: isPersonnel ? (link.personnel_name ?? 'Unknown') : (link.document_title ?? 'Unknown'),
      subtitle: isPersonnel ? link.personnel_role ?? null : `${link.document_type ?? ''}${link.expiration_date ? ` · Exp: ${new Date(link.expiration_date).toLocaleDateString()}` : ''}`,
      status: link.status,
      required: link.required,
      expirationBucket: link.expiration_bucket,
      isComplete: isLinkComplete(link),
    }
  })

  // Build packet items from study-specific docs
  const studySpecificItems: PacketItem[] = studySpecificDocs.map((doc) => ({
    id: doc.id,
    source: 'study_specific',
    type: 'document',
    name: doc.document_title,
    subtitle: `${doc.document_type}${doc.owner_role ? ` · Owner: ${doc.owner_role}` : ''}${doc.expiration_date ? ` · Exp: ${new Date(doc.expiration_date).toLocaleDateString()}` : ''}`,
    status: doc.status,
    required: doc.required,
    expirationBucket: doc.expiration_date ? (() => {
      const now = new Date()
      const exp = new Date(doc.expiration_date)
      const days = Math.ceil((exp.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
      if (days < 0) return 'expired'
      if (days <= 30) return 'expiring_30'
      if (days <= 60) return 'expiring_60'
      if (days <= 90) return 'expiring_90'
      return 'valid'
    })() : undefined,
    isComplete: doc.status === 'approved' || doc.status === 'submitted' || doc.status === 'received',
  }))

  const allItems = [...inheritedItems, ...studySpecificItems]

  const personnelLinks = allItems.filter((i) => i.type === 'personnel')
  const documentLinks = allItems.filter((i) => i.type === 'document')

  // Required items
  const requiredItems = allItems.filter((i) => i.required)
  const requiredTotal = requiredItems.length
  const requiredComplete = requiredItems.filter((i) => i.isComplete).length
  const requiredIncomplete = requiredTotal - requiredComplete
  const readiness = requiredTotal > 0 ? Math.round((requiredComplete / requiredTotal) * 100) : null

  // Expiring / expired
  const expiring = allItems.filter(
    (i) => i.expirationBucket && ['expiring_30', 'expiring_60', 'expiring_90'].includes(i.expirationBucket),
  )
  const expired = allItems.filter((i) => i.expirationBucket === 'expired')
  const needsReview = allItems.filter(
    (i) => i.status === 'needs_review' || i.expirationBucket === 'needs_review',
  )

  return {
    study,
    personnelLinks,
    documentLinks,
    inheritedItems,
    studySpecificItems,
    allLinks: allItems,
    required: {
      total: requiredTotal,
      complete: requiredComplete,
      incomplete: requiredIncomplete,
    },
    expiring,
    expired,
    needsReview,
    readiness,
    readinessLabel: getReadinessLabel(readiness),
    totalLinkedPersonnel: personnelLinks.length,
    totalLinkedDocuments: documentLinks.length,
    totalStudySpecific: studySpecificItems.length,
  }
}
