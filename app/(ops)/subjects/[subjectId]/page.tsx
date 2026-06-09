import { notFound, redirect } from 'next/navigation'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { SubjectOperationalCommandCenter } from '@/components/subjects/operations/SubjectOperationalCommandCenter'
import { SubjectReturnToVisitBanner } from '@/components/subjects/subject-return-to-visit-banner'
import { SubjectChartHeader } from '@/components/subjects/subject-chart-header'
import { SubjectChartNav } from '@/components/subjects/subject-chart-nav'
import { subjectChartTabs } from '@/lib/subject/chart-tabs'
import { SubjectConMedsSurface } from '@/components/subject/clinical-profile/SubjectConMedsSurface'
import { MedicalHistorySection } from '@/components/subject/clinical-profile/MedicalHistorySection'
import { AllergiesSection } from '@/components/subject/clinical-profile/AllergiesSection'
import { SurgicalHistorySection } from '@/components/subject/clinical-profile/SurgicalHistorySection'
import { SubjectAdverseEventsSurface } from '@/components/subject/adverse-events/SubjectAdverseEventsSurface'
import { SubjectConsentRuntimePanel } from '@/components/subject/consent/SubjectConsentRuntimePanel'
import { ClinicalRiskPanel } from '@/components/subject/clinical-intelligence/ClinicalRiskPanel'
import {
  SubjectDocumentsSection,
  SubjectEmergencyContactsSection,
  SubjectProgressNotesSection,
  SubjectProtocolDeviationsSection,
  SubjectSignaturesSection,
  SubjectStatusHistorySection,
} from '@/components/subject/source-template/SubjectSourceTemplateSections'
import {
  SubjectGeneralForm,
  type SubjectGeneralModel,
} from '@/components/subject/subject-general-form'
import { SubjectCloseoutChecklist } from '@/components/subject/SubjectCloseoutChecklist'
import { SubjectCloseoutForms } from '@/components/subject/subject-closeout-forms'
import { loadSubjectCloseoutReadiness } from '@/lib/subject/closeout'
import { subjectVisitsPath } from '@/lib/subject/chart-paths'
import { subjectChartPath } from '@/lib/ops/paths'
import { resolveSubjectChartPermissions } from '@/lib/subject/permissions'
import { loadSubjectClinicalProfileSafe } from '@/lib/subject/clinical-profile/load-safe'
import { CoordinatorSafeErrorPanel } from '@/components/runtime-ui/CoordinatorSafeErrorPanel'
import { coordinatorMessageFromError } from '@/lib/runtime-errors/coordinator-facing'
import { buildLongitudinalProfile } from '@/lib/subject/clinical-intelligence'
import type { SubjectClinicalProfile } from '@/lib/subject/clinical-profile/types'
import type { LongitudinalClinicalProfile } from '@/lib/subject/clinical-intelligence/types'
import type { SubjectChartHeaderModel } from '@/lib/subject/visits/types'
import { loadSubjectOperationalIntelligence } from '@/lib/subject/operations'
import { loadSubjectAdverseEventsTimeline } from '@/lib/subject/adverse-events'
import { loadSubjectConsentRuntime } from '@/lib/subject/consent'
import { loadSubjectLongitudinalLabs } from '@/lib/subject/lab-timeline/load-subject-longitudinal-labs'
import { loadSubjectWorkflowActions } from '@/lib/subject/workflow/data'
import { loadSubjectSourceTemplate } from '@/lib/subject/source-template/read'
import type { SubjectSourceTemplateModel } from '@/lib/subject/source-template/types'
import { hasActiveOrganizationMembership } from '@/lib/auth/membership-access'
import { getOrganizationMemberships, getSessionUser } from '@/lib/auth/session'
import { redactSubjectUnblindedFields } from '@/lib/rbac/blinding'
import { canViewUnblindedData, canMutateOrganizationData } from '@/lib/rbac/permissions'
import { SubjectRuntimeSummaryPanel } from '@/components/runtime-ui/SubjectRuntimeSummaryPanel'
import { loadSubjectRuntimeUiModel } from '@/lib/runtime-ui/load'
import { createServerClient } from '@/lib/supabase/server'
import { StudyDataReadinessCard } from '@/components/studies/study-data-readiness-card'
import { OperationalAuditPanel } from '@/components/operations/OperationalAuditPanel'
import { loadOperationalChronology } from '@/lib/operations/loadOperationalChronology'
import { SubjectDeliverablesSection } from '@/components/subject/deliverables/SubjectDeliverablesSection'
import { loadSubjectDeliverables } from '@/lib/subject/deliverables/load-subject-deliverables'
import { loadLatestStudyDataReadinessReview } from '@/lib/site-intelligence/study-data-readiness-actions'

