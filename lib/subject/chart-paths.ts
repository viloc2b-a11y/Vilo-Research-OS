import {
  performanceSubjectPath,
  performanceSubjectVisitsPath,
  performanceVisitPath,
  sourceCapturePath,
  sourceResponseSetPath,
  studyDetailPath,
  subjectChartPath,
  subjectChartTabPath,
  subjectClinicalProfilePath,
  subjectConMedsTabPath,
  subjectAdverseEventsTabPath,
  subjectAeTabPath,
  subjectDeviationsTabPath,
  subjectVisitsPath,
  visitDetailPath,
} from '@/lib/ops/paths'

export {
  performanceSubjectPath,
  performanceSubjectVisitsPath,
  performanceVisitPath,
  sourceCapturePath,
  sourceResponseSetPath,
  studyDetailPath,
  subjectChartPath,
  subjectChartTabPath,
  subjectClinicalProfilePath,
  subjectConMedsTabPath,
  subjectAdverseEventsTabPath,
  subjectAeTabPath,
  subjectDeviationsTabPath,
  subjectVisitsPath,
  visitDetailPath,
}

/** Alias kept for existing imports. */
export function subjectChartTabHref(
  studyId: string | null,
  subjectId: string,
  tab: string,
) {
  return subjectChartTabPath(studyId, subjectId, tab)
}
