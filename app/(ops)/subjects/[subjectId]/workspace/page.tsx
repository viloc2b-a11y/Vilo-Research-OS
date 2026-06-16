import Link from 'next/link'
import { Activity, Calendar, FileText, PenTool, UserRound, Workflow } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  loadSubjectWorkspaceModel,
  type WorkspaceItem,
} from '@/lib/ops/workspace-read-model'
import { SubjectOperationsPanel } from '@/components/coordinator-operations/SubjectOperationsPanel'
import { SubjectWorkspaceActions } from '@/components/coordinator-operations/SubjectWorkspaceActions'
import { CoordinatorPageScroll } from '@/components/runtime-ui/CoordinatorPageScroll'
import { OperationalNextActionStrip } from '@/components/coordinator-operations/OperationalNextActionStrip'
import { SubjectRuntimeSummaryPanel } from '@/components/runtime-ui/SubjectRuntimeSummaryPanel'
import { loadSubjectOperationsSurface } from '@/lib/coordinator-operations'
import { loadSubjectRuntimeUiModel } from '@/lib/runtime-ui/load'
import { createServerClient } from '@/lib/supabase/server'
import { subjectChartPath, subjectVisitsPath, visitDetailPath } from '@/lib/ops/paths'
import { loadSafetyEvents } from '@/lib/safety-runtime/load-safety-events'
import { SubjectSafetyPanel } from '@/components/subject/SubjectSafetyPanel'
import { SubjectRegulatoryPanel } from '@/components/subject/SubjectRegulatoryPanel'
import type { SubjectReconsentReq } from '@/components/subject/SubjectRegulatoryPanel'
import { loadCapaActions } from '@/lib/capa-runtime/load-capa-actions'
import type { CapaActionRow } from '@/lib/capa-runtime/capa-types'
import { SubjectCapaPanel } from '@/components/subject/SubjectCapaPanel'
import { SubjectConsentPanel } from '@/components/subject/SubjectConsentPanel'
import { loadSubjectConsents, loadSubjectReconsentRequirements } from '@/lib/consent-runtime/load-subject-consents'
import type { SubjectConsentVersionRow, SubjectReconsentRequirementRow } from '@/lib/consent-runtime/consent-types'
import { computeSubjectFinancialRuntime } from '@/lib/financial-runtime/compute-subject'
import type { SubjectFinancialRuntime } from '@/lib/financial-runtime/types'
import { SubjectFinancialPanel } from '@/components/subject/SubjectFinancialPanel'
import { loadDeviations } from '@/lib/protocol-deviations/load-deviations'
import type { ProtocolDeviationRow } from '@/lib/protocol-deviations/deviation-types'
import { SubjectDeviationsPanel } from '@/components/subject/SubjectDeviationsPanel'
import { loadSubjectAmendmentImpacts } from '@/lib/subject/amendment-impacts/load-subject-amendment-impacts'
import type { SubjectAmendmentImpactRow } from '@/lib/subject/amendment-impacts/load-subject-amendment-impacts'
import { SubjectAmendmentImpactPanel } from '@/components/subject/SubjectAmendmentImpactPanel'
import { getSessionUser, getOrganizationMemberships } from '@/lib/auth/session'
import { activeMemberships } from '@/lib/auth/membership-access'
import { isUserPiRole } from '@/lib/rbac/permissions'
import { SubjectPiRevenueAwareness } from '@/components/subject/SubjectPiRevenueAwareness'

type SubjectWorkspacePageProps = {
  params: Promise<{ subjectId: string }>
}

