import { SupabaseClient } from '@supabase/supabase-js'
import { resolveForCRAMonitoringWorkbook } from './resolvers/cra-monitoring-workbook-resolver'
import { renderCRAMonitoringWorkbook } from './renderers/cra-monitoring-workbook'
import { logDeliverableAuditEvent } from './audit'
import { DeliverableRun } from './types'

export async function generateCRAMonitoringWorkbook(supabase: SupabaseClient, runId: string) {
  try {
    // 1. Load run details
    const { data: run, error: runError } = await supabase
      .from('deliverable_runs')
      .select('id, organization_id, definition_id, run_status, run_by')
      .eq('id', runId)
      .single()

    if (runError || !run) {
      throw new Error(`Failed to load run: ${runError?.message}`)
    }

    const { data: filtersData } = await supabase
      .from('deliverable_run_filters')
      .select('study_id, subject_id, visit_instance_id, options')
      .eq('run_id', runId)
      .single()

    const fullFilters = {
      studyId: filtersData?.study_id,
      subjectId: filtersData?.subject_id,
      visitInstanceId: filtersData?.visit_instance_id,
      ...(filtersData?.options as Record<string, unknown> | undefined)
    }

    const fullRun: DeliverableRun = {
      id: run.id,
      organizationId: run.organization_id,
      definitionId: run.definition_id,
      status: run.run_status,
      runBy: run.run_by,
      filters: fullFilters
    }

    // Mark as processing
    await supabase.from('deliverable_runs').update({ run_status: 'processing', started_at: new Date().toISOString() }).eq('id', runId)
    await logDeliverableAuditEvent({
      supabase,
      runId,
      action: 'run_started',
      actorId: run.run_by,
      metadata: {}
    })

    // 2. Resolve Evidence
    const asOfDate = new Date().toISOString()
    const evidence = await resolveForCRAMonitoringWorkbook(supabase, fullRun, asOfDate)

    // 3. Render XLSX
    const buffer = await renderCRAMonitoringWorkbook(evidence)

    // 4. Hash Output
    const crypto = await import('crypto')
    const hash = crypto.createHash('sha256').update(buffer).digest('hex')
    evidence.outputHash = hash

    // 5. Store in Supabase Storage
    const studyId = fullFilters.studyId
    const filename = `CRA_Workbook_${studyId}_${Date.now()}.xlsx`
    const storagePath = `${run.organization_id}/${runId}/${filename}`

    const { error: uploadError } = await supabase.storage
      .from('operational-documents')
      .upload(storagePath, buffer, {
        contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        upsert: true
      })

    if (uploadError) {
      throw new Error(`Failed to upload to storage: ${uploadError.message}`)
    }

    // 6. Insert deliverable_run_outputs
    const { data: output, error: outputError } = await supabase
      .from('deliverable_run_outputs')
      .insert({
        run_id: runId,
        format: 'xlsx',
        storage_path: storagePath,
        file_hash: hash,
        file_size_bytes: buffer.length,
      })
      .select('id')
      .single()

    if (outputError) {
      throw new Error(`Failed to save output record: ${outputError.message}`)
    }

    // 7. Mark run completed
    await supabase.from('deliverable_runs').update({ run_status: 'completed', completed_at: new Date().toISOString() }).eq('id', runId)

    // 8. Create audit event
    await logDeliverableAuditEvent({
      supabase,
      runId,
      action: 'run_completed',
      actorId: run.run_by,
      metadata: {
        outputId: output.id,
        hash,
        storagePath
      }
    })

    return { success: true as const, outputIds: [output.id], outputHash: hash, storagePath }

  } catch (error: unknown) {
    // Fail run
    await supabase.from('deliverable_runs').update({ run_status: 'failed', completed_at: new Date().toISOString() }).eq('id', runId)
    const { data: failedRun } = await supabase
      .from('deliverable_runs')
      .select('run_by')
      .eq('id', runId)
      .maybeSingle()
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    await logDeliverableAuditEvent({
      supabase,
      runId,
      action: 'run_failed',
      actorId: failedRun?.run_by ?? '00000000-0000-0000-0000-000000000000',
      metadata: { error: errorMessage }
    })
    return { success: false as const, error: errorMessage }
  }
}
