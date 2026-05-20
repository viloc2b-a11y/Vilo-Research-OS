import { subjectVisitsPath } from '@/lib/subject/chart-paths'
import { buildRegulatorySignalsFromOperationalIntelligence } from '@/lib/subject/regulatory-signals/build-from-operational-intelligence'
import type { SubjectRegulatorySignalsModel } from '@/lib/subject/regulatory-signals/types'
import { loadSubjectOperationalIntelligence } from '@/lib/subject/operations'
import { loadSubjectWorkflowActions } from '@/lib/subject/workflow/data'

const EMPTY_SUMMARY = {
  total: 0,
  openUnresolved: 0,
  missedOowVisits: 0,
  blockedIncompleteProcedures: 0,
  unresolvedFindings: 0,
  overdueActions: 0,
}

export async function loadSubjectRegulatorySignals(input: {
  subjectId: string
  studyId: string
  organizationId: string
}): Promise<SubjectRegulatorySignalsModel> {
  const workflowResult = await loadSubjectWorkflowActions(
    input.subjectId,
    input.organizationId,
  )

  if (!workflowResult.ok) {
    return {
      hasFormalDeviationRecords: false,
      items: [],
      summary: EMPTY_SUMMARY,
      hiddenCount: 0,
      moreHref: null,
    }
  }

  const operationalResult = await loadSubjectOperationalIntelligence({
    subjectId: input.subjectId,
    studyId: input.studyId,
    organizationId: input.organizationId,
    workflowActions: workflowResult.actions,
  })

  if (!operationalResult.ok) {
    return {
      hasFormalDeviationRecords: false,
      items: [],
      summary: EMPTY_SUMMARY,
      hiddenCount: 0,
      moreHref: null,
    }
  }

  return buildRegulatorySignalsFromOperationalIntelligence(operationalResult.data, {
    moreHref: subjectVisitsPath(input.studyId, input.subjectId),
  })
}