type SubjectDetailPageProps = {
  params: Promise<{ subjectId: string; studyId?: string }>
  searchParams: Promise<{ tab?: string; returnTo?: string }>
}

// Tabs that are rendered inline (not visits/clinical-profile which redirect/forward)
const PLACEHOLDER_LABELS = new Map<string, string>(
  subjectChartTabs
    .filter(
      (tab) =>
        ![
          'general',
          'visits',
          'consent',
          'workflow',
          'clinical-profile',
          'conmeds',
          'medical-history',
          'allergies',
          'surgical-history',
          'adverse-events',
          'subject-status',
          'progress-notes',
          'documents',
          'signatures',
          'protocol-deviations',
          'emergency-contacts',
          'deliverables',
        ].includes(tab.key),
    )
    .map((tab) => [tab.key, tab.label]),
)

function one<T>(value: T | T[] | null | undefined): T | null {
  if (Array.isArray(value)) return value[0] ?? null
  return value ?? null
}

function normalizeTab(tab: string | undefined) {
  const aliases: Record<string, string> = {
    ae: 'adverse-events',
    'clinical-profile': 'medical-history',
    deviations: 'protocol-deviations',
  }
  const normalized = tab ? aliases[tab] ?? tab : tab
  return subjectChartTabs.some((item) => item.key === normalized) ? normalized! : 'general'
}

function ComingSoon({ title }: { title: string }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">{title}</CardTitle>
        <CardDescription>
          Coming soon. This chart section is reserved for coordinator documentation and will stay
          separate from sponsor monitoring workflows.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <p className="text-sm text-muted-foreground">
          No data entry is wired for this section yet.
        </p>
      </CardContent>
    </Card>
  )
}

function GeneralPanel({
  subject,
  showUnblindedFields,
  anchorOptions,
  isReadOnly,
}: {
  subject: SubjectGeneralModel
  showUnblindedFields: boolean
  anchorOptions: { id: string; label: string }[]
  isReadOnly: boolean
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">General</CardTitle>
        <CardDescription>
          Site-maintained subject profile fields. Basic validation only.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <SubjectGeneralForm
          subject={subject}
          showUnblindedFields={showUnblindedFields}
          anchorOptions={anchorOptions}
          isReadOnly={isReadOnly}
        />
      </CardContent>
    </Card>
  )
}

