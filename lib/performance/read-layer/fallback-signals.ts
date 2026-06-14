import type { SubjectSignalInput, SubjectSignalKind } from '@/lib/performance/scoring/types'
import type { CoordinatorLoadItem } from '@/app/(ops)/performance/_lib/performance-types'

function one<T>(value: T | T[] | null | undefined): T | null {
  if (Array.isArray(value)) return value[0] ?? null
  return value ?? null
}

function visitSignalKind(
  visitStatus: string,
  windowStatus: string | null,
  reviewStatus: string | null,
): SubjectSignalKind | null {
  if (reviewStatus === 'reopened') return 'needs_resign'
  if (visitStatus === 'missed') return 'missed_visit'
  if (visitStatus === 'out_of_window' || windowStatus === 'outside_window') {
    return 'out_of_window'
  }
  if (windowStatus === 'warning') return 'window_warning'
  return null
}

function visitLabel(row: Record<string, unknown>) {
  const def = one(row.visit_definitions) as { label?: string; code?: string } | null
  return def?.label ?? def?.code ?? 'Visit'
}

function studyName(row: Record<string, unknown>) {
  const direct = row.study_name as string | null | undefined
  if (direct) return direct
  const study = one(row.studies) as { name?: string } | null
  return study?.name ?? 'Study'
}

function subjectIdentifier(row: Record<string, unknown>) {
  const direct = row.subject_identifier as string | null | undefined
  if (direct) return direct
  const subject = one(row.study_subjects) as { subject_identifier?: string } | null
  return subject?.subject_identifier ?? 'Subject'
}

function hoursSince(value: string | null | undefined): number {
  if (!value) return 0
  const time = new Date(value).getTime()
  if (Number.isNaN(time)) return 0
  return Math.max(0, Math.round((Date.now() - time) / (60 * 60 * 1000)))
}

function lowerText(value: unknown): string {
  if (value === null || value === undefined) return ''
  if (typeof value === 'string') return value.toLowerCase()
  if (typeof value === 'number' || typeof value === 'boolean' || typeof value === 'bigint') {
    return String(value).toLowerCase()
  }
  try {
    return JSON.stringify(value).toLowerCase()
  } catch {
    return String(value).toLowerCase()
  }
}

function hasAnyText(source: string, patterns: readonly RegExp[]): boolean {
  return patterns.some((pattern) => pattern.test(source))
}

function visitFinancialContext(row: Record<string, unknown>) {
  const snapshot = (row.snapshot as Record<string, unknown> | null | undefined) ?? {}
  const paymentLifecycle = (snapshot.paymentLifecycle as Record<string, unknown> | null | undefined) ?? {}
  const components = Array.isArray(paymentLifecycle.components) ? paymentLifecycle.components : []
  const leakageText = lowerText(row.leakage)
  const snapshotText = lowerText(snapshot)
  const paymentText = lowerText(paymentLifecycle)
  const combinedText = `${leakageText} ${snapshotText} ${paymentText}`.trim()

  const expectedComponentCount = Number(paymentLifecycle.expectedComponentCount ?? 0)
  const earnedComponentCount = Number(paymentLifecycle.earnedComponentCount ?? 0)
  const invoiceableComponentCount = Number(paymentLifecycle.invoiceableComponentCount ?? 0)
  const screenFailure = Boolean(paymentLifecycle.screenFailure)
  const visitPaymentEligible = Boolean(paymentLifecycle.visitPaymentEligible)
  const hasProcedurePayment = components.some((component) => {
    const c = component as Record<string, unknown>
    return c.componentType === 'procedure_payment'
  })
  const hasEarnedProcedure = components.some((component) => {
    const c = component as Record<string, unknown>
    return c.componentType === 'procedure_payment' && c.lifecycleStatus === 'earned'
  })
  const hasExpectedProcedure = components.some((component) => {
    const c = component as Record<string, unknown>
    return c.componentType === 'procedure_payment' && c.lifecycleStatus === 'expected'
  })

  return {
    combinedText,
    expectedComponentCount,
    earnedComponentCount,
    invoiceableComponentCount,
    screenFailure,
    visitPaymentEligible,
    hasProcedurePayment,
    hasEarnedProcedure,
    hasExpectedProcedure,
  }
}

