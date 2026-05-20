/**
 * Clinical validation engine — field, section, template, signature readiness.
 */

import type {
  FieldDefinition,
  RepeatableSectionDefinition,
  SectionDefinition,
  SourceTemplateDefinition,
  ValidationResult,
} from '@/lib/source-engine/definitions/types'
import type { RuntimeContext, SourceResponses } from '@/lib/source-engine/runtime/runtime-context'
import type { RuntimeFieldState } from '@/lib/source-engine/runtime/runtime-state'
import type { TemplateValidationSummary, ValidationContext } from '@/lib/source-engine/validators/validation.types'

function isEmpty(value: unknown): boolean {
  return value == null || value === '' || (Array.isArray(value) && value.length === 0)
}

function finding(
  partial: Omit<ValidationResult, 'blocksSubmission' | 'blocksSignature'> & {
    blocksSubmission?: boolean
    blocksSignature?: boolean
  },
): ValidationResult {
  return {
    ...partial,
    blocksSubmission:
      partial.blocksSubmission ??
      (partial.severity === 'error' || partial.severity === 'critical'),
    blocksSignature: partial.blocksSignature ?? partial.severity === 'critical',
  }
}

export function validateField(
  field: FieldDefinition,
  value: unknown,
  responses: SourceResponses,
  context: RuntimeContext,
  fieldState?: RuntimeFieldState,
): ValidationResult[] {
  const results: ValidationResult[] = []

  if (fieldState && !fieldState.visible) return results

  const required = fieldState?.required ?? field.validation?.required
  if (required && isEmpty(value)) {
    results.push(
      finding({
        fieldId: field.id,
        severity: 'error',
        code: 'REQUIRED_FIELD_EMPTY',
        message: `${field.label} is required`,
      }),
    )
  }

  if (field.type === 'calculated' && !field.validation?.allowManualOverride) {
    const manualEdit = responses.previousFields?.[field.id] !== undefined && value != null
    if (manualEdit && fieldState?.calculatedValue !== value) {
      results.push(
        finding({
          fieldId: field.id,
          severity: 'error',
          code: 'CALCULATED_FIELD_MANUAL_EDIT',
          message: `${field.label} is calculated and cannot be manually edited`,
        }),
      )
    }
  }

  if (typeof value === 'number' && field.validation) {
    if (field.validation.min != null && value < field.validation.min) {
      results.push(
        finding({
          fieldId: field.id,
          severity: 'error',
          code: 'VALUE_BELOW_MIN',
          message: field.validation.message ?? `${field.label} below minimum`,
        }),
      )
    }
    if (field.validation.max != null && value > field.validation.max) {
      results.push(
        finding({
          fieldId: field.id,
          severity: 'error',
          code: 'VALUE_ABOVE_MAX',
          message: field.validation.message ?? `${field.label} above maximum`,
        }),
      )
    }
  }

    // Date before consent
  if (field.type === 'date' && field.id !== 'consent_date' && typeof value === 'string') {
    const consent = responses.fields.consent_date
    if (typeof consent === 'string' && value < consent) {
      results.push(
        finding({
          fieldId: field.id,
          severity: 'error',
          code: 'DATE_BEFORE_CONSENT',
          message: 'Date cannot precede informed consent date',
        }),
      )
    }
  }

  if (
    (context.signatureState === 'signed' || context.signatureState === 'locked' || context.locked) &&
    !context.correctionMode &&
    !context.addendumMode &&
    responses.previousFields?.[field.id] !== undefined
  ) {
    results.push(
      finding({
        fieldId: field.id,
        severity: 'critical',
        code: 'SIGNED_SOURCE_EDIT_WITHOUT_WORKFLOW',
        message: 'Signed or locked source cannot be edited without correction reason',
        blocksSignature: true,
      }),
    )
  }

  return results
}

