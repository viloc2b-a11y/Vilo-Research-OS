/**
 * Zod schemas generated 1:1 from VILO_FIELD_CATALOG FieldSpec definitions.
 */

import { z } from 'zod'
import { FieldType, type FieldSpec } from '@/lib/source-engine/canonical'
import { VILO_FIELD_CATALOG } from '@/lib/source-engine/vilo-field-catalog'

function fieldSpecToZod(spec: FieldSpec): z.ZodTypeAny {
  let schema: z.ZodTypeAny

  switch (spec.type) {
    case FieldType.TEXT:
      schema = z.string().trim()
      if (spec.validation?.pattern) {
        schema = (schema as z.ZodString).regex(
          spec.validation.patternRegex ?? new RegExp(spec.validation.pattern),
          spec.validation.message ?? `${spec.label} format invalid`,
        )
      }
      break
    case FieldType.NUMBER:
      schema = z.coerce.number()
      if (spec.validation?.min !== undefined) {
        schema = (schema as z.ZodNumber).min(
          spec.validation.min,
          spec.validation.message ?? `${spec.label} below minimum`,
        )
      }
      if (spec.validation?.max !== undefined) {
        schema = (schema as z.ZodNumber).max(
          spec.validation.max,
          spec.validation.message ?? `${spec.label} above maximum`,
        )
      }
      break
    case FieldType.BOOLEAN:
      schema = z.boolean()
      break
    case FieldType.DATE:
      schema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Expected YYYY-MM-DD')
      break
    case FieldType.TIME:
      schema = z.string().regex(/^\d{2}:\d{2}(:\d{2})?$/, 'Expected HH:MM')
      break
    case FieldType.ENUM:
      if (spec.options && spec.options.length > 0) {
        schema = z.enum(spec.options as [string, ...string[]])
      } else {
        schema = z.string()
      }
      break
    case FieldType.ENUM_ARRAY:
      if (spec.options && spec.options.length > 0) {
        schema = z.array(z.enum(spec.options as [string, ...string[]]))
      } else {
        schema = z.array(z.string())
      }
      break
    case FieldType.FILE:
      schema = z.string().uuid().or(z.string().url())
      break
    default:
      schema = z.unknown()
  }

  if (!spec.required) {
    return schema.optional().nullable()
  }

  return schema
}

/** Build a Zod object schema for the given catalog fields (defaults to full VILO_FIELD_CATALOG). */
export function buildViloZodSchema(fields: FieldSpec[] = VILO_FIELD_CATALOG) {
  const shape: Record<string, z.ZodTypeAny> = {}
  for (const spec of fields) {
    shape[spec.id] = fieldSpecToZod(spec)
  }
  return z.object(shape)
}

export const viloFormZodSchema = buildViloZodSchema()

export type ViloFormValues = z.infer<typeof viloFormZodSchema>

/** Default empty values aligned with catalog field ids. */
export function buildViloDefaultValues(
  fields: FieldSpec[] = VILO_FIELD_CATALOG,
): Partial<ViloFormValues> {
  const defaults: Record<string, unknown> = {}
  for (const spec of fields) {
    switch (spec.type) {
      case FieldType.NUMBER:
        defaults[spec.id] = undefined
        break
      case FieldType.BOOLEAN:
        defaults[spec.id] = false
        break
      case FieldType.ENUM_ARRAY:
        defaults[spec.id] = []
        break
      default:
        defaults[spec.id] = spec.required ? '' : null
    }
  }
  return defaults as Partial<ViloFormValues>
}