export default async function SubjectDetailPage({
  params,
  searchParams,
}: SubjectDetailPageProps) {
  const { subjectId, studyId: routeStudyId } = await params
  const { tab, returnTo: returnToRaw } = await searchParams
  const activeTab = normalizeTab(tab)
  const returnToVisit =
    typeof returnToRaw === 'string' && returnToRaw.startsWith('/visits/')
      ? returnToRaw
      : null
  const supabase = await createServerClient()

  // Core subject fetch — RLS enforces org membership
  const { data: subject, error: subErr } = await supabase
    .from('study_subjects')
    .select(
      `
      id,
      organization_id,
      subject_identifier,
      randomization_number,
      randomization_arm,
      enrollment_status,
      subject_role,
      household_id,
      anchor_subject_id,
      first_name,
      middle_initial,
      last_name,
      initials,
      gender,
      date_of_birth,
      randomization_date_time,
      external_iwrs_rtsm_reference,
      updated_at,
      study_id,
      studies(id, name, slug)
    `,
    )
    .eq('id', subjectId)
    .match(routeStudyId ? { study_id: routeStudyId } : {})
    .maybeSingle()

  if (subErr || !subject) {
    notFound()
  }

  const nestedStudy = one(subject.studies)
  const study = nestedStudy as { id: string; name: string; slug: string | null } | null
  const chartStudyId = routeStudyId ?? study?.id ?? null
  const organizationId = subject.organization_id as string

  const user = await getSessionUser()
  if (!user) notFound()

  const memberships = await getOrganizationMemberships(user.id)
  const canAccessOrganization = hasActiveOrganizationMembership(memberships, organizationId)
  if (!canAccessOrganization) notFound()

  const canViewUnblinded = canViewUnblindedData(memberships, organizationId)
  const canMutate = canMutateOrganizationData(memberships, organizationId)

  if (activeTab === 'visits' && chartStudyId) {
    redirect(subjectVisitsPath(chartStudyId, subjectId))
  }

  // Load workflow + permissions in parallel. Clinical profile is only loaded
  // when the tab is active to avoid unnecessary DB work.
  const [workflowResult, permissions] = await Promise.all([
    loadSubjectWorkflowActions(subjectId, organizationId),
    resolveSubjectChartPermissions(supabase, {
      organizationId,
      studyId: chartStudyId,
    }),
  ])

  const { canVerify, actorRole } = permissions

  // Operational intelligence (used by SubjectChartHeader)
  const operationalResult =
    chartStudyId && workflowResult.ok
      ? await loadSubjectOperationalIntelligence({
          subjectId,
          studyId: chartStudyId,
          organizationId,
          workflowActions: workflowResult.actions,
        })
      : { ok: false as const, error: 'No study context.' }
  const operationalIntelligence = operationalResult.ok ? operationalResult.data : null

  const closeoutReadinessResult =
    activeTab === 'general' && chartStudyId && workflowResult.ok
      ? await loadSubjectCloseoutReadiness({
          subjectId,
          studyId: chartStudyId,
          organizationId,
        })
      : null
  const closeoutReadiness =
    closeoutReadinessResult?.ok === true ? closeoutReadinessResult.data : null

  const subjectRuntimeUi =
    chartStudyId
      ? await loadSubjectRuntimeUiModel(supabase, subjectId, organizationId)
      : null

  // Clinical profile — load only when the tab is active
  let clinicalProfile: SubjectClinicalProfile = {
    study_subject_id: subjectId,
    medical_history: [],
    conmeds: [],
    allergies: [],
    surgical_history: [],
    lifestyle: null,
  }
  let clinicalProfileLoadError: string | null = null
  let longitudinal: LongitudinalClinicalProfile | null = null
  const clinicalProfileTabs = new Set([
    'medical-history',
    'conmeds',
    'allergies',
    'surgical-history',
  ])
  if (clinicalProfileTabs.has(activeTab)) {
    const clinicalLoad = await loadSubjectClinicalProfileSafe(subjectId)
    clinicalProfile = clinicalLoad.profile
    if (!clinicalLoad.ok) {
      clinicalProfileLoadError = clinicalLoad.coordinatorMessage
    } else if (activeTab === 'medical-history') {
      longitudinal = buildLongitudinalProfile(clinicalProfile)
    }
  }

  const adverseEventsTimeline =
    activeTab === 'adverse-events' && chartStudyId
      ? await loadSubjectAdverseEventsTimeline({
          subjectId,
          studyId: chartStudyId,
          organizationId,
          memberships,
        })
      : null

  const labRuntime =
    activeTab === 'documents' && chartStudyId
      ? await loadSubjectLongitudinalLabs({
          studySubjectId: subjectId,
          organizationId,
          studyId: chartStudyId,
        })
      : null

  const deliverablesResult = 
    activeTab === 'deliverables' && chartStudyId
      ? await loadSubjectDeliverables(supabase, subjectId, organizationId)
      : null
  const studyDataReadiness =
    activeTab === 'general' && chartStudyId
      ? await loadLatestStudyDataReadinessReview({
          studyId: chartStudyId,
          organizationId,
          mode: 'internal_review',
        })
      : { readiness: null, createdAt: null }

  const consentRuntime =
    activeTab === 'consent' && chartStudyId
      ? await loadSubjectConsentRuntime(subjectId)
      : null

  const sourceTemplateTabs = new Set([
    'subject-status',
    'progress-notes',
    'documents',
    'signatures',
    'protocol-deviations',
    'emergency-contacts',
  ])
  const sourceTemplate: SubjectSourceTemplateModel | null = sourceTemplateTabs.has(activeTab)
    ? await loadSubjectSourceTemplate({ subjectId, organizationId })
    : null

  const anchorSubjectOptions =
    chartStudyId
      ? (
          await supabase
            .from('study_subjects')
            .select('id, subject_identifier')
            .eq('study_id', chartStudyId)
            .eq('organization_id', organizationId)
            .neq('id', subjectId)
            .order('subject_identifier', { ascending: true })
        ).data?.map((row) => ({
          id: row.id as string,
          label: row.subject_identifier as string,
        })) ?? []
      : []

  const generalSubject: SubjectGeneralModel = redactSubjectUnblindedFields(
    {
      id: subject.id as string,
      organizationId,
      subjectNumber: subject.subject_identifier as string,
      randomizationNumber: (subject.randomization_number as string | null) ?? null,
      studyArm: (subject.randomization_arm as string | null) ?? null,
      randomizationDateTime: (subject.randomization_date_time as string | null) ?? null,
      externalIwrsRtsmReference: (subject.external_iwrs_rtsm_reference as string | null) ?? null,
      status: subject.enrollment_status as string,
      subjectRole:
        (subject.subject_role as SubjectGeneralModel['subjectRole'] | null) ?? 'participant',
      householdId: (subject.household_id as string | null) ?? null,
      anchorSubjectId: (subject.anchor_subject_id as string | null) ?? null,
      firstName: (subject.first_name as string | null) ?? null,
      middleInitial: (subject.middle_initial as string | null) ?? null,
      lastName: (subject.last_name as string | null) ?? null,
      initials: (subject.initials as string | null) ?? null,
      gender: (subject.gender as string | null) ?? null,
      dateOfBirth: (subject.date_of_birth as string | null) ?? null,
      updatedAt: subject.updated_at as string,
    },
    canViewUnblinded,
  )

  const chartHeader: SubjectChartHeaderModel | null = chartStudyId
    ? redactSubjectUnblindedFields(
        {
          subjectId,
          studyId: chartStudyId,
          organizationId,
          subjectIdentifier: generalSubject.subjectNumber,
          initials: generalSubject.initials,
          studyName: study?.name ?? 'Study',
          subjectRole:
            (subject.subject_role as SubjectChartHeaderModel['subjectRole'] | null) ?? 'participant',
          householdId: (subject.household_id as string | null) ?? null,
          anchorSubjectId: (subject.anchor_subject_id as string | null) ?? null,
          enrollmentStatus: generalSubject.status,
          randomizationNumber: (subject.randomization_number as string | null) ?? null,
          randomizationArm: (subject.randomization_arm as string | null) ?? null,
        },
        canViewUnblinded,
      )
    : null

  return (
    <div className="flex flex-col h-full bg-accent">

      {/* ===== Subject Header (sticky) ===== */}
      {chartHeader ? (
        <SubjectChartHeader
          header={chartHeader}
          operationalHealth={operationalIntelligence?.health ?? null}
          showUnblindedFields={canViewUnblinded}
        />
      ) : (
        /* Fallback header when no study context */
        <div className="bg-card border-b px-6 py-4" >
          <div className="flex items-center gap-3">
            <div
              className="w-10 h-10 rounded-xl bg-primary flex items-center justify-center text-sm font-bold text-primary-foreground flex-shrink-0"
              
            >
              {generalSubject.subjectNumber?.slice(0, 2).toUpperCase() ?? '—'}
            </div>
            <div>
              <h1 className="text-base font-semibold" >
                Subject {generalSubject.subjectNumber}
              </h1>
              <p className="text-xs" >
                {generalSubject.status}
                {canViewUnblinded && generalSubject.studyArm ? ` · Arm ${generalSubject.studyArm}` : ''}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* ===== Horizontal Tab Nav ===== */}
      <SubjectChartNav studyId={chartStudyId} subjectId={subjectId} activeTab={activeTab} />

      {/* ===== Tab Content ===== */}
      <div className="vilo-ops-scroll min-h-0 min-w-0 flex-1 overflow-x-auto overflow-y-auto bg-accent scrollbar-thin">
        <div className="p-6 max-w-[1100px] space-y-5">

          {returnToVisit ? (
            <SubjectReturnToVisitBanner returnTo={returnToVisit} />
          ) : null}

          {/* Read-Only Banner */}
          {!canMutate ? (
            <div className="bg-amber-500/15 border border-amber-500/30 text-amber-700 px-4 py-3 rounded-md flex items-start gap-3">
              <svg className="w-5 h-5 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
              <div>
                <h3 className="text-sm font-semibold">Read-only review mode</h3>
                <p className="text-sm mt-1">You are viewing this chart in read-only mode. Mutations and operational workflows are disabled for your role.</p>
              </div>
            </div>
          ) : null}

          {/* Error banners */}
          {!operationalResult.ok && activeTab === 'general' && chartStudyId ? (
            <CoordinatorSafeErrorPanel
              title="Operational summary unavailable"
              detail={coordinatorMessageFromError(new Error(operationalResult.error), {
                context: 'subject-operational',
              })}
              retryHref={`${subjectChartPath(chartStudyId, subjectId)}?tab=general`}
              backHref={subjectChartPath(chartStudyId, subjectId)}
            />
          ) : null}

          {/* General */}
          {activeTab === 'general' && subjectRuntimeUi && chartStudyId ? (
            <SubjectRuntimeSummaryPanel model={subjectRuntimeUi} studyId={chartStudyId} />
          ) : null}
          {activeTab === 'general' && operationalIntelligence && chartStudyId && canMutate ? (
            <SubjectOperationalCommandCenter
              intelligence={operationalIntelligence}
              studyId={chartStudyId}
              subjectId={subjectId}
            />
          ) : null}
          {activeTab === 'general' ? (
            <GeneralPanel
              subject={generalSubject}
              showUnblindedFields={canViewUnblinded}
              anchorOptions={anchorSubjectOptions}
              isReadOnly={!canMutate}
            />
          ) : null}
          {activeTab === 'general' && closeoutReadiness ? (
            <SubjectCloseoutChecklist readiness={closeoutReadiness} />
          ) : null}
          {activeTab === 'general' && canMutate ? (
            <SubjectCloseoutForms
              subjectId={subjectId}
              organizationId={organizationId}
              currentStatus={generalSubject.status}
              subjectUpdatedAt={subject.updated_at as string}
              readiness={closeoutReadiness}
            />
          ) : null}
          {activeTab === 'general' && chartStudyId ? (
            <StudyDataReadinessCard
              studyId={chartStudyId}
              organizationId={organizationId}
              initialReadiness={studyDataReadiness.readiness}
              initialCreatedAt={studyDataReadiness.createdAt}
            />
          ) : null}

          {/* Visits — redirect handled above */}
          {activeTab === 'visits' ? <ComingSoon title="Visits" /> : null}

          {activeTab === 'consent' && consentRuntime ? (
            <SubjectConsentRuntimePanel model={consentRuntime} canMutate={canMutate} />
          ) : null}
          {activeTab === 'consent' && !chartStudyId ? (
            <p className="text-sm text-muted-foreground">
              Study context is required to load the Consent Runtime.
            </p>
          ) : null}

          {/* Clinical Profile */}
          {clinicalProfileLoadError &&
          clinicalProfileTabs.has(activeTab) ? (
            <CoordinatorSafeErrorPanel
              title="Clinical profile unavailable"
              detail={clinicalProfileLoadError}
              retryHref={`${subjectChartPath(chartStudyId, subjectId)}?tab=${activeTab}`}
              backHref={subjectChartPath(chartStudyId, subjectId)}
            />
          ) : null}

          {activeTab === 'medical-history' && !clinicalProfileLoadError ? (
            <div className="space-y-4">
              <div>
                <h2 className="text-lg font-semibold" >Medical Conditions / Medical History</h2>
                <p className="text-sm" >
                  Longitudinal medical history with controlled diagnosis/pathology terms.
                </p>
              </div>
              {longitudinal ? (
                <ClinicalRiskPanel longitudinal={longitudinal} />
              ) : null}
              <div className="rounded-lg border bg-card p-4">
                <MedicalHistorySection
                  studySubjectId={subjectId}
                  rows={clinicalProfile.medical_history}
                  canVerify={canVerify}
                  actorRole={actorRole}
                />
              </div>
            </div>
          ) : null}

          {activeTab === 'allergies' && !clinicalProfileLoadError ? (
            <div className="rounded-lg border bg-card p-4">
              <AllergiesSection
                studySubjectId={subjectId}
                rows={clinicalProfile.allergies}
                canVerify={canVerify}
                actorRole={actorRole}
              />
            </div>
          ) : null}

          {activeTab === 'surgical-history' && !clinicalProfileLoadError ? (
            <div className="rounded-lg border bg-card p-4">
              <SurgicalHistorySection
                studySubjectId={subjectId}
                rows={clinicalProfile.surgical_history}
                canVerify={canVerify}
                actorRole={actorRole}
              />
            </div>
          ) : null}

          {activeTab === 'conmeds' && !clinicalProfileLoadError ? (
            <SubjectConMedsSurface
              profile={clinicalProfile}
              studySubjectId={subjectId}
              studyId={chartStudyId}
              canVerify={canVerify}
              actorRole={actorRole}
              variant="dedicated"
            />
          ) : null}

          {activeTab === 'adverse-events' && !chartStudyId ? (
            <p className="text-sm text-muted-foreground">
              Study context is required to load the AE / safety timeline for this subject.
            </p>
          ) : null}
          {activeTab === 'adverse-events' && adverseEventsTimeline ? (
            <SubjectAdverseEventsSurface
              model={adverseEventsTimeline}
              studySubjectId={subjectId}
            />
          ) : null}

          {activeTab === 'progress-notes' && sourceTemplate ? (
            <SubjectProgressNotesSection studySubjectId={subjectId} model={sourceTemplate} />
          ) : null}

          {activeTab === 'subject-status' && sourceTemplate ? (
            <SubjectStatusHistorySection studySubjectId={subjectId} model={sourceTemplate} />
          ) : null}

          {activeTab === 'documents' && sourceTemplate ? (
            <SubjectDocumentsSection studySubjectId={subjectId} model={sourceTemplate} />
          ) : null}

          {activeTab === 'signatures' && sourceTemplate ? (
            <SubjectSignaturesSection studySubjectId={subjectId} model={sourceTemplate} />
          ) : null}

          {activeTab === 'protocol-deviations' && sourceTemplate ? (
            <SubjectProtocolDeviationsSection studySubjectId={subjectId} model={sourceTemplate} />
          ) : null}

          {activeTab === 'emergency-contacts' && sourceTemplate ? (
            <SubjectEmergencyContactsSection studySubjectId={subjectId} model={sourceTemplate} />
          ) : null}

          {/* Deliverables Tab */}
          {activeTab === 'deliverables' && chartStudyId ? (
            <div className="space-y-4">
              <div>
                <h2 className="text-lg font-semibold text-foreground">Deliverables</h2>
                <p className="text-sm text-muted-foreground">
                  Generate regulatory deliverables and print-ready source packets.
                </p>
              </div>
              {deliverablesResult?.ok ? (
                <SubjectDeliverablesSection 
                  model={deliverablesResult.model} 
                  subjectId={subjectId}
                  studyId={chartStudyId}
                  organizationId={organizationId}
                  userId={user.id}
                />
              ) : (
                <CoordinatorSafeErrorPanel
                  title="Deliverables unavailable"
                  detail={deliverablesResult?.error ?? 'Unknown error'}
                  retryHref={`${subjectChartPath(chartStudyId, subjectId)}?tab=deliverables`}
                  backHref={subjectChartPath(chartStudyId, subjectId)}
                />
              )}
            </div>
          ) : null}

          {/* Placeholder tabs */}
          {PLACEHOLDER_LABELS.has(activeTab) ? (
            <ComingSoon title={PLACEHOLDER_LABELS.get(activeTab)!} />
          ) : null}

          {/* Audit Trail Tab */}
          {activeTab === 'audit' && chartStudyId ? (
            <div className="space-y-4">
              <div>
                <h2 className="text-lg font-semibold text-foreground">Audit Trail</h2>
                <p className="text-sm text-muted-foreground">
                  Read-only operational event history.
                </p>
              </div>
              <OperationalAuditPanel
                events={await loadOperationalChronology({
                  organizationId,
                  subjectId: subjectId,
                  limit: 100, // Reasonable limit for chart display
                })}
              />
            </div>
          ) : null}
        </div>
      </div>
    </div>
  )
}