export function validateRepeatableSection(
  section: RepeatableSectionDefinition,
  responses: SourceResponses,
  context: RuntimeContext,
  fieldsById: Map<string, FieldDefinition>,
): ValidationResult[] {
  const results: ValidationResult[] = []
  const rows = responses.repeatableSections?.[section.id] ?? []

  if (rows.length < section.minRows) {
    results.push(
      finding({
        repeatableSectionId: section.id,
        severity: 'error',
        code: 'SECTION_MIN_ROWS',
        message: `${section.label} requires at least ${section.minRows} row(s)`,
      }),
    )
  }

  for (const row of rows) {
    if (row.disabled) continue
    for (const fieldId of section.childFieldIds) {
      const field = fieldsById.get(fieldId)
      if (!field) continue
      results.push(...validateField(field, row.fields[fieldId], responses, context))
    }

    // AE: resolved requires end date
    if (section.entityType === 'adverse_event') {
      const outcome = row.fields.outcome
      const endDate = row.fields.ae_end_date
      if (
        (outcome === 'recovered' || outcome === 'fatal') &&
        isEmpty(endDate)
      ) {
        results.push(
          finding({
            repeatableSectionId: section.id,
            rowInstanceId: row.instanceId,
            fieldId: 'ae_end_date',
            severity: 'error',
            code: 'AE_RESOLVED_REQUIRES_END_DATE',
            message: 'Resolved or fatal AE requires end date',
          }),
        )
      }
      if (row.fields.seriousness === true) {
        const hasSeriousnessDetail =
          !isEmpty(row.fields.severity) && !isEmpty(row.fields.relationship_to_ip)
        if (!hasSeriousnessDetail) {
          results.push(
            finding({
              repeatableSectionId: section.id,
              rowInstanceId: row.instanceId,
              severity: 'error',
              code: 'SAE_REQUIRES_CRITERIA',
              message: 'Serious AE requires seriousness criteria fields',
            }),
          )
        }
      }
    }

    // ConMed indication = AE requires linked AE
    if (section.entityType === 'conmed_entry') {
      const indication = row.fields.indication
      if (
        typeof indication === 'string' &&
        indication.toLowerCase().includes('adverse') &&
        isEmpty(row.fields.related_ae_id)
      ) {
        results.push(
          finding({
            repeatableSectionId: section.id,
            rowInstanceId: row.instanceId,
            fieldId: 'related_ae_id',
            severity: 'error',
            code: 'CONMED_AE_REQUIRES_LINK',
            message: 'Concomitant medication with AE indication requires linked AE',
          }),
        )
      }
    }
  }

  return results
}

export function validateSection(
  section: SectionDefinition,
  responses: SourceResponses,
  context: RuntimeContext,
  fieldsById: Map<string, FieldDefinition>,
  fieldStates?: Map<string, RuntimeFieldState>,
): ValidationResult[] {
  const results: ValidationResult[] = []
  for (const fieldId of section.fieldIds) {
    const field = fieldsById.get(fieldId)
    if (!field) continue
    results.push(
      ...validateField(
        field,
        responses.fields[fieldId],
        responses,
        context,
        fieldStates?.get(fieldId),
      ),
    )
  }
  return results
}

export function validateTemplate(
  template: SourceTemplateDefinition,
  responses: SourceResponses,
  context: RuntimeContext,
  validationCtx: ValidationContext = {},
): ValidationResult[] {
  const fieldsById = new Map(template.fields.map((f) => [f.id, f]))
  const results: ValidationResult[] = []

  for (const section of template.sections) {
    results.push(
      ...validateSection(section, responses, context, fieldsById, validationCtx.fieldStates),
    )
  }

  for (const rs of template.repeatableSections) {
    results.push(...validateRepeatableSection(rs, responses, context, fieldsById))
  }

  // Visit window warning
  if (context.visitDate && context.scheduledDate) {
    const scheduled = new Date(context.scheduledDate).getTime()
    const actual = new Date(context.visitDate).getTime()
    const diff = Math.abs(Math.round((actual - scheduled) / (1000 * 60 * 60 * 24)))
    const warnDays =
      (context.config?.visitWindow as { warningDaysOutside?: number } | undefined)
        ?.warningDaysOutside ?? 3
    const errorDays =
      (context.config?.visitWindow as { errorDaysOutside?: number } | undefined)
        ?.errorDaysOutside ?? 7
    if (diff > errorDays) {
      results.push(
        finding({
          severity: 'error',
          code: 'VISIT_OUTSIDE_WINDOW',
          message: 'Visit date is outside protocol window',
        }),
      )
    } else if (diff > warnDays) {
      results.push(
        finding({
          severity: 'warning',
          code: 'VISIT_WINDOW_WARNING',
          message: 'Visit date is near edge of protocol window',
          blocksSubmission: false,
        }),
      )
    }
  }

  return results
}

export function validateForSignature(
  template: SourceTemplateDefinition,
  responses: SourceResponses,
  context: RuntimeContext,
  validationCtx: ValidationContext = {},
): TemplateValidationSummary {
  const results = validateTemplate(template, responses, context, validationCtx)
  const blocking = results.filter((r) => r.blocksSignature || r.severity === 'critical')
  return {
    valid: blocking.length === 0,
    results,
    blocksSubmission: results.some((r) => r.blocksSubmission),
    blocksSignature: blocking.length > 0,
  }
}
