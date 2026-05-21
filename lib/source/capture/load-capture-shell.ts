/**
 * Phase 5.2D — Open/load response set and build capture shell view-model.
 */

import { getOrganizationMemberships, getSessionUser } from '@/lib/auth/session'
import { fetchResponseSetDetail } from '@/lib/api/source/read-client'
import { hasOrganizationMembership } from '@/lib/rbac/org-scope'
import {
  canAccessSourceCapture,
  canEditClinicalSource,
  canManageSourceDocuments,
  canViewUnblindedData,
} from '@/lib/rbac/permissions'
import { postOpenResponseSet } from '@/lib/api/source/write-client'
import { normalizeReadPanelError } from '@/lib/source/read-contract/errors'
import { loadResponseSetReviewBundle } from '@/lib/source/read-contract/load-bundle'
import { formatTimestamp } from '@/lib/source/read-contract/format'
import {
  findResponseSetIdForProcedure,
  loadFieldOptionsByFieldId,
  loadProcedureCaptureContext,
  resolveStudyVersionIdForOpen,
} from '@/lib/source/capture/context'
import {
  filterResponseSetDetailForBlinding,
  loadSourceFieldBlindingMap,
} from '@/lib/source/blinding'
import { normalizeCaptureFields } from '@/lib/source/capture/normalize-capture-fields'
import type { CaptureShellLoadResult } from '@/lib/source/capture/types'
import {
  applyEngineRuntimeToCaptureFields,
  resolveCaptureShellEngineRuntime,
  resolveSourceEngineRuntimeConfig,
} from '@/lib/source-engine/adapters/index'
import {
  logSourceEngineOperationalEvent,
  operationalContextFromCapture,
  resolutionMetaFromSnapshot,
  shouldLogPerProcedureEngineEvent,
  SOURCE_ENGINE_EVENT_TYPES,
} from '@/lib/source-engine/telemetry'
import { findNextIncompleteProcedureInVisit } from '@/lib/source/capture/next-incomplete-procedure'
import { createServerClient } from '@/lib/supabase/server'

