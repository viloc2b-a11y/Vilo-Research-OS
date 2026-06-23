import { createServerClient } from '@/lib/supabase/server'
import { loadOrgStudies, loadStudyLinksWithDetails } from './study-regulatory-links'
import { loadRegulatoryPersonnel } from './regulatory-personnel'
import { loadRegulatoryDocuments } from './regulatory-master-documents'
import { loadStudyRegulatoryDocuments } from './study-regulatory-documents'
import { buildStudyRegulatoryPacket } from './study-regulatory-packet'
import { buildStudyRegulatorySignals, countRegulatorySignals, type RegulatorySignal } from './regulatory-signals'
import { getSessionUser, getPrimaryOrganizationId } from '@/lib/auth/session'

/**
 * Load regulatory signals for a specific study.
 * This is the main entry point for the Command Center integration.
 */
export async function loadStudyRegulatorySignals(
  studyId: string,
): Promise<{ signals: RegulatorySignal[]; critical: number; warning: number; total: number }> {
  const supabase = await createServerClient()
  const user = await getSessionUser()
  const orgId = user ? await getPrimaryOrganizationId(user.id) : null

  if (!orgId) return { signals: [], critical: 0, warning: 0, total: 0 }

  // Load all required data
  const [personnel, documents] = await Promise.all([
    loadRegulatoryPersonnel(supabase, orgId),
    loadRegulatoryDocuments(supabase, orgId),
  ])

  const [allStudies, studySpecificDocs] = await Promise.all([
    loadOrgStudies(supabase, orgId),
    loadStudyRegulatoryDocuments(supabase, studyId),
  ])

  const study = allStudies.find((s) => s.id === studyId)
  if (!study) return { signals: [], critical: 0, warning: 0, total: 0 }

  const links = await loadStudyLinksWithDetails(supabase, orgId, studyId, personnel, documents)
  const packet = buildStudyRegulatoryPacket(study, links)
  const signals = buildStudyRegulatorySignals(studyId, packet, studySpecificDocs)
  const counts = countRegulatorySignals(signals)

  return { signals, ...counts }
}
