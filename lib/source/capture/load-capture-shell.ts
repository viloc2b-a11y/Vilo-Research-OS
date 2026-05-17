/**
 * Phase 5.2D — Open/load response set and build capture shell view-model.
 */

import { fetchResponseSetDetail } from '@/lib/api/source/read-client'
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
import { normalizeCaptureFields } from '@/lib/source/capture/normalize-capture-fields'
import type { CaptureShellLoadResult } from '@/lib/source/capture/types'

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

  let responseSetId = await findResponseSetIdForProcedure(
    procedureExecutionId,
    ctx.sourceDefinitionVersionId,
  )

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

  const fieldIds = detailEnvelope.data.fields.map((f) => f.source_field_id)
  const optionsByFieldId = await loadFieldOptionsByFieldId(fieldIds)
  const fields = normalizeCaptureFields(detailEnvelope.data, optionsByFieldId)

  const rs = detailEnvelope.data.response_set
  const manifest =
    bundle.manifest.status === 'success' ? bundle.manifest.data : null
  const isSubmitted = manifest?.isSubmitted ?? rs.status === 'submitted'
  const canEdit = !isSubmitted && rs.status !== 'locked' && rs.status !== 'archived'

  const openedRow = bundle.detail.data.metadataRows.find((r) => r.label === 'Opened')
  const submittedRow = bundle.detail.data.metadataRows.find((r) => r.label === 'Submitted')

  return {
    status: 'success',
    model: {
      context: {
        ...ctx,
        organizationId,
        visitPath: `/visits/${ctx.visitId}`,
        studyPath: `/studies/${ctx.studyId}`,
        subjectPath: `/subjects/${ctx.studySubjectId}`,
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
      reviewHref: `/source/response-set/${responseSetId}?organization_id=${organizationId}`,
    },
  }
}
