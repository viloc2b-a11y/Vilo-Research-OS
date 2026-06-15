import type { SupabaseClient } from '@supabase/supabase-js'
import { createServerClient } from '@/lib/supabase/server'
import type {
  CoordinatorCommandCenterAlert,
  CoordinatorCommandCenterItem,
  CoordinatorCommandCenterModel,
  CoordinatorCommandCenterStudy,
} from './coordinator-command-center-types'

type QueryError = { message: string } | null
type QueryResult<T> = { data: T[] | null; error: QueryError }

async function safeRows<T>(
  label: string,
  unavailable: string[],
  run: () => Promise<QueryResult<T>>,
): Promise<T[]> {
  try {
    const { data, error } = await run()
    if (error) {
      unavailable.push(`${label}: ${error.message}`)
      return []
    }
    return data ?? []
  } catch (error) {
    unavailable.push(`${label}: ${error instanceof Error ? error.message : 'unavailable'}`)
    return []
  }
}

function studyNameFor(studies: Map<string, string>, studyId: string) {
  return studies.get(studyId) ?? 'Unknown study'
}

function compactVersion(provenance: Record<string, unknown>) {
  const label = provenance.source_version_label ? String(provenance.source_version_label) : null
  const number =
    provenance.source_version_number != null ? `v${String(provenance.source_version_number)}` : null
  return label ?? number ?? 'No active version label'
}

