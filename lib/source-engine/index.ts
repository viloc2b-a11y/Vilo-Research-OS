// =============================================================================
// Phase 1 — Clinical source engine foundation
// =============================================================================

export type * from '@/lib/source-engine/definitions/types'
export * from '@/lib/source-engine/definitions/domains'
export * from '@/lib/source-engine/definitions/field.catalog'
export * from '@/lib/source-engine/definitions/section.catalog'
export * from '@/lib/source-engine/definitions/template.examples'

export * from '@/lib/source-engine/runtime/runtime-context'
export * from '@/lib/source-engine/runtime/runtime-state'
export * from '@/lib/source-engine/runtime/runtime-resolver'

export * from '@/lib/source-engine/rules/rule.types'
export * from '@/lib/source-engine/rules/rule-engine'
export * from '@/lib/source-engine/rules/clinical-rules.examples'

export * from '@/lib/source-engine/validators/validation.types'
export * from '@/lib/source-engine/validators/validation-engine'
export * from '@/lib/source-engine/validators/zod-adapter'

export * from '@/lib/source-engine/calculators/calculation.types'
export * from '@/lib/source-engine/calculators/calculation-engine'
export * from '@/lib/source-engine/calculators/clinical-calculators'
export * from '@/lib/source-engine/calculators/derived-metrics.catalog'

export * from '@/lib/source-engine/workflow/workflow.types'
export * from '@/lib/source-engine/workflow/workflow-engine'
export * from '@/lib/source-engine/workflow/task-materializer'

export * from '@/lib/source-engine/audit/audit.types'
export * from '@/lib/source-engine/audit/signature-policy'

export { runPhase1Examples } from '@/lib/source-engine/examples.phase1'

// Phase 2 — runtime bridge (import via `@/lib/source-engine/adapters/index`)
export * from '@/lib/source-engine/adapters/index'

// Phase 3D — template resolution from published source definitions
export * from '@/lib/source-engine/resolution/index'

// Phase 3E — operational event logging
export * from '@/lib/source-engine/telemetry/index'

// Frequently used legacy entry points (aliases — prefer Phase 1 APIs for new code)
export { initViloEngine } from '@/lib/source-engine/init'
export type { ViloEngineInit } from '@/lib/source-engine/init'
export { runAllExamples } from '@/lib/source-engine/examples.runtime'

/** @deprecated Import from `@/lib/source-engine/legacy` */
export * as Legacy from '@/lib/source-engine/legacy'
