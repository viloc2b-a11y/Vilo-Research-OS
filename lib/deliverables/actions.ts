'use server'

import { createClient } from '@supabase/supabase-js'
import { logDeliverableAuditEvent } from './audit'
import { createDeliverableRun } from './create-deliverable-run'
import { generatePrintableSourcePacket } from './generate-printable-source-packet'
import { generateConsentEvidencePackage } from './generate-consent-evidence-package'
import { generateCRAMonitoringWorkbook } from './generate-cra-monitoring-workbook'
import { DeliverableAudience, DeliverableScope, SubjectScope, VisitScope, ProcedureScope } from './types'
import {
  evaluateStudyDataReadiness,
  type StudyDataReadinessCategory,
  type StudyDataReadinessResult,
} from '@/lib/site-intelligence/study-data-readiness-adapter'
import { computeStudyFinancialSummary } from '@/lib/financial-runtime/compute-study'

import { createServerClient } from '@/lib/supabase/server'

function mapStudyDataReadinessToWorkbook(readiness: StudyDataReadinessResult) {
  const categoryLabels: Record<StudyDataReadinessCategory, string> = {
    consent: 'Consent readiness',
    signature: 'Signature readiness',
    source: 'Source completion',
    visit: 'Visit readiness',
    version: 'Version / Source Package',
    document_lineage: 'Document lineage',
    scope: 'Scope readiness',
  }

  const checks = (Object.entries(readiness.findings) as Array<[StudyDataReadinessCategory, StudyDataReadinessResult['findings'][StudyDataReadinessCategory]]>).map(([key, items]) => {
    const blockers = items.filter((item) => item.severity === 'blocker').length
    const warnings = items.filter((item) => item.severity === 'warning').length
    const status: 'blocker' | 'warning' | 'pass' = blockers > 0 ? 'blocker' : warnings > 0 ? 'warning' : 'pass'
    return {
      id: key,
      label: categoryLabels[key],
      status,
      detail:
        status === 'blocker'
          ? 'Blocking items need review.'
          : status === 'warning'
            ? 'Warnings are present and should be reviewed.'
            : 'No findings.',
    }
  })

  const blockers = Object.values(readiness.findings)
    .flat()
    .filter((item) => item.severity === 'blocker')
    .map((item) => item.issue)

  const warnings = Object.values(readiness.findings)
    .flat()
    .filter((item) => item.severity === 'warning')
    .map((item) => item.issue)

  return {
    status:
      readiness.status === 'blocked'
        ? ('BLOCKED' as const)
        : readiness.status === 'ready_with_warnings'
          ? ('WARNING' as const)
          : ('PASS' as const),
    badgeLabel:
      readiness.status === 'blocked'
        ? ('BLOCKED' as const)
        : readiness.status === 'ready_with_warnings'
          ? ('READY WITH WARNINGS' as const)
          : ('READY' as const),
    checkedAt: readiness.checkedAt,
    studyId: readiness.studyId,
    studyName: readiness.studyName,
    protocolNumber: readiness.protocolNumber,
    siteName: readiness.siteName,
    checks,
    blockers,
    warnings,
  }
}

export async function generateDeliverableAction(params: {
  systemCode: string
  organizationId: string
  userId: string
  audience: DeliverableAudience
  scope: DeliverableScope
  filters: SubjectScope | VisitScope | ProcedureScope | { studyId: string }
}) {
  try {
    const supabase = await createServerClient()

    if (params.systemCode === 'cra_monitoring_workbook') {
      const studyId = (params.filters as { studyId: string }).studyId
      const studyReadiness = await evaluateStudyDataReadiness({
        supabase,
        studyId,
        organizationId: params.organizationId,
        mode: 'cra_workbook_precheck',
      })
      const readiness = mapStudyDataReadinessToWorkbook(studyReadiness)
      if (readiness.status === 'BLOCKED') {
        return {
          success: false as const,
          error: `CRA Workbook readiness is blocked: ${readiness.blockers.join('; ')}`,
          readiness,
        }
      }
    }

    // 1. Create run
    const { runId } = await createDeliverableRun({ ...params, supabase })

    // 2. Generate artifact
    if (params.systemCode === 'printable_source_packet') {
      const result = await generatePrintableSourcePacket(supabase, runId)
      return result
    } else if (params.systemCode === 'consent_evidence_package') {
      const result = await generateConsentEvidencePackage(supabase, runId)
      return result
    } else if (params.systemCode === 'cra_monitoring_workbook') {
      const result = await generateCRAMonitoringWorkbook(supabase, runId)
      return result
    } else if (params.systemCode === 'source_evidence_workbook') {
      return { success: false, error: 'Source Evidence Workbook is not yet available.' }
    } else if (params.systemCode === 'financial_reconciliation_workbook') {
      const studyId = (params.filters as { studyId: string }).studyId
      const { data: study } = await supabase
        .from('studies')
        .select('organization_id')
        .eq('id', studyId)
        .maybeSingle()
      if (!study) {
        return { success: false, error: 'Study not found.' }
      }
      const organizationId = String(study.organization_id)
      const summary = await computeStudyFinancialSummary({ supabase, organizationId, studyId })
      return {
        success: true as const,
        data: {
          summary,
          generatedAt: new Date().toISOString(),
        },
      }
    } else {
      return { success: false, error: `Generation for ${params.systemCode} is not implemented yet.` }
    }
  } catch (error: unknown) {
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error' }
  }
}