export async function loadCoordinatorCommandCenter(args: {
  organizationId: string
  selectedStudyId?: string | null
  limit?: number
  supabaseClient?: SupabaseClient
}): Promise<CoordinatorCommandCenterModel> {
  const supabase = args.supabaseClient ?? (await createServerClient())
  const unavailable: string[] = []
  const limit = args.limit ?? 12

  const studyRows = await safeRows<Record<string, unknown>>('Studies', unavailable, async () =>
    supabase
      .from('studies')
      .select('id, name')
      .eq('organization_id', args.organizationId)
      .order('name', { ascending: true }),
  )

  const studies: CoordinatorCommandCenterStudy[] = studyRows.map((row) => ({
    id: String(row.id),
    name: String(row.name),
  }))
  const studyNames = new Map(studies.map((study) => [study.id, study.name]))
  const validSelectedStudyId =
    args.selectedStudyId && studyNames.has(args.selectedStudyId) ? args.selectedStudyId : null

  const applyScope = <T extends { eq: (column: string, value: string) => T }>(query: T): T => {
    const orgScoped = query.eq('organization_id', args.organizationId)
    return validSelectedStudyId ? orgScoped.eq('study_id', validSelectedStudyId) : orgScoped
  }

  const pendingEvidenceRows = await safeRows<Record<string, unknown>>(
    'Pending evidence reviews',
    unavailable,
    async () =>
      applyScope(
        supabase
          .from('source_blueprint_evidence')
          .select('id, study_id, evidence_kind, usage_domain, evidence_status, provenance, created_at')
          .in('evidence_status', ['pending_review', 'superseded_candidate'])
          .order('created_at', { ascending: false })
          .limit(limit),
      ),
  )

  const pendingDraftRows = await safeRows<Record<string, unknown>>(
    'Pending draft suggestions',
    unavailable,
    async () =>
      applyScope(
        supabase
          .from('source_blueprint_draft_suggestions')
          .select('id, study_id, evidence_id, suggestion_type, suggestion_status, created_at')
          .eq('suggestion_status', 'draft')
          .order('created_at', { ascending: false })
          .limit(limit),
      ),
  )

  const pendingSignatureRows = await safeRows<Record<string, unknown>>(
    'Pending signatures',
    unavailable,
    async () =>
      applyScope(
        supabase
          .from('operational_signature_requests')
          .select('id, study_id, artifact_type, signature_meaning, required_role, status, created_at:requested_at')
          .eq('status', 'pending')
          .order('requested_at', { ascending: false })
          .limit(limit),
      ),
  )

  const approvedPackageRows = await safeRows<Record<string, unknown>>(
    'Unpublished approved runtime packages',
    unavailable,
    async () =>
      applyScope(
        supabase
          .from('runtime_source_packages')
          .select('id, study_id, package_name, package_version, package_status, approved_at, created_at')
          .eq('package_status', 'approved')
          .order('approved_at', { ascending: false, nullsFirst: false })
          .limit(limit),
      ),
  )

  const publicationRows = await safeRows<Record<string, unknown>>(
    'Published runtime source',
    unavailable,
    async () =>
      applyScope(
        supabase
          .from('runtime_source_package_publications')
          .select('source_package_id, publication_status')
          .eq('publication_status', 'published')
          .limit(500),
      ),
  )
  const publishedPackageIds = new Set(publicationRows.map((row) => String(row.source_package_id)))

  const queryRows = await safeRows<Record<string, unknown>>(
    'Operational review queries',
    unavailable,
    async () =>
      applyScope(
        supabase
          .from('visit_snapshot_queries')
          .select('id, study_id, query_scope, priority, query_status, opened_at, created_at')
          .in('query_status', ['open', 'answered'])
          .order('opened_at', { ascending: false })
          .limit(limit),
      ),
  )

  const activeReferenceEventRows = await safeRows<Record<string, unknown>>(
    'Active reference version changes',
    unavailable,
    async () =>
      applyScope(
        supabase
          .from('document_intelligence_active_reference_events')
          .select('id, study_id, domain, previous_intelligence_document_id, new_intelligence_document_id, event_timestamp')
          .order('event_timestamp', { ascending: false })
          .limit(limit),
      ),
  )

  const pendingEvidenceReviews: CoordinatorCommandCenterItem[] = pendingEvidenceRows.map((row) => {
    const studyId = String(row.study_id)
    const provenance = (row.provenance as Record<string, unknown>) ?? {}
    return {
      id: String(row.id),
      studyId,
      studyName: studyNameFor(studyNames, studyId),
      status: String(row.evidence_status),
      title: String(row.evidence_kind),
      detail: `${String(row.usage_domain)} · active reference ${compactVersion(provenance)}`,
      createdAt: String(row.created_at),
      primaryActionHref: `/source-blueprint-evidence?study_id=${studyId}`,
      secondaryActionHref: `/source-blueprint-evidence?study_id=${studyId}`,
      primaryActionLabel: 'Review Evidence',
      secondaryActionLabel: 'Open Lineage',
    }
  })

  const pendingDraftSuggestions: CoordinatorCommandCenterItem[] = pendingDraftRows.map((row) => {
    const studyId = String(row.study_id)
    return {
      id: String(row.id),
      studyId,
      studyName: studyNameFor(studyNames, studyId),
      status: String(row.suggestion_status),
      title: String(row.suggestion_type),
      detail: `linked evidence ${String(row.evidence_id).slice(0, 8)}`,
      createdAt: String(row.created_at),
      primaryActionHref: `/source-blueprint-drafting?study_id=${studyId}`,
      secondaryActionHref: `/source-blueprint-evidence?study_id=${studyId}`,
      primaryActionLabel: 'Review Suggestion',
      secondaryActionLabel: 'Open Evidence',
    }
  })

  const pendingSignatures: CoordinatorCommandCenterItem[] = pendingSignatureRows.map((row) => {
    const studyId = String(row.study_id)
    return {
      id: String(row.id),
      studyId,
      studyName: studyNameFor(studyNames, studyId),
      status: String(row.status),
      title: String(row.artifact_type),
      detail: `${String(row.signature_meaning)} · ${String(row.required_role)}`,
      createdAt: String(row.created_at),
      primaryActionHref: `/operational-signatures?study_id=${studyId}`,
      secondaryActionHref: `/operational-signatures?study_id=${studyId}`,
      primaryActionLabel: 'Review Before Signing',
      secondaryActionLabel: 'Open Signature Workflow',
    }
  })

  const runtimeAlerts: CoordinatorCommandCenterAlert[] = [
    ...approvedPackageRows
      .filter((row) => !publishedPackageIds.has(String(row.id)))
      .map((row) => {
        const studyId = String(row.study_id)
        return {
          id: `approved-package-${String(row.id)}`,
          studyId,
          studyName: studyNameFor(studyNames, studyId),
          alertType: 'runtime' as const,
          label: 'Runtime Alert',
          title: 'Unpublished approved runtime package',
          detail: `${String(row.package_name)} · version ${String(row.package_version)}`,
          createdAt: String(row.approved_at ?? row.created_at),
          href: `/runtime-source-publication?study_id=${studyId}`,
        }
      }),
    ...queryRows.map((row) => {
      const studyId = String(row.study_id)
      return {
        id: `query-${String(row.id)}`,
        studyId,
        studyName: studyNameFor(studyNames, studyId),
        alertType: 'runtime' as const,
        label: 'Runtime Alert',
        title: 'Unresolved operational review query',
        detail: `${String(row.query_scope)} · ${String(row.priority)} · ${String(row.query_status)}`,
        createdAt: String(row.opened_at ?? row.created_at),
        href: `/operational-review?study_id=${studyId}`,
      }
    }),
    ...pendingSignatureRows.map((row) => {
      const studyId = String(row.study_id)
      return {
        id: `signature-blocked-${String(row.id)}`,
        studyId,
        studyName: studyNameFor(studyNames, studyId),
        alertType: 'runtime' as const,
        label: 'Runtime Alert',
        title: 'Signature-blocked runtime action',
        detail: `${String(row.artifact_type)} requires ${String(row.required_role)}`,
        createdAt: String(row.created_at),
        href: `/operational-signatures?study_id=${studyId}`,
      }
    }),
  ].slice(0, limit)

  const versionDriftAlerts: CoordinatorCommandCenterAlert[] = [
    ...activeReferenceEventRows
      .filter((row) => row.previous_intelligence_document_id)
      .map((row) => {
        const studyId = String(row.study_id)
        return {
          id: `active-reference-${String(row.id)}`,
          studyId,
          studyName: studyNameFor(studyNames, studyId),
          alertType: 'version' as const,
          label: 'Version Change',
          title: 'New active reference version',
          detail: `${String(row.domain)} · affected study ${studyNameFor(studyNames, studyId)}`,
          createdAt: String(row.event_timestamp),
          href: `/document-intelligence?study_id=${studyId}`,
        }
      }),
    ...pendingEvidenceRows
      .filter((row) => String(row.evidence_status) === 'superseded_candidate')
      .map((row) => {
        const studyId = String(row.study_id)
        return {
          id: `superseded-evidence-${String(row.id)}`,
          studyId,
          studyName: studyNameFor(studyNames, studyId),
          alertType: 'version' as const,
          label: 'Version Change',
          title: 'Evidence marked superseded_candidate',
          detail: `${String(row.evidence_kind)} · affected study ${studyNameFor(studyNames, studyId)}`,
          createdAt: String(row.created_at),
          href: `/source-blueprint-evidence?study_id=${studyId}`,
        }
      }),
  ].slice(0, limit)

  return {
    organizationId: args.organizationId,
    studies,
    selectedStudyId: validSelectedStudyId,
    generatedAt: new Date().toISOString(),
    pendingEvidenceReviews,
    pendingDraftSuggestions,
    pendingSignatures,
    runtimeAlerts,
    versionDriftAlerts,
    unavailable,
  }
}
