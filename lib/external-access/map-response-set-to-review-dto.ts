/**
 * Map internal RPC response-set detail → external-safe SourceReviewDto.
 * Strips structured_payload, lineage, operational_event_id, and history.
 */

import type { ResponseSetDetailData, SourceValuePayload } from '@/lib/api/source/read-types'
import {
  buildSourceReviewDto,
  type SourceReviewCorrectionStatus,
  type SourceReviewDto,
} from '@/lib/external-access/source-review-dto'

function formatSubmittedValue(value: SourceValuePayload | null | undefined): string | number | boolean | null {
  if (!value) return null
  if (value.value_text != null) return value.value_text
  if (value.value_number != null) return value.value_number
  if (value.value_boolean != null) return value.value_boolean
  if (value.value_date != null) return value.value_date
  if (value.value_datetime != null) return value.value_datetime
  if (value.value_json != null) return JSON.stringify(value.value_json)
  return null
}

function resolveCorrectionStatus(detail: ResponseSetDetailData): SourceReviewCorrectionStatus {
  if (detail.addenda.length > 0) return 'approved_addendum'
  if (detail.corrections.length > 0) return 'approved_correction'
  return 'none'
}

export type ResponseSetReviewLabels = {
  visit_label?: string
  procedure_label?: string
  subject_display_code?: string | null
  procedure_execution_status?: string | null
}

export function mapResponseSetDetailToSourceReviewDto(
  detail: ResponseSetDetailData,
  labels: ResponseSetReviewLabels = {},
): SourceReviewDto {
  const meta = detail.response_set
  const submittedField = detail.fields.find((f) => f.current_effective?.is_submitted)

  return buildSourceReviewDto({
    response_set_id: meta.id,
    study_id: meta.study_id,
    subject_display_code: labels.subject_display_code ?? null,
    visit_label: labels.visit_label ?? 'Visit',
    procedure_label: labels.procedure_label ?? 'Procedure',
    procedure_execution_status: labels.procedure_execution_status ?? meta.status,
    fields: detail.fields
      .filter((f) => f.current_effective?.is_submitted)
      .map((f) => ({
        field_label: f.field_key,
        submitted_value: formatSubmittedValue(f.current_effective?.value ?? null),
      })),
    submitted_at: meta.submitted_at ?? submittedField?.current_effective?.submitted_at ?? null,
    submitted_by_role: submittedField?.current_effective?.originator_role ?? null,
    correction_status: resolveCorrectionStatus(detail),
  })
}
