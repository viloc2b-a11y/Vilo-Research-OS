import type { SupabaseClient } from '@supabase/supabase-js'

export type RuntimeReadinessSeverity = 'blocker' | 'warning' | 'info'

export type RuntimeReadinessContinuityRow = {
  id: string
  visitLabel: string
  procedureLabel: string
  bindingState: string
  executableState: string
  blocker: string
  nextAction: string
  severity: RuntimeReadinessSeverity
}

export type StudyRuntimeReadinessResult = {
  canExecute: boolean
  blockers: string[]
  warnings: string[]
  checkedAt: string
  packageStatus: string
  packageDetail: string
  packageConsistency: 'Pass' | 'Fail' | 'Unavailable'
  visitDefinitionCount: number | null
  requiredProcedureCount: number | null
  sourceBindingCount: number | null
  continuityRows: RuntimeReadinessContinuityRow[]
  existingNullSourceExecutionCount: number | null
}

function one<T>(value: T | T[] | null | undefined): T | null {
  if (Array.isArray(value)) return value[0] ?? null
  return value ?? null
}

function labelFrom(row: { code?: string | null; label?: string | null } | null, fallback: string) {
  return row?.label ?? row?.code ?? fallback
}

function addUnique(list: string[], value: string) {
  if (!list.includes(value)) list.push(value)
}

