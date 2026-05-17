/**
 * Phase 5.2D — CRC capture shell view-models.
 */

import type { ManifestViewModel, ReadPanelError } from '@/lib/source/read-contract/view-models'

export type CaptureFieldKind = 'text' | 'number' | 'date' | 'boolean' | 'select' | 'json'

export type CaptureFieldValue = {
  text?: string
  number?: number
  boolean?: boolean
  date?: string
  json?: string
}

export type CaptureFieldViewModel = {
  fieldId: string
  fieldKey: string
  label: string
  kind: CaptureFieldKind
  isRequired: boolean
  options: string[]
  value: CaptureFieldValue
}

export type CaptureProcedureContext = {
  procedureExecutionId: string
  organizationId: string
  studyId: string
  studyVersionId: string | null
  studySubjectId: string
  visitId: string
  sourceDefinitionVersionId: string
  procedureLabel: string
  visitLabel: string
  subjectLabel: string
  studyName: string
  visitPath: string
  studyPath: string
  subjectPath: string
}

export type CaptureShellViewModel = {
  context: CaptureProcedureContext
  responseSetId: string
  statusLabel: string
  canEdit: boolean
  isSubmitted: boolean
  openedAtDisplay: string | null
  submittedAtDisplay: string | null
  manifest: ManifestViewModel | null
  fields: CaptureFieldViewModel[]
  reviewHref: string
}

export type CaptureActionMessage = {
  kind: 'success' | 'error' | 'info'
  title: string
  messages: string[]
  warnings?: string[]
  requestId?: string | null
}

export type CaptureActionState = {
  message: CaptureActionMessage | null
}

export const INITIAL_CAPTURE_ACTION_STATE: CaptureActionState = { message: null }

export type CaptureShellLoadResult =
  | { status: 'success'; model: CaptureShellViewModel }
  | { status: 'error'; error: ReadPanelError }
