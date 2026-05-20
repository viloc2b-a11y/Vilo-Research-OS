import { loadPerformanceReadModel } from '@/app/(ops)/performance/_lib/performance-read-model'
import { getOrganizationMemberships, getSessionUser } from '@/lib/auth/session'

export async function loadPerformancePageModel(studyIdParam?: string | null) {
  const selectedStudyId = studyIdParam?.trim() || null
  const user = await getSessionUser()
  const memberships = user ? await getOrganizationMemberships(user.id) : []
  const orgIds = memberships.map((m) => m.organization_id)
  const userId = user?.id ?? null
  const model = await loadPerformanceReadModel(orgIds, selectedStudyId, userId)
  return { model, userId }
}

export function sectionLoadFailed(
  errors: { source: string }[],
  sources: string[],
): boolean {
  return errors.some((e) =>
    sources.some((source) => e.source === source || e.source.startsWith(`${source}_`)),
  )
}