export async function canExecuteStudyRuntime({
  supabase,
  studyId,
  organizationId,
}: {
  supabase: SupabaseClient
  studyId: string
  organizationId: string
}): Promise<StudyRuntimeReadinessResult> {
  const blockers: string[] = []
  const warnings: string[] = []
  const checkedAt = new Date().toISOString()

  const [
    studyResult,
    packageResult,
    visitDefinitionsResult,
    procedureMapsResult,
    bindingsResult,
    legacyNullSourceResult,
  ] = await Promise.all([
    supabase
      .from('studies')
      .select('status')
      .eq('id', studyId)
      .eq('organization_id', organizationId)
      .maybeSingle(),
    supabase
      .from('source_publish_packages')
      .select('id, package_id, publish_ready, validation_status, persisted_at, created_at')
      .eq('study_id', studyId)
      .eq('organization_id', organizationId)
      .not('persisted_at', 'is', null)
      .order('persisted_at', { ascending: false })
      .order('created_at', { ascending: false })
      .limit(1),
    supabase
      .from('visit_definitions')
      .select('id, code, label, sort_order, study_version_id')
      .eq('study_id', studyId)
      .eq('organization_id', organizationId)
      .order('sort_order', { ascending: true })
      .order('created_at', { ascending: true }),
    supabase
      .from('visit_def_procedure_map')
      .select(`
        id,
        visit_definition_id,
        procedure_definition_id,
        is_required,
        is_conditional,
        condition_label,
        sort_order,
        visit_definitions(code, label, study_version_id),
        procedure_definitions(code, label, study_version_id)
      `)
      .eq('study_id', studyId)
      .eq('organization_id', organizationId)
      .order('sort_order', { ascending: true }),
    supabase
      .from('procedure_source_bindings')
      .select(`
        id,
        procedure_definition_id,
        default_source_definition_version_id,
        source_definition_versions(id, version_label, lifecycle_status, study_id, study_version_id)
      `)
      .eq('study_id', studyId)
      .eq('organization_id', organizationId),
    supabase
      .from('procedure_executions')
      .select('id', { count: 'exact', head: true })
      .eq('study_id', studyId)
      .eq('organization_id', organizationId)
      .is('source_definition_version_id', null),
  ])

  let packageStatus = 'No persisted package'
  let packageDetail = 'No published source package has been persisted for this study.'
  let packageConsistency: StudyRuntimeReadinessResult['packageConsistency'] = 'Unavailable'

  if (studyResult.error) {
    warnings.push(`Administrative study status unavailable: ${studyResult.error.message}`)
  } else {
    const administrativeStatus = String(studyResult.data?.status ?? 'unknown')
    if (!['active', 'enrolling'].includes(administrativeStatus)) {
      warnings.push(`Administrative study status is ${administrativeStatus}. This does not block the computed runtime gate, but it must be reviewed operationally.`)
    }
  }

  if (packageResult.error) {
    packageStatus = 'Invalid/unavailable'
    packageDetail = packageResult.error.message
    blockers.push(`Published package status unavailable: ${packageResult.error.message}`)
  } else {
    const latestPackage = packageResult.data?.[0] ?? null
    if (!latestPackage) {
      blockers.push('No persisted source package exists for this study.')
    } else {
      const validationStatus = String(latestPackage.validation_status ?? 'unavailable')
      packageStatus = validationStatus === 'warning'
        ? 'Validation warning'
        : validationStatus === 'invalid'
          ? 'Invalid/unavailable'
          : 'Published package exists'
      packageDetail = `Package ${String(latestPackage.package_id)} · persisted ${String(latestPackage.persisted_at)} · validation ${validationStatus}`

      const consistencyResult = await supabase.rpc('phase4c_publish_package_is_consistent', {
        p_organization_id: organizationId,
        p_package_id: latestPackage.package_id as string,
      })

      if (consistencyResult.error) {
        blockers.push(`Package consistency unavailable: ${consistencyResult.error.message}`)
      } else if (consistencyResult.data === true) {
        packageConsistency = 'Pass'
      } else {
        packageConsistency = 'Fail'
        blockers.push('Package consistency failed for the persisted source package.')
      }

      if (validationStatus === 'warning') {
        warnings.push(`Published package has validation warning: ${packageDetail}`)
      } else if (validationStatus === 'invalid') {
        blockers.push(`Published package is invalid: ${packageDetail}`)
      }
    }
  }

  if (visitDefinitionsResult.error) {
    blockers.push(`Visit definitions unavailable: ${visitDefinitionsResult.error.message}`)
  } else if ((visitDefinitionsResult.data ?? []).length === 0) {
    blockers.push('No visit definitions exist for this study.')
  }

  if (procedureMapsResult.error) {
    blockers.push(`Visit procedure map unavailable: ${procedureMapsResult.error.message}`)
  }

  if (bindingsResult.error) {
    blockers.push(`Procedure source bindings unavailable: ${bindingsResult.error.message}`)
  }

  if (legacyNullSourceResult.error) {
    warnings.push(`Legacy procedure execution source check unavailable: ${legacyNullSourceResult.error.message}`)
  } else if ((legacyNullSourceResult.count ?? 0) > 0) {
    warnings.push(`${legacyNullSourceResult.count} existing procedure execution row(s) have no source definition version. Legacy rows are not repaired by this gate.`)
  }

  const requiredMaps = (procedureMapsResult.data ?? []).filter((row) => {
    if (!row.is_required || row.is_conditional) return false
    const visit = one(row.visit_definitions) as { eligible_subject_roles?: string[] | null } | null
    const roles = visit?.eligible_subject_roles
    if (!roles?.length) return true
    return roles.includes('participant')
  })
  const conditionalMaps = (procedureMapsResult.data ?? []).filter((row) => row.is_conditional)
  if (!procedureMapsResult.error && requiredMaps.length === 0 && conditionalMaps.length === 0) {
    blockers.push('No required visit-to-procedure mappings exist for this study.')
  }

  const bindingByProcedure = new Map(
    (bindingsResult.data ?? []).map((binding) => [
      binding.procedure_definition_id as string,
      binding,
    ]),
  )

  const requiredContinuityRows: RuntimeReadinessContinuityRow[] = requiredMaps.map((row) => {
    const visit = one(row.visit_definitions) as {
      code?: string | null
      label?: string | null
      study_version_id?: string | null
    } | null
    const procedure = one(row.procedure_definitions) as {
      code?: string | null
      label?: string | null
      study_version_id?: string | null
    } | null
    const visitLabel = labelFrom(visit, 'Visit definition missing')
    const procedureLabel = labelFrom(procedure, 'Procedure definition missing')
    const binding = bindingByProcedure.get(row.procedure_definition_id as string)
    const sdv = one(binding?.source_definition_versions) as {
      id?: string | null
      lifecycle_status?: string | null
      study_id?: string | null
      study_version_id?: string | null
      version_label?: string | null
    } | null

    if (!binding) {
      addUnique(blockers, `Required procedure is missing a source binding: ${visitLabel} · ${procedureLabel}.`)
      addUnique(blockers, `Schedule generation would create a required procedure execution without source: ${visitLabel} · ${procedureLabel}.`)
      return {
        id: row.id as string,
        visitLabel,
        procedureLabel,
        bindingState: 'Missing',
        executableState: 'No',
        blocker: 'Required procedure has no published source binding.',
        nextAction: 'Bind published source in Procedure Source Bindings.',
        severity: 'blocker',
      }
    }

    if (!sdv) {
      addUnique(blockers, `Required procedure binding target is unavailable: ${visitLabel} · ${procedureLabel}.`)
      addUnique(blockers, `Schedule generation would create a required procedure execution without source: ${visitLabel} · ${procedureLabel}.`)
      return {
        id: row.id as string,
        visitLabel,
        procedureLabel,
        bindingState: 'Binding target unavailable',
        executableState: 'No',
        blocker: 'Binding does not resolve to a source definition version.',
        nextAction: 'Retarget to a published same-study source in Procedure Source Bindings.',
        severity: 'blocker',
      }
    }

    if (sdv.lifecycle_status !== 'published') {
      addUnique(blockers, `Required procedure binding is not published: ${visitLabel} · ${procedureLabel}.`)
      return {
        id: row.id as string,
        visitLabel,
        procedureLabel,
        bindingState: `Bound to ${sdv.version_label ?? 'source version'} (${sdv.lifecycle_status ?? 'unknown'})`,
        executableState: 'No',
        blocker: 'Bound source version is not published.',
        nextAction: 'Retarget to a published source in Procedure Source Bindings.',
        severity: 'blocker',
      }
    }

    if (sdv.study_id !== studyId) {
      addUnique(blockers, `Required procedure binding points to a different study: ${visitLabel} · ${procedureLabel}.`)
      return {
        id: row.id as string,
        visitLabel,
        procedureLabel,
        bindingState: `Bound to ${sdv.version_label ?? 'published source version'}`,
        executableState: 'No',
        blocker: 'Published source is not from the same study.',
        nextAction: 'Retarget to a published same-study source in Procedure Source Bindings.',
        severity: 'blocker',
      }
    }

    if (
      procedure?.study_version_id &&
      sdv.study_version_id &&
      procedure.study_version_id !== sdv.study_version_id
    ) {
      addUnique(warnings, `Study-version mismatch is visible for ${visitLabel} · ${procedureLabel}.`)
    }

    return {
      id: row.id as string,
      visitLabel,
      procedureLabel,
      bindingState: `Bound to ${sdv.version_label ?? 'published source version'}`,
      executableState: 'Yes',
      blocker: 'None detected by computed runtime checks.',
      nextAction: 'No action from this row.',
      severity: 'info',
    }
  })

  const conditionalContinuityRows: RuntimeReadinessContinuityRow[] = conditionalMaps.map((row) => {
      const visit = one(row.visit_definitions) as {
        code?: string | null
        label?: string | null
      } | null
      const procedure = one(row.procedure_definitions) as {
        code?: string | null
        label?: string | null
      } | null
      const visitLabel = labelFrom(visit, 'Visit definition missing')
      const procedureLabel = labelFrom(procedure, 'Procedure definition missing')
      const label = (row.condition_label as string | null)?.trim()
      return {
        id: row.id as string,
        visitLabel,
        procedureLabel,
        bindingState: 'Conditional (not auto-created)',
        executableState: 'Available if condition met',
        blocker: label ? `Condition: ${label}` : 'Coordinator must instantiate when condition is met.',
        nextAction: 'Use Instantiate conditional procedure when condition is met.',
        severity: 'info',
      }
  })

  const continuityRows: RuntimeReadinessContinuityRow[] = [
    ...requiredContinuityRows,
    ...conditionalContinuityRows,
  ]

  return {
    canExecute: blockers.length === 0,
    blockers,
    warnings,
    checkedAt,
    packageStatus,
    packageDetail,
    packageConsistency,
    visitDefinitionCount: visitDefinitionsResult.error ? null : (visitDefinitionsResult.data ?? []).length,
    requiredProcedureCount: procedureMapsResult.error ? null : requiredMaps.length,
    sourceBindingCount: bindingsResult.error ? null : (bindingsResult.data ?? []).length,
    continuityRows,
    existingNullSourceExecutionCount: legacyNullSourceResult.error ? null : legacyNullSourceResult.count ?? 0,
  }
}

export function formatStudyRuntimeBlockers(result: StudyRuntimeReadinessResult): string {
  return result.blockers.length > 0
    ? result.blockers.join(' ')
    : 'Study runtime is executable by current computed checks.'
}
