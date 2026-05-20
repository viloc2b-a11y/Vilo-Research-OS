export type { ValidationResult, ValidationSeverity } from '@/lib/source-engine/definitions/types'

export type ValidationContext = {
  fieldStates?: Map<string, import('@/lib/source-engine/runtime/runtime-state').RuntimeFieldState>
  sectionStates?: Map<string, import('@/lib/source-engine/runtime/runtime-state').RuntimeSectionState>
}

export type TemplateValidationSummary = {
  valid: boolean
  results: import('@/lib/source-engine/definitions/types').ValidationResult[]
  blocksSubmission: boolean
  blocksSignature: boolean
}