export async function loadCaptureShell(
  procedureExecutionId: string,
  organizationIdOverride?: string,
): Promise<CaptureShellLoadResult> {
  const ctx = await loadProcedureCaptureContext(procedureExecutionId)
  if (!ctx) {
    return {
      status: 'error',
      error: {
        code: 'NOT_FOUND',
        title: 'Capture context',
        messages: [
          'Procedure execution not found or has no published source definition version bound.',
        ],
        requestId: null,
        isAuthError: false,
        isForbidden: false,
      },
    }
  }

  const organizationId = organizationIdOverride?.trim() || ctx.organizationId

  const user = await getSessionUser()
  if (!user) {
    return {
      status: 'error',
      error: {
        code: 'UNAUTHORIZED',
        title: 'Source capture',
        messages: ['Sign in required.'],
        requestId: null,
        isAuthError: true,
        isForbidden: false,
      },
    }
  }

  const memberships = await getOrganizationMemberships(user.id)
  if (!hasOrganizationMembership(memberships, organizationId)) {
    return {
      status: 'error',
      error: {
        code: 'FORBIDDEN',
        title: 'Source capture',
        messages: ['You do not have access to this organization.'],
        requestId: null,
        isAuthError: false,
        isForbidden: true,
      },
    }
  }

  if (!canAccessSourceCapture(memberships, organizationId)) {
    return {
      status: 'error',
      error: {
        code: 'FORBIDDEN',
        title: 'Source capture',
        messages: ['Your role cannot access source capture for this site.'],
        requestId: null,
        isAuthError: false,
        isForbidden: true,
      },
    }
  }

  const mayViewUnblinded = canViewUnblindedData(memberships, organizationId)
  const mayEditSource =
    canManageSourceDocuments(memberships, organizationId)
    || canEditClinicalSource(memberships, organizationId)

  let responseSetId = await findResponseSetIdForProcedure(
    procedureExecutionId,
    ctx.sourceDefinitionVersionId,
  )

  if (!responseSetId && !mayEditSource) {
    return {
      status: 'error',
      error: {
        code: 'FORBIDDEN',
        title: 'Open response set',
        messages: ['Your role can review existing source but cannot create a new response set.'],
        requestId: null,
        isAuthError: false,
        isForbidden: true,
      },
    }
  }

  if (!responseSetId) {
    const studyVersionId = await resolveStudyVersionIdForOpen(ctx.studyId, ctx.studyVersionId)
    if (!studyVersionId) {
      return {
        status: 'error',
        error: {
          code: 'NOT_FOUND',
          title: 'Open response set',
          messages: ['No study version available for capture open.'],
          requestId: null,
          isAuthError: false,
          isForbidden: false,
        },
      }
    }

    const openEnvelope = await postOpenResponseSet({
      organization_id: organizationId,
      study_id: ctx.studyId,
      study_version_id: studyVersionId,
      study_subject_id: ctx.studySubjectId,
      visit_id: ctx.visitId,
      procedure_execution_id: procedureExecutionId,
      source_definition_version_id: ctx.sourceDefinitionVersionId,
    })

    if (!openEnvelope.ok || !openEnvelope.data?.source_response_set_id) {
      return {
        status: 'error',
        error: normalizeReadPanelError(openEnvelope, 'Open response set'),
      }
    }
    responseSetId = openEnvelope.data.source_response_set_id
  }

  const [bundle, detailEnvelope] = await Promise.all([
    loadResponseSetReviewBundle(responseSetId, organizationId),
    fetchResponseSetDetail(responseSetId, organizationId),
  ])

  if (bundle.detail.status === 'error') {
    return { status: 'error', error: bundle.detail.error }
  }

  if (!detailEnvelope.ok || !detailEnvelope.data) {
    return {
      status: 'error',
      error: normalizeReadPanelError(detailEnvelope, 'Response set detail'),
    }
  }

  const visibleDetail = filterResponseSetDetailForBlinding(detailEnvelope.data, mayViewUnblinded)
  const fieldIds = visibleDetail.fields.map((f) => f.source_field_id)
  const [optionsByFieldId, blindingByFieldId] = await Promise.all([
    loadFieldOptionsByFieldId(fieldIds),
    loadSourceFieldBlindingMap(await createServerClient(), fieldIds),
  ])
  let fields = normalizeCaptureFields(visibleDetail, optionsByFieldId, blindingByFieldId)

  const rs = detailEnvelope.data.response_set
  const manifest =
    bundle.manifest.status === 'success' ? bundle.manifest.data : null
  const isSubmitted = manifest?.isSubmitted ?? rs.status === 'submitted'
  const statusAllowsEdit = !isSubmitted && rs.status !== 'locked' && rs.status !== 'archived'
  const canEdit = statusAllowsEdit && mayEditSource

  const openedRow = bundle.detail.data.metadataRows.find((r) => r.label === 'Opened')
  const submittedRow = bundle.detail.data.metadataRows.find((r) => r.label === 'Submitted')

  const operationalCtx = operationalContextFromCapture(
    { ...ctx, procedureExecutionId },
    responseSetId,
  )

  let engineSnapshot: Awaited<ReturnType<typeof resolveCaptureShellEngineRuntime>> | null = null
  try {
    const runtimeConfig = await resolveSourceEngineRuntimeConfig({
      procedureExecutionId,
      sourceDefinitionVersionId: ctx.sourceDefinitionVersionId,
      organizationId,
      studyId: ctx.studyId,
    })
    if (runtimeConfig.resolution.fallback && runtimeConfig.resolution.warning) {
      console.warn('[SourceEngine]', runtimeConfig.resolution.warning, {
        procedureExecutionId,
        sourceDefinitionVersionId: ctx.sourceDefinitionVersionId,
        templateId: runtimeConfig.resolution.templateId,
      })
      void logSourceEngineOperationalEvent({
        eventType: SOURCE_ENGINE_EVENT_TYPES.ENGINE_FALLBACK_TEMPLATE_USED,
        context: operationalCtx,
        extras: {
          templateId: runtimeConfig.resolution.templateId,
          resolutionSource: runtimeConfig.resolution.source,
          degraded: runtimeConfig.resolution.degraded,
          fallback: true,
          errorMessage: runtimeConfig.resolution.warning,
        },
      })
    }
    engineSnapshot = resolveCaptureShellEngineRuntime(
      {
        ...ctx,
        organizationId,
        visitPath: `/visits/${ctx.visitId}`,
        studyPath: `/studies/${ctx.studyId}`,
        subjectPath: `/studies/${ctx.studyId}/subjects/${ctx.studySubjectId}`,
      },
      fields,
      {
        isSubmitted,
        canEdit,
        responseSetStatus: rs.status,
      },
      { runtimeConfig },
    )

    const supabase = await createServerClient()
    const shouldLogSnapshot = await shouldLogPerProcedureEngineEvent(
      supabase,
      procedureExecutionId,
      SOURCE_ENGINE_EVENT_TYPES.ENGINE_SNAPSHOT_GENERATED,
    )
    if (shouldLogSnapshot && engineSnapshot) {
      void logSourceEngineOperationalEvent({
        eventType: SOURCE_ENGINE_EVENT_TYPES.ENGINE_SNAPSHOT_GENERATED,
        context: operationalCtx,
        extras: resolutionMetaFromSnapshot(engineSnapshot),
        supabase,
      })
    }
  } catch (error) {
    console.warn('[SourceEngine] capture shell runtime unavailable', {
      procedureExecutionId,
      sourceDefinitionVersionId: ctx.sourceDefinitionVersionId,
      error,
    })
    void logSourceEngineOperationalEvent({
      eventType: SOURCE_ENGINE_EVENT_TYPES.ENGINE_SNAPSHOT_FAILED,
      context: operationalCtx,
      extras: {
        errorMessage: error instanceof Error ? error.message : String(error),
      },
    })
    engineSnapshot = null
  }

  const runtimeFieldsBefore = fields.filter((field) => field.runtimeState).length
  fields = applyEngineRuntimeToCaptureFields(fields, engineSnapshot)
  const runtimeFieldsAfter = fields.filter((field) => field.runtimeState).length
  const fieldsAppliedCount = Math.max(0, runtimeFieldsAfter - runtimeFieldsBefore)

  if (engineSnapshot && fieldsAppliedCount > 0) {
    const supabase = await createServerClient()
    const shouldLogRuntimeApplied = await shouldLogPerProcedureEngineEvent(
      supabase,
      procedureExecutionId,
      SOURCE_ENGINE_EVENT_TYPES.ENGINE_RUNTIME_STATE_APPLIED,
    )
    if (shouldLogRuntimeApplied) {
      void logSourceEngineOperationalEvent({
        eventType: SOURCE_ENGINE_EVENT_TYPES.ENGINE_RUNTIME_STATE_APPLIED,
        context: operationalCtx,
        extras: {
          ...resolutionMetaFromSnapshot(engineSnapshot),
          fieldsAppliedCount,
        },
        supabase,
      })
    }
  }

  const visitPath = `/visits/${ctx.visitId}`
  const nextIncompleteProcedure = await findNextIncompleteProcedureInVisit({
    visitId: ctx.visitId,
    organizationId,
    excludeProcedureExecutionId: procedureExecutionId,
  })

  return {
    status: 'success',
    model: {
      context: {
        ...ctx,
        organizationId,
        visitPath,
        studyPath: `/studies/${ctx.studyId}`,
        subjectPath: `/studies/${ctx.studyId}/subjects/${ctx.studySubjectId}`,
      },
      completionNav: {
        visitPath,
        visitWorkflowPath: `${visitPath}?tab=workflow`,
        nextIncompleteProcedure,
      },
      responseSetId,
      statusLabel: bundle.detail.data.statusLabel,
      canEdit,
      isSubmitted,
      openedAtDisplay: openedRow?.value ?? formatTimestamp(rs.opened_at),
      submittedAtDisplay:
        submittedRow && submittedRow.value !== '—' ? submittedRow.value : null,
      manifest,
      fields,
      canViewUnblindedSource: mayViewUnblinded,
      reviewHref: `/source/response-set/${responseSetId}?organization_id=${organizationId}`,
      engineSnapshot,
    },
  }
}
