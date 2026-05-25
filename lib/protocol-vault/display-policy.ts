import type { StudyDisplayMode } from '@/lib/protocol-vault/types'

/** Authenticated coordinator / PI / site staff tenant workspaces. */
export const DEFAULT_OPERATIONAL_DISPLAY_MODE: StudyDisplayMode = 'operational'

/** AI, logs, exports, telemetry, benchmarks, commercial/shared artifacts, demo. */
export const DEFAULT_SANITIZED_DISPLAY_MODE: StudyDisplayMode = 'sanitized'

export type StudyDisplayContext =
  | 'coordinator_dashboard'
  | 'pi_dashboard'
  | 'site_staff_workspace'
  | 'ai_context'
  | 'logs'
  | 'exports'
  | 'telemetry'
  | 'benchmark'
  | 'commercial_artifact'
  | 'demo'

const SANITIZED_CONTEXTS = new Set<StudyDisplayContext>([
  'ai_context',
  'logs',
  'exports',
  'telemetry',
  'benchmark',
  'commercial_artifact',
  'demo',
])

const OPERATIONAL_CONTEXTS = new Set<StudyDisplayContext>([
  'coordinator_dashboard',
  'pi_dashboard',
  'site_staff_workspace',
])

export function resolveDisplayModeForContext(context: StudyDisplayContext): StudyDisplayMode {
  if (SANITIZED_CONTEXTS.has(context)) return 'sanitized'
  if (OPERATIONAL_CONTEXTS.has(context)) return 'operational'
  return DEFAULT_SANITIZED_DISPLAY_MODE
}

/** When true, operational surfaces fall back to sanitized aliases (e.g. public demo builds). */
export function isDemoSanitizedMode(): boolean {
  return process.env.VILO_DEMO_SANITIZED_MODE === 'true'
    || process.env.VILO_DEMO_SANITIZED_MODE === '1'
}

export function resolveOperationalDisplayMode(
  context: StudyDisplayContext = 'coordinator_dashboard',
): StudyDisplayMode {
  if (isDemoSanitizedMode()) return 'sanitized'
  return resolveDisplayModeForContext(context)
}
