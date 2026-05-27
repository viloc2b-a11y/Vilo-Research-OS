export type StudyWorkspaceRuntimeLinks = {
  protocolIntake: string
  protocolReconciliation: string
  protocolRuntimeGeneration: string
  sourcePackages: string
  publishedSource: string
  visitRuntime: string
  documentIntake: string
  documentIntelligence: string
  sourceBlueprintEvidence: string
  sourceBlueprintDrafting: string
  sourceBlueprintSignoff: string
  operationalSignatures: string
  operationalReview: string
  studySubjects: string
  studyDetail: string
}

export function buildStudyWorkspaceRuntimeLinks(studyId: string): StudyWorkspaceRuntimeLinks {
  const q = encodeURIComponent(studyId)
  return {
    protocolIntake: `/protocol-intake-runtime?study_id=${q}`,
    protocolReconciliation: `/protocol-reconciliation?study_id=${q}`,
    protocolRuntimeGeneration: `/protocol-runtime-generation?study_id=${q}`,
    sourcePackages: `/runtime-source-packages?study_id=${q}`,
    publishedSource: `/runtime-source-publication?study_id=${q}`,
    visitRuntime: `/visit-runtime?study_id=${q}`,
    documentIntake: `/document-intake?study_id=${q}`,
    documentIntelligence: `/document-intelligence?study_id=${q}`,
    sourceBlueprintEvidence: `/source-blueprint-evidence?study_id=${q}`,
    sourceBlueprintDrafting: `/source-blueprint-drafting?study_id=${q}`,
    sourceBlueprintSignoff: `/source-blueprint-signoff?study_id=${q}`,
    operationalSignatures: `/operational-signatures?study_id=${q}`,
    operationalReview: `/operational-review?study_id=${q}`,
    studySubjects: `/studies/${studyId}?tab=subjects`,
    studyDetail: `/studies/${studyId}`,
  }
}
