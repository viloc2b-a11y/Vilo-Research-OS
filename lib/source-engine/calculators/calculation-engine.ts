/**
 * Derived metric calculation engine.
 */

import {
  calculateBloodPressureDisplay,
  calculateBmi,
  calculatePackYears,
  calculatePkWindowStatus,
  calculatePlateletDropPercent,
  calculateVisitWindowStatus,
  placeholderInstrumentScore,
} from '@/lib/source-engine/calculators/clinical-calculators'
import type { DerivedMetricDefinition, SourceTemplateDefinition } from '@/lib/source-engine/definitions/types'
import type { RuntimeContext, SourceResponses } from '@/lib/source-engine/runtime/runtime-context'

function readField(responses: SourceResponses, fieldId: string) {
  return responses.fields[fieldId]
}

export function calculateMetric(
  metric: DerivedMetricDefinition,
  responses: SourceResponses,
  context: RuntimeContext,
): unknown {
  switch (metric.formula) {
    case 'bmi':
      return calculateBmi(readField(responses, 'height_cm'), readField(responses, 'weight_kg'))
    case 'pack_years':
      return calculatePackYears(
        readField(responses, 'packs_per_day'),
        readField(responses, 'years_smoked'),
      )
    case 'platelet_drop_percent':
      return calculatePlateletDropPercent(
        readField(responses, 'platelet_baseline'),
        readField(responses, 'platelet_count'),
      )
    case 'blood_pressure_display':
      return calculateBloodPressureDisplay(
        readField(responses, 'systolic_bp'),
        readField(responses, 'diastolic_bp'),
      )
    case 'visit_window_status':
      return calculateVisitWindowStatus({
        scheduledDate: context.scheduledDate,
        visitDate: context.visitDate,
        windowStartDay: (context.config?.visitWindow as { start?: number })?.start,
        windowEndDay: (context.config?.visitWindow as { end?: number })?.end,
      })
    case 'pk_window_status': {
      const pkConfig = context.config?.pk as
        | { windowMinutesBefore?: number; windowMinutesAfter?: number }
        | undefined
      return calculatePkWindowStatus(
        readField(responses, 'minutes_from_ip_start'),
        0,
        pkConfig?.windowMinutesBefore,
        pkConfig?.windowMinutesAfter,
      )
    }
    case 'cas_score':
    case 'transit_time':
    case 'womac_score':
    case 'mayo_score':
      return placeholderInstrumentScore(
        Object.fromEntries(metric.inputFieldIds.map((id) => [id, readField(responses, id)])),
      )
    default:
      return null
  }
}

export function calculateDerivedMetrics(
  metrics: DerivedMetricDefinition[],
  _template: SourceTemplateDefinition,
  responses: SourceResponses,
  context: RuntimeContext,
): Record<string, unknown> {
  const out: Record<string, unknown> = {}
  for (const metric of metrics) {
    out[metric.targetFieldId] = calculateMetric(metric, responses, context)
  }
  return out
}
