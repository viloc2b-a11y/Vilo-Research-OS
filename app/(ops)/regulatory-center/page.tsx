import { CoordinatorPageScroll } from '@/components/runtime-ui/CoordinatorPageScroll'
import { createServerClient } from '@/lib/supabase/server'
import { getSessionUser, getPrimaryOrganizationId } from '@/lib/auth/session'
import { loadRegulatoryPersonnel } from '@/lib/regulatory-center/regulatory-personnel'
import { loadRegulatoryDocuments } from '@/lib/regulatory-center/regulatory-master-documents'
import { loadOrgStudies, loadStudyLinks } from '@/lib/regulatory-center/study-regulatory-links'
import { loadStudyRegulatoryDocuments } from '@/lib/regulatory-center/study-regulatory-documents'
import { RegulatoryCenterTabs } from '@/components/regulatory-center/regulatory-center-tabs'

export default async function RegulatoryCenterPage() {
  const user = await getSessionUser()
  let personnel: Awaited<ReturnType<typeof loadRegulatoryPersonnel>> = []
  let orgId: string | null = null

  if (user) {
    orgId = await getPrimaryOrganizationId(user.id)
    if (orgId) {
      const supabase = await createServerClient()
      personnel = await loadRegulatoryPersonnel(supabase, orgId)
    }
  }

  let documents: Awaited<ReturnType<typeof loadRegulatoryDocuments>> = []
  let studies: Awaited<ReturnType<typeof loadOrgStudies>> = []
  let links: Awaited<ReturnType<typeof loadStudyLinks>> = []
  let studyRegDocs: Record<string, Awaited<ReturnType<typeof loadStudyRegulatoryDocuments>>> = {}

  if (orgId) {
    const supabase = await createServerClient()
    documents = await loadRegulatoryDocuments(supabase, orgId, { personnel })
    studies = await loadOrgStudies(supabase, orgId)
    const linkedStudies = studies.slice(0, 20)
    const allLinks = await Promise.all(
      linkedStudies.map((s) => loadStudyLinks(supabase, orgId, s.id)),
    )
    links = allLinks.flat()

    for (const s of linkedStudies) {
      studyRegDocs[s.id] = await loadStudyRegulatoryDocuments(supabase, s.id)
    }
  }

  return (
    <CoordinatorPageScroll>
      <RegulatoryCenterTabs
        personnel={personnel}
        documents={documents}
        studies={studies}
        links={links}
        studyRegDocs={studyRegDocs}
        organizationId={orgId ?? ''}
      />
    </CoordinatorPageScroll>
  )
}
