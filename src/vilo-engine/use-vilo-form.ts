'use client'

/**
 * React Hook Form + Zod resolver wired to DYNAMIC_TRIGGERS (on change) and BUSINESS_RULES (on submit).
 */

import { zodResolver } from '@hookform/resolvers/zod'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useForm, type DefaultValues, type UseFormProps, type UseFormReturn } from 'react-hook-form'
import {
  QuerySeverity,
  SignatureState,
  type BusinessRuleResult,
  type TriggerRule,
} from '@/lib/source-engine/canonical'
import {
  applyTriggerRules,
  evaluateBusinessRules,
  evaluateFieldSpecConditional,
} from '@/lib/source-engine/engine.canonical'
import { getViloCatalogField } from '@/lib/source-engine/vilo-field-catalog'
import {
  BUSINESS_RULES,
  DYNAMIC_TRIGGERS,
} from '@/lib/source-engine/vilo-dynamic-rules'
import { VILO_FIELD_CATALOG } from '@/lib/source-engine/vilo-field-catalog'
import {
  buildViloDefaultValues,
  buildViloZodSchema,
  type ViloFormValues,
} from '@/src/vilo-engine/zod-schemas'

export type ViloTriggerState = {
  visibleFields: Set<string>
  hiddenFields: Set<string>
  disabledFields: Set<string>
  calculated: Record<string, unknown>
}

export type UseViloSourceFormOptions = {
  defaultValues?: DefaultValues<ViloFormValues>
  triggers?: TriggerRule[]
  businessRules?: typeof BUSINESS_RULES
  /** Peer rows for cross-record rules (e.g. IP_KIT_DUPLICATE). */
  allContexts?: Record<string, unknown>[]
  isEditMode?: boolean
  onBusinessRules?: (results: BusinessRuleResult[], ctx: Record<string, unknown>) => void
  onSubmit?: (data: ViloFormValues, ctx: Record<string, unknown>) => void | Promise<void>
} & Omit<UseFormProps<ViloFormValues>, 'resolver' | 'defaultValues'>

export type UseViloSourceFormReturn = {
  form: UseFormReturn<ViloFormValues>
  triggerState: ViloTriggerState
  businessFindings: BusinessRuleResult[]
  visibleFieldIds: string[]
  runBusinessRules: (ctx?: Record<string, unknown>) => BusinessRuleResult[]
  handleViloSubmit: ReturnType<UseFormReturn<ViloFormValues>['handleSubmit']>
}

function emptyTriggerState(): ViloTriggerState {
  return {
    visibleFields: new Set(),
    hiddenFields: new Set(),
    disabledFields: new Set(),
    calculated: {},
  }
}

function mergeRuleContext(
  values: ViloFormValues,
  extras?: { is_edit_mode?: boolean; signature_state?: string },
): Record<string, unknown> {
  return {
    ...(values as Record<string, unknown>),
    ...extras,
  }
}

export function useViloSourceForm(
  options: UseViloSourceFormOptions = {},
): UseViloSourceFormReturn {
  const {
    defaultValues,
    triggers = DYNAMIC_TRIGGERS,
    businessRules = BUSINESS_RULES,
    allContexts,
    isEditMode = false,
    onBusinessRules,
    onSubmit,
    ...formProps
  } = options

  const schema = useMemo(() => buildViloZodSchema(), [])
  const form = useForm<ViloFormValues>({
    resolver: zodResolver(schema),
    defaultValues: defaultValues ?? buildViloDefaultValues(),
    mode: 'onChange',
    ...formProps,
  })

  const { watch, setValue, getValues, handleSubmit } = form
  const [triggerState, setTriggerState] = useState<ViloTriggerState>(emptyTriggerState)
  const [businessFindings, setBusinessFindings] = useState<BusinessRuleResult[]>([])
  const allContextsRef = useRef(allContexts)
  allContextsRef.current = allContexts

  const applyTriggers = useCallback(
    (values: Record<string, unknown>) => {
      const next = applyTriggerRules(triggers, values)
      setTriggerState(next)
      for (const [fieldId, value] of Object.entries(next.calculated)) {
        const key = fieldId as keyof ViloFormValues
        const current = getValues(key)
        if (current !== value) {
          setValue(key, value as ViloFormValues[keyof ViloFormValues], {
            shouldValidate: false,
            shouldDirty: true,
          })
        }
      }
    },
    [triggers, getValues, setValue],
  )

  useEffect(() => {
    const subscription = watch((values) => {
      applyTriggers(mergeRuleContext(values as ViloFormValues, { is_edit_mode: isEditMode }))
    })
    applyTriggers(
      mergeRuleContext(getValues(), {
        is_edit_mode: isEditMode,
        signature_state: SignatureState.UNSIGNED,
      }),
    )
    return () => subscription.unsubscribe()
  }, [watch, applyTriggers, getValues, isEditMode])

  const runBusinessRules = useCallback(
    (ctx?: Record<string, unknown>) => {
      const base =
        ctx ??
        mergeRuleContext(getValues(), {
          is_edit_mode: isEditMode,
          signature_state:
            ((getValues() as Record<string, unknown>).signature_state as string | undefined) ??
            SignatureState.UNSIGNED,
        })
      const results = evaluateBusinessRules(businessRules, base, {
        allContexts: allContextsRef.current,
      })
      const fired = results.filter((r) => r.fired)
      setBusinessFindings(fired)
      onBusinessRules?.(fired, base)
      return results
    },
    [businessRules, getValues, isEditMode, onBusinessRules],
  )

  const handleViloSubmit = handleSubmit(async (data) => {
    const ctx = mergeRuleContext(data, {
      is_edit_mode: isEditMode,
      signature_state:
        (data as Record<string, unknown>).signature_state as string | undefined ??
        SignatureState.UNSIGNED,
    })
    const results = runBusinessRules(ctx)
    const blocking = results.some(
      (r) =>
        r.fired &&
        (r.severity === QuerySeverity.CRITICAL || r.severity === QuerySeverity.ERROR),
    )
    if (blocking) return
    await onSubmit?.(data, ctx)
  })

  const catalogIds = useMemo(() => VILO_FIELD_CATALOG.map((f) => f.id), [])

  const visibleFieldIds = useMemo(() => {
    const ctx = mergeRuleContext(getValues(), { is_edit_mode: isEditMode })
    return catalogIds.filter((id) => {
      if (triggerState.hiddenFields.has(id)) return false
      const spec = getViloCatalogField(id)
      if (spec && !evaluateFieldSpecConditional(spec, ctx)) return false
      return true
    })
  }, [catalogIds, triggerState, getValues, isEditMode])

  return {
    form,
    triggerState,
    businessFindings,
    visibleFieldIds,
    runBusinessRules,
    handleViloSubmit,
  }
}