function pushFinancialSignal(
  signals: SubjectSignalInput[],
  row: Record<string, unknown>,
  kind: SubjectSignalKind,
  detailText: string,
  computedAt: string,
) {
  const subjectId = row.study_subject_id as string | null
  if (!subjectId) return

  signals.push({
    organizationId: (row.organization_id as string) ?? '',
    studyId: row.study_id as string,
    subjectId,
    subjectIdentifier: subjectIdentifier(row),
    studyName: studyName(row),
    signalKind: kind,
    signalSource: `visit_financial_runtime_projections:${row.visit_id as string}`,
    signalEntityId: row.visit_id as string,
    signalCreatedAt: computedAt,
    signalAgeHours: hoursSince(computedAt),
    detailText,
  })
}

export function buildFallbackSubjectSignals(input: {
  riskVisits: Record<string, unknown>[]
  overdueWorkflow: Record<string, unknown>[]
  blockedProcedures: Record<string, unknown>[]
  windowClosingToday?: Record<string, unknown>[]
  unsignedVisitsOver48h?: Record<string, unknown>[]
  governanceSignals?: Record<string, unknown>[]
  snapshotQueries?: Record<string, unknown>[]
  financialLeakage?: Record<string, unknown>[]
  labSignals?: Record<string, unknown>[]
  safetySignals?: Record<string, unknown>[]
  consentSignals?: Record<string, unknown>[]
  capaSignals?: Record<string, unknown>[]
}): SubjectSignalInput[] {
  const signals: SubjectSignalInput[] = []
  const today = new Date().toISOString().slice(0, 10)

  for (const visit of input.riskVisits) {
    const kind = visitSignalKind(
      visit.visit_status as string,
      visit.window_status as string | null,
      visit.review_status as string | null,
    )
    if (!kind) continue

    const studyId = visit.study_id as string
    const subjectId = visit.study_subject_id as string
    const visitId = visit.id as string
    const sortDate =
      (visit.window_end as string | null) ??
      (visit.scheduled_date as string | null) ??
      (visit.target_date as string | null) ??
      today

    signals.push({
      organizationId: (visit.organization_id as string) ?? '',
      studyId,
      subjectId,
      subjectIdentifier: subjectIdentifier(visit),
      studyName: studyName(visit),
      signalKind: kind,
      signalSource: `visits:${visitId}`,
      signalEntityId: visitId,
      signalCreatedAt: sortDate,
      signalAgeHours: 0,
      detailText: `${visitLabel(visit)} requires coordinator attention.`,
    })
  }

  for (const row of input.overdueWorkflow) {
    const dueDate = row.due_date as string | null
    if (!dueDate || dueDate >= today) continue

    const studyId = row.study_id as string
    const subjectId = row.study_subject_id as string
    const title = row.title as string

    signals.push({
      organizationId: (row.organization_id as string) ?? '',
      studyId,
      subjectId,
      subjectIdentifier: subjectIdentifier(row),
      studyName: studyName(row),
      signalKind: 'overdue_action',
      signalSource: `subject_workflow_actions:${row.id as string}`,
      signalEntityId: row.id as string,
      signalCreatedAt: dueDate,
      signalAgeHours: 0,
      detailText: `${title} is overdue.`,
    })
  }

  for (const proc of input.blockedProcedures) {
    const studyId = proc.study_id as string
    const visit = one(proc.visits) as {
      id?: string
      study_subject_id?: string
      study_subjects?: { subject_identifier?: string } | { subject_identifier?: string }[]
    } | null
    const subjectId = visit?.study_subject_id
    if (!subjectId) continue

    const subject = one(visit.study_subjects) as { subject_identifier?: string } | null
    const pd = one(proc.procedure_definitions) as { label?: string; code?: string } | null
    const procLabel = pd?.label ?? pd?.code ?? 'Procedure'

    signals.push({
      organizationId: (proc.organization_id as string) ?? '',
      studyId,
      subjectId,
      subjectIdentifier: subject?.subject_identifier ?? 'Subject',
      studyName: studyName(proc),
      signalKind: 'blocked_procedure',
      signalSource: `procedure_executions:${proc.id as string}`,
      signalEntityId: proc.id as string,
      signalCreatedAt: '0000-01-01',
      signalAgeHours: 0,
      detailText: `${procLabel} has blocking validation.`,
    })
  }

  for (const visit of input.windowClosingToday ?? []) {
    const studyId = visit.study_id as string
    const subjectId = visit.study_subject_id as string
    const visitId = visit.id as string
    const sortDate =
      (visit.window_end as string | null) ??
      (visit.scheduled_date as string | null) ??
      today

    signals.push({
      organizationId: (visit.organization_id as string) ?? '',
      studyId,
      subjectId,
      subjectIdentifier: subjectIdentifier(visit),
      studyName: studyName(visit),
      signalKind: 'window_closing_today',
      signalSource: `visits:${visitId}`,
      signalEntityId: visitId,
      signalCreatedAt: sortDate,
      signalAgeHours: 0,
      detailText: `${visitLabel(visit)} window closes today.`,
    })
  }

  for (const visit of input.unsignedVisitsOver48h ?? []) {
    const studyId = visit.study_id as string
    const subjectId = visit.study_subject_id as string
    const visitId = visit.id as string
    const completedAt = (visit.completed_at as string | null) ?? today

    signals.push({
      organizationId: (visit.organization_id as string) ?? '',
      studyId,
      subjectId,
      subjectIdentifier: subjectIdentifier(visit),
      studyName: studyName(visit),
      signalKind: 'unsigned_procedure_48h',
      signalSource: `visits:${visitId}`,
      signalEntityId: visitId,
      signalCreatedAt: completedAt,
      signalAgeHours: hoursSince(completedAt),
      detailText: `${visitLabel(visit)} completed >48h ago and still needs source/signoff attention.`,
    })
  }

  for (const row of input.governanceSignals ?? []) {
    const subjectId = row.study_subject_id as string | null
    if (!subjectId) continue

    const severity = row.severity as string | null
    const detectedAt = (row.detected_at as string | null) ?? today
    const label = (row.label as string | null) ?? 'Governance signal'
    const detail = (row.detail as string | null) ?? 'Runtime governance signal requires review.'

    signals.push({
      organizationId: (row.organization_id as string) ?? '',
      studyId: row.study_id as string,
      subjectId,
      subjectIdentifier: subjectIdentifier(row),
      studyName: studyName(row),
      signalKind: severity === 'blocker' ? 'governance_blocker' : 'governance_warning',
      signalSource: `governance_signals:${row.id as string}`,
      signalEntityId: row.id as string,
      signalCreatedAt: detectedAt,
      signalAgeHours: hoursSince(detectedAt),
      detailText: `${label}: ${detail}`,
    })
  }

  for (const row of input.snapshotQueries ?? []) {
    const subjectId = row.subject_id as string | null
    if (!subjectId) continue

    const fieldLabel = (row.field_label as string | null) ?? (row.procedure_code as string | null)
    const queryText = (row.query_text as string | null) ?? 'Open query requires review.'
    const openedAt = (row.opened_at as string | null) ?? today
    const priority = (row.priority as string | null) ?? 'normal'

    signals.push({
      organizationId: (row.organization_id as string) ?? '',
      studyId: row.study_id as string,
      subjectId,
      subjectIdentifier: subjectIdentifier(row),
      studyName: studyName(row),
      signalKind: 'open_query',
      signalSource: `visit_snapshot_queries:${row.id as string}`,
      signalEntityId: row.id as string,
      signalCreatedAt: openedAt,
      signalAgeHours: hoursSince(openedAt),
      detailText: `${priority} query${fieldLabel ? ` on ${fieldLabel}` : ''}: ${queryText}`,
    })
  }

  for (const row of input.financialLeakage ?? []) {
    const context = visitFinancialContext(row)
    const leakageScore = Number(row.leakage_score ?? 0)
    const leakageItemCount = Number(row.leakage_item_count ?? 0)
    const earnedRate = Number(row.earned_rate_basis_points ?? 0)
    const computedAt = (row.computed_at as string | null) ?? today
    const baseDetail =
      `Revenue risk score ${leakageScore} with ${leakageItemCount} leakage item(s); earned rate ${earnedRate} bps.`

    pushFinancialSignal(
      signals,
      row,
      'revenue_leakage',
      baseDetail,
      computedAt,
    )

    if (leakageScore <= 0 && context.earnedComponentCount <= 0) continue

    if (context.earnedComponentCount > 0 && context.invoiceableComponentCount > 0) {
      pushFinancialSignal(
        signals,
        row,
        'earned_but_not_invoiced',
        `${baseDetail} Earned components exist and are not confirmed invoiced in the runtime snapshot.`,
        computedAt,
      )
    }

    if (context.hasProcedurePayment && context.hasExpectedProcedure) {
      pushFinancialSignal(
        signals,
        row,
        'invoiceable_missing',
        `${baseDetail} Invoiceable procedure items remain expected and should be reconciled against the SOA.`,
        computedAt,
      )
    }

    if (context.screenFailure && !context.visitPaymentEligible && context.hasEarnedProcedure) {
      pushFinancialSignal(
        signals,
        row,
        'screen_failure_billable',
        `${baseDetail} Screen failure keeps visit-level payment at $0 while procedure revenue remains billable.`,
        computedAt,
      )
    }

    if (hasAnyText(context.combinedText, [/pass[- ]?through/i, /reimburse/i])) {
      pushFinancialSignal(
        signals,
        row,
        'pass_through_unreimbursed',
        `${baseDetail} Pass-through reimbursement terms appear in the runtime snapshot and need protection.`,
        computedAt,
      )
    }

    if (hasAnyText(context.combinedText, [/stipend/i])) {
      pushFinancialSignal(
        signals,
        row,
        'stipend_unreconciled',
        `${baseDetail} Stipend language or payment signals are present and should be reconciled.`,
        computedAt,
      )
    }

    if (hasAnyText(context.combinedText, [/overdue/i, /past due/i, /invoice due/i, /payment due/i])) {
      pushFinancialSignal(
        signals,
        row,
        'overdue_financial',
        `${baseDetail} Invoice / payment timing appears overdue in the runtime snapshot.`,
        computedAt,
      )
    }

    if (hasAnyText(context.combinedText, [/disputed/i])) {
      pushFinancialSignal(
        signals,
        row,
        'disputed_payment',
        `${baseDetail} Disputed payment language is visible in the financial runtime snapshot.`,
        computedAt,
      )
    }

    if (hasAnyText(context.combinedText, [/reverted/i])) {
      pushFinancialSignal(
        signals,
        row,
        'reverted_payment',
        `${baseDetail} Reverted payment language is visible and should be triaged immediately.`,
        computedAt,
      )
    }

    if (hasAnyText(context.combinedText, [/written[_ -]?off/i, /write[- ]?off/i])) {
      pushFinancialSignal(
        signals,
        row,
        'written_off_payment',
        `${baseDetail} Write-off visibility is present in the runtime snapshot and requires attention.`,
        computedAt,
      )
    }
  }

  for (const row of input.labSignals ?? []) {
    const subjectId = row.study_subject_id as string | null
    const signalKind = row.signal_kind as SubjectSignalKind | null
    if (!subjectId || !signalKind) continue

    signals.push({
      organizationId: (row.organization_id as string) ?? '',
      studyId: row.study_id as string,
      subjectId,
      subjectIdentifier: subjectIdentifier(row),
      studyName: studyName(row),
      signalKind,
      signalSource: (row.signal_source as string) ?? `longitudinal_labs:${row.series_key as string}`,
      signalEntityId: (row.signal_entity_id as string) ?? (row.series_key as string) ?? null,
      signalCreatedAt: (row.signal_created_at as string) ?? today,
      signalAgeHours: Number(row.signal_age_hours ?? 0),
      detailText:
        (row.detail_text as string | null) ??
        (row.reason as string | null) ??
        'Longitudinal lab runtime signal requires review.',
    })
  }

  for (const row of input.safetySignals ?? []) {
    const subjectId = row.study_subject_id as string | null
    const signalKind = row.signal_kind as SubjectSignalKind | null
    if (!subjectId || !signalKind) continue
    signals.push({
      organizationId: (row.organization_id as string) ?? '',
      studyId: row.study_id as string,
      subjectId,
      subjectIdentifier: subjectIdentifier(row),
      studyName: studyName(row),
      signalKind,
      signalSource: (row.signal_source as string) ?? 'safety_events',
      signalEntityId: (row.signal_entity_id as string) ?? null,
      signalCreatedAt: (row.signal_created_at as string) ?? today,
      signalAgeHours: Number(row.signal_age_hours ?? 0),
      detailText: (row.detail_text as string | null) ?? 'SAE requires attention.',
    })
  }

  for (const row of input.consentSignals ?? []) {
    const subjectId = row.study_subject_id as string | null
    const signalKind = row.signal_kind as SubjectSignalKind | null
    if (!subjectId || !signalKind) continue
    signals.push({
      organizationId: (row.organization_id as string) ?? '',
      studyId: row.study_id as string,
      subjectId,
      subjectIdentifier: subjectIdentifier(row),
      studyName: studyName(row),
      signalKind,
      signalSource: (row.signal_source as string) ?? 'subject_consent_reconsent_requirements',
      signalEntityId: (row.signal_entity_id as string) ?? null,
      signalCreatedAt: (row.signal_created_at as string) ?? today,
      signalAgeHours: Number(row.signal_age_hours ?? 0),
      detailText: (row.detail_text as string | null) ?? 'Reconsent required.',
    })
  }

  for (const row of input.capaSignals ?? []) {
    const subjectId = row.study_subject_id as string | null
    if (!subjectId) continue
    signals.push({
      organizationId: (row.organization_id as string) ?? '',
      studyId: row.study_id as string,
      subjectId,
      subjectIdentifier: subjectIdentifier(row),
      studyName: studyName(row),
      signalKind: 'capa_overdue',
      signalSource: (row.signal_source as string) ?? 'capa_actions',
      signalEntityId: (row.signal_entity_id as string) ?? null,
      signalCreatedAt: (row.signal_created_at as string) ?? today,
      signalAgeHours: Number(row.signal_age_hours ?? 0),
      detailText: (row.detail_text as string | null) ?? 'CAPA action overdue.',
    })
  }

  return signals
}