export async function getCRAMonitoringWorkbookReadinessAction(params: {
  studyId: string
}) {
  try {
    const supabase = await createServerClient()
    const { data: study } = await supabase
      .from('studies')
      .select('organization_id')
      .eq('id', params.studyId)
      .maybeSingle()

    if (!study) {
      return { success: false as const, error: 'Study not found.' }
    }

    const studyReadiness = await evaluateStudyDataReadiness({
      supabase,
      studyId: params.studyId,
      organizationId: String(study.organization_id),
      mode: 'cra_workbook_precheck',
    })
    const readiness = mapStudyDataReadinessToWorkbook(studyReadiness)
    return { success: true as const, readiness }
  } catch (error: unknown) {
    return { success: false as const, error: error instanceof Error ? error.message : 'Unknown error' }
  }
}

export async function getDeliverableDownloadUrl(storagePath: string) {
  try {
    let supabase
    const FALLBACK_ZERO_UUID = '00000000-0000-0000-0000-000000000000'
    try {
      supabase = await createServerClient()
    } catch (serverClientError) {
      const fallbackUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.SUPABASE_URL
      const fallbackKey = process.env.SUPABASE_SERVICE_ROLE_KEY
      if (!fallbackUrl || !fallbackKey) {
        throw serverClientError
      }
      supabase = createClient(fallbackUrl, fallbackKey)
    }

    const { data: authData } = await supabase.auth.getUser()

    const { data: output, error: outputError } = await supabase
      .from('deliverable_run_outputs')
      .select('id, run_id, format')
      .eq('storage_path', storagePath)
      .maybeSingle()

    if (outputError || !output) {
      throw new Error(`Failed to resolve deliverable output: ${outputError?.message ?? 'Output not found'}`)
    }

    const { data: run, error: runError } = await supabase
      .from('deliverable_runs')
      .select('id, run_by, organization_id')
      .eq('id', output.run_id)
      .maybeSingle()

    if (runError || !run) {
      throw new Error(`Failed to resolve deliverable run: ${runError?.message ?? 'Run not found'}`)
    }

    let actorId = authData.user?.id ?? (run.run_by && run.run_by !== FALLBACK_ZERO_UUID ? run.run_by : null)
    if (!actorId) {
      const { data: orgMember } = await supabase
        .from('organization_members')
        .select('user_id')
        .eq('organization_id', run.organization_id)
        .limit(1)
        .maybeSingle()
      actorId = orgMember?.user_id ?? null
    }

    if (!actorId) {
      const { data: authUsers } = await supabase
        .schema('auth')
        .from('users')
        .select('id')
        .limit(1)
      actorId = authUsers?.[0]?.id ?? null
    }

    if (!actorId) {
      throw new Error('Unable to resolve download actor.')
    }

    const downloadedAt = new Date().toISOString()
    const { error: downloadUpdateError } = await supabase
      .from('deliverable_run_outputs')
      .update({
        downloaded_by: actorId,
        downloaded_at: downloadedAt,
      })
      .eq('id', output.id)

    if (downloadUpdateError) {
      throw new Error(`Failed to persist download metadata: ${downloadUpdateError.message}`)
    }

    await logDeliverableAuditEvent({
      supabase,
      runId: output.run_id,
      action: 'artifact_downloaded',
      actorId,
      metadata: {
        outputId: output.id,
        storagePath,
        format: output.format,
        downloadedAt,
      },
    })

    const { data, error } = await supabase.storage.from('operational-documents').createSignedUrl(storagePath, 60 * 5)
    if (error || !data) {
      throw new Error(`Failed to generate signed url: ${error?.message}`)
    }

    return { success: true, signedUrl: data.signedUrl }
  } catch (error: unknown) {
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error' }
  }
}
