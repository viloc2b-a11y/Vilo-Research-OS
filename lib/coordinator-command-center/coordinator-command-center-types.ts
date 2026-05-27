export type CoordinatorCommandCenterStudy = {
  id: string
  name: string
}

export type CoordinatorCommandCenterItem = {
  id: string
  studyId: string
  studyName: string
  status: string
  title: string
  detail: string
  createdAt: string
  primaryActionHref: string
  secondaryActionHref?: string
  primaryActionLabel: string
  secondaryActionLabel?: string
}

export type CoordinatorCommandCenterAlert = {
  id: string
  studyId: string
  studyName: string
  alertType: 'runtime' | 'version'
  label: string
  title: string
  detail: string
  createdAt: string
  href: string
}

export type CoordinatorCommandCenterModel = {
  organizationId: string
  studies: CoordinatorCommandCenterStudy[]
  selectedStudyId: string | null
  generatedAt: string
  pendingEvidenceReviews: CoordinatorCommandCenterItem[]
  pendingDraftSuggestions: CoordinatorCommandCenterItem[]
  pendingSignatures: CoordinatorCommandCenterItem[]
  runtimeAlerts: CoordinatorCommandCenterAlert[]
  versionDriftAlerts: CoordinatorCommandCenterAlert[]
  unavailable: string[]
}