export function buildFallbackCoordinatorLoad(
  rows: Record<string, unknown>[],
): CoordinatorLoadItem[] {
  const today = new Date().toISOString().slice(0, 10)
  const byUser = new Map<string, CoordinatorLoadItem>()
  let unassignedQueue = 0

  for (const row of rows) {
    const assignedUserId = row.assigned_user_id as string | null
    const createdBy = row.created_by as string | null
    const userId = assignedUserId ?? createdBy
    const dueDate = row.due_date as string | null
    const updatedAt = (row.updated_at as string | null) ?? (row.created_at as string | null) ?? null

    if (!assignedUserId) unassignedQueue += 1
    if (!userId) continue

    const item = byUser.get(userId) ?? {
      userId,
      assignedItems: 0,
      overdueItems: 0,
      blockedItems: 0,
      dueToday: 0,
      unassignedQueue: 0,
      lastActiveAt: null,
    }

    item.assignedItems += 1
    if (dueDate && dueDate < today) item.overdueItems += 1
    if (dueDate === today) item.dueToday += 1
    if (row.priority === 'urgent' || row.priority === 'high') item.blockedItems += 1
    if (updatedAt && (!item.lastActiveAt || updatedAt > item.lastActiveAt)) {
      item.lastActiveAt = updatedAt
    }

    byUser.set(userId, item)
  }

  const items = [...byUser.values()]
  for (const item of items) {
    item.unassignedQueue = unassignedQueue
  }

  if (unassignedQueue > 0 && !byUser.has('unassigned')) {
    items.push({
      userId: 'unassigned',
      assignedItems: unassignedQueue,
      overdueItems: rows.filter((row) => !row.assigned_user_id && row.due_date && (row.due_date as string) < today).length,
      blockedItems: rows.filter((row) => !row.assigned_user_id && (row.priority === 'urgent' || row.priority === 'high')).length,
      dueToday: rows.filter((row) => !row.assigned_user_id && row.due_date === today).length,
      unassignedQueue,
      lastActiveAt: null,
    })
  }

  return items.sort(
    (a, b) =>
      b.overdueItems + b.blockedItems + b.dueToday -
      (a.overdueItems + a.blockedItems + a.dueToday),
  )
}
