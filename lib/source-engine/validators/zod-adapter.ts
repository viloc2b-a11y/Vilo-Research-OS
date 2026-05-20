/**
 * Zod adapter — maps FieldDefinition metadata to Zod schema hints.
 * Full runtime Zod generation lives in src/vilo-engine for React clients.
 */

import type { FieldDefinition, SourceTemplateDefinition } from '@/lib/source-engine/definitions/types'

export type ZodFieldSchemaMeta = {
  fieldId: string
  zodType: string
  optional: boolean
  constraints: string[]
}

export function fieldToZodMeta(field: FieldDefinition): ZodFieldSchemaMeta {
  const constraints: string[] = []
  let zodType = 'z.unknown()'

  switch (field.type) {
    case 'text':
    case 'textarea':
      zodType = 'z.string()'
      if (field.validation?.minLength) constraints.push(`.min(${field.validation.minLength})`)
      if (field.validation?.maxLength) constraints.push(`.max(${field.validation.maxLength})`)
      if (field.validation?.pattern) constraints.push(`.regex(/${field.validation.pattern}/)`)
      break
    case 'number':
    case 'integer':
    case 'decimal':
      zodType = field.type === 'integer' ? 'z.coerce.number().int()' : 'z.coerce.number()'
      if (field.validation?.min != null) constraints.push(`.min(${field.validation.min})`)
      if (field.validation?.max != null) constraints.push(`.max(${field.validation.max})`)
      break
    case 'boolean':
      zodType = 'z.boolean()'
      break
    case 'date':
      zodType = 'z.string().regex(/^\\d{4}-\\d{2}-\\d{2}$/)'
      break
    case 'datetime':
      zodType = 'z.string().datetime()'
      break
    case 'time':
      zodType = 'z.string()'
      break
    case 'select':
    case 'radio':
      if (field.validation?.enumValues?.length || field.options?.length) {
        const vals = field.validation?.enumValues ?? field.options?.map((o) => o.value) ?? []
        zodType = `z.enum([${vals.map((v) => `'${v}'`).join(', ')}])`
      } else {
        zodType = 'z.string()'
      }
      break
    case 'multiselect':
    case 'checkbox':
      zodType = 'z.array(z.string())'
      break
    case 'unit_value':
      zodType = 'z.object({ value: z.number(), unit: z.string() })'
      break
    case 'calculated':
      zodType = 'z.union([z.number(), z.string(), z.null()])'
      break
    case 'signature':
    case 'file_upload':
      zodType = 'z.string()'
      break
  }

  return {
    fieldId: field.id,
    zodType,
    optional: !field.validation?.required,
    constraints,
  }
}

export function templateToZodMeta(template: SourceTemplateDefinition): ZodFieldSchemaMeta[] {
  return template.fields.map(fieldToZodMeta)
}

/** Placeholder object schema descriptor for publish packages / documentation. */
export function buildZodSchemaDescriptor(template: SourceTemplateDefinition): string {
  const lines = templateToZodMeta(template).map(
    (m) => `  ${m.fieldId}: ${m.zodType}${m.constraints.join('')}${m.optional ? '.optional().nullable()' : ''},`,
  )
  return `z.object({\n${lines.join('\n')}\n})`
}
