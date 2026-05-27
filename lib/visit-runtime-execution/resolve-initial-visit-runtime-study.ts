export type ResolveInitialVisitRuntimeStudyInput = {
  queryStudyId: string | null
  accessibleStudyIds: string[]
}

export type ResolveInitialVisitRuntimeStudyResult = {
  initialStudyId: string | null
  invalidStudyIdFromQuery: boolean
}

export function resolveInitialVisitRuntimeStudy(
  input: ResolveInitialVisitRuntimeStudyInput,
): ResolveInitialVisitRuntimeStudyResult {
  const queryStudyId = input.queryStudyId?.trim() || null
  if (!queryStudyId) {
    return { initialStudyId: null, invalidStudyIdFromQuery: false }
  }
  if (input.accessibleStudyIds.includes(queryStudyId)) {
    return { initialStudyId: queryStudyId, invalidStudyIdFromQuery: false }
  }
  return { initialStudyId: null, invalidStudyIdFromQuery: true }
}

export function resolveVisitRuntimeClientStudyId(
  studies: Array<{ id: string }>,
  initialStudyId: string | null,
  invalidStudyIdFromQuery: boolean,
): string {
  if (invalidStudyIdFromQuery) return ''
  if (initialStudyId && studies.some((study) => study.id === initialStudyId)) {
    return initialStudyId
  }
  return studies[0]?.id ?? ''
}