function ListCard({
  title,
  icon: Icon,
  items,
  empty,
  actionHref,
  actionLabel,
}: {
  title: string
  icon: React.ElementType
  items: WorkspaceItem[]
  empty: string
  actionHref: string
  actionLabel: string
}) {
  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <Icon className="size-4 text-primary" />
          {title}
          <Badge variant="secondary">{items.length}</Badge>
          <Link href={actionHref} className="ml-auto text-xs font-medium text-primary hover:underline">
            {actionLabel}
          </Link>
        </CardTitle>
      </CardHeader>
      <CardContent>
        {items.length === 0 ? (
          <p className="text-sm text-muted-foreground">{empty}</p>
        ) : (
          <ul className="space-y-2">
            {items.map((item) => (
              <li key={item.id}>
                <Link href={item.href} className="block rounded-md border px-3 py-2 text-sm hover:bg-muted">
                  <span className="font-medium">{item.title}</span>
                  <span className="mt-1 block text-xs text-muted-foreground">{item.detail}</span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  )
}

export default async function SubjectWorkspacePage({ params }: SubjectWorkspacePageProps) {
  const { subjectId } = await params
  const model = await loadSubjectWorkspaceModel(subjectId)
  const supabase = await createServerClient()
  const [subjectRuntimeUi, subjectOps, safetyEvents, reconsentReqs, subjectCapas, subjectConsents, subjectFinancial, subjectDeviations, subjectAmendmentImpacts] = await Promise.all([
    loadSubjectRuntimeUiModel(supabase, subjectId, model.subject.organizationId),
    loadSubjectOperationsSurface(subjectId),
    loadSafetyEvents(supabase, {
      organizationId: model.subject.organizationId,
      subjectId,
    }).catch(() => []),
    loadSubjectReconsentRequirements({
      supabase,
      organizationId: model.subject.organizationId,
      studySubjectId: subjectId,
    }).catch(() => [] as SubjectReconsentRequirementRow[]),
    loadCapaActions(supabase, {
      organizationId: model.subject.organizationId,
      studyId: model.subject.studyId,
    }).catch(() => [] as CapaActionRow[]),
    loadSubjectConsents({
      supabase,
      organizationId: model.subject.organizationId,
      studySubjectId: model.subject.id,
    }).catch(() => [] as SubjectConsentVersionRow[]),
    computeSubjectFinancialRuntime({
      supabase,
      organizationId: model.subject.organizationId,
      studyId: model.subject.studyId,
      studySubjectId: model.subject.id,
    }).catch(() => null as SubjectFinancialRuntime | null),
    loadDeviations(supabase, {
      organizationId: model.subject.organizationId,
      subjectId: model.subject.id,
    }).catch(() => [] as ProtocolDeviationRow[]),
    loadSubjectAmendmentImpacts(supabase, {
      subjectId: model.subject.id,
    }).catch(() => [] as SubjectAmendmentImpactRow[]),
  ])

  const sessionUser = await getSessionUser()
  const memberships = sessionUser
    ? activeMemberships(await getOrganizationMemberships(sessionUser.id))
    : []
  const isPi = isUserPiRole(memberships, model.subject.organizationId)

  let unsignedProcs: Array<Record<string, unknown>> = []
  if (isPi) {
    const { data: piProcs } = await supabase
      .from('procedure_executions')
      .select('id, procedure_definitions(label, code), visits(id, visit_definitions(label, code))')
      .eq('study_subject_id', subjectId)
      .eq('is_signed', false)
      .in('execution_status', ['completed', 'verified'])
    unsignedProcs = (piProcs ?? []) as Array<Record<string, unknown>>
  }

  function one<T>(value: T | T[] | null | undefined): T | null {
    if (Array.isArray(value)) return value[0] ?? null
    return value ?? null
  }

  const piUnsignedItems = unsignedProcs.map((pe) => {
    const procDef = one(pe.procedure_definitions)
    const visit = one(pe.visits)
    const visitDef = visit ? one((visit as { visit_definitions?: unknown }).visit_definitions) : null
    return {
      id: pe.id as string,
      procedureLabel: (procDef as { label?: string } | null)?.label ?? (procDef as { code?: string } | null)?.code ?? 'Procedure',
      visitLabel: (visitDef as { label?: string } | null)?.label ?? 'Visit',
      signHref: visit ? visitDetailPath((visit as { id: string }).id) : '#',
    }
  })

  // Map typed consent rows for SubjectRegulatoryPanel (expects SubjectReconsentReq shape)
  const reconsentRequirements: SubjectReconsentReq[] = reconsentReqs.map((r) => ({
    id: r.id,
    reconsentRequired: r.reconsentRequired,
    reconsentStatus: r.reconsentStatus,
    reconsentDueDate: r.reconsentDueDate,
    amendmentId: null,
  }))
  const stats: Array<{ label: string; value: number; Icon: LucideIcon }> = [
    { label: 'Visits', value: model.visits.length, Icon: Calendar },
    { label: 'Procedures', value: model.procedures.length, Icon: Activity },
    { label: 'Source sets', value: model.sourceStatus.length, Icon: FileText },
    { label: 'Open tasks', value: model.openTasksBlockers.length, Icon: Workflow },
    { label: 'Pending signatures', value: model.signaturesPending.length, Icon: PenTool },
  ]

  const openSourceHref = subjectOps.openSourceItems[0]?.href ?? null
  const currentVisitHref = subjectOps.currentVisit?.href ?? null

  return (
    <CoordinatorPageScroll contentClassName="p-6">
    <div className="w-full min-w-0 max-w-none space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-foreground">
            Subject {model.subject.subjectIdentifier}
          </h1>
          <p className="text-sm text-muted-foreground">
            {model.subject.studyName} · {model.subject.enrollmentStatus ?? 'status unavailable'}
          </p>
        </div>
        <Link
          href={subjectChartPath(model.subject.studyId, model.subject.id)}
          className="text-sm font-medium text-primary hover:underline"
        >
          Open subject chart
        </Link>
      </div>

      {subjectRuntimeUi?.nextAction ? (
        <OperationalNextActionStrip nextAction={subjectRuntimeUi.nextAction} />
      ) : null}

      {subjectRuntimeUi ? (
        <SubjectRuntimeSummaryPanel model={subjectRuntimeUi} studyId={model.subject.studyId} />
      ) : null}

      <SubjectWorkspaceActions
        studyId={model.subject.studyId}
        subjectId={model.subject.id}
        organizationId={model.subject.organizationId}
        enrollmentStatus={model.subject.enrollmentStatus}
        openSourceHref={openSourceHref}
        currentVisitHref={currentVisitHref}
      />

      <SubjectOperationsPanel surface={subjectOps} />

      {model.unavailable.length > 0 ? (
        <Card className="border-amber-200 bg-amber-50">
          <CardContent className="pt-6 text-sm text-amber-900">
            {model.unavailable.join(' · ')}
          </CardContent>
        </Card>
      ) : null}

      <div className="grid gap-3 md:grid-cols-5">
        {stats.map(({ label, value, Icon }) => (
          <Card key={label}>
            <CardContent className="flex items-center gap-3 pt-6">
              <Icon className="size-5 text-primary" />
              <div>
                <p className="text-2xl font-semibold">{value}</p>
                <p className="text-xs text-muted-foreground">{label}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        <ListCard title="Subject Timeline" icon={Activity} items={model.timeline} empty="No timeline items found." actionHref={subjectChartPath(model.subject.studyId, model.subject.id)} actionLabel="Open chart" />
        <ListCard title="Visits" icon={Calendar} items={model.visits} empty="No visits found." actionHref={subjectVisitsPath(model.subject.studyId, model.subject.id)} actionLabel="Open visits" />
        <ListCard title="Procedures" icon={Activity} items={model.procedures} empty="No procedures found." actionHref={subjectVisitsPath(model.subject.studyId, model.subject.id)} actionLabel="Open visits" />
        <ListCard title="Source Status" icon={FileText} items={model.sourceStatus} empty="No source sets found." actionHref={subjectChartPath(model.subject.studyId, model.subject.id)} actionLabel="Open chart" />
        <ListCard title="Clinical Links" icon={UserRound} items={model.clinicalLinks} empty="No clinical links available." actionHref={`${subjectChartPath(model.subject.studyId, model.subject.id)}?tab=clinical-profile`} actionLabel="Open profile" />
        <ListCard title="Open Tasks / Blockers" icon={Workflow} items={model.openTasksBlockers} empty="No open tasks or blockers." actionHref={`${subjectChartPath(model.subject.studyId, model.subject.id)}?tab=workflow`} actionLabel="Open workflow" />
        <ListCard title="Signatures Pending" icon={PenTool} items={model.signaturesPending} empty="No pending signatures." actionHref={subjectVisitsPath(model.subject.studyId, model.subject.id)} actionLabel="Open visits" />
        <SubjectSafetyPanel
          events={safetyEvents}
          studyId={model.subject.studyId}
          subjectId={model.subject.id}
        />
        <SubjectRegulatoryPanel
          studyId={model.subject.studyId}
          subjectId={model.subject.id}
          reconsentRequirements={reconsentRequirements}
        />
        <SubjectCapaPanel
          capas={subjectCapas}
          studyId={model.subject.studyId}
          subjectId={model.subject.id}
        />
        <SubjectConsentPanel
          consents={subjectConsents}
          reconsentRequirements={reconsentReqs}
          studyId={model.subject.studyId}
          subjectId={model.subject.id}
        />
        {isPi && (
          <SubjectPiRevenueAwareness
            unsignedItems={piUnsignedItems}
            hasAmendmentBudgetImpact={subjectAmendmentImpacts.length > 0}
          />
        )}
        <SubjectFinancialPanel financial={subjectFinancial} />
        <SubjectDeviationsPanel deviations={subjectDeviations} />
        <SubjectAmendmentImpactPanel
          impacts={subjectAmendmentImpacts}
          studyId={model.subject.studyId}
        />
      </div>
    </div>
    </CoordinatorPageScroll>
  )
}
