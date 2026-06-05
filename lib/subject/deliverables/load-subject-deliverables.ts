import { SupabaseClient } from '@supabase/supabase-js'

export type SubjectDeliverablesModel = {
  deliverableRuns: Array<{
    id: string
    status: string
    startedAt: string | null
    completedAt: string | null
    runBy: string
    systemCode: string
    deliverableName: string
    visitInstanceId: string | null
    outputs: Array<{
      id: string
      format: string
      storagePath: string
    }>
  }>
  visitInstances: Array<{
    id: string
    visitName: string
    visitDate: string | null
    status: string
    sourcePackageId: string | null
  }>
}

type DeliverableRunRow = {
  id: string
  run_status: string
  started_at: string | null
  completed_at: string | null
  run_by: string
  deliverable_definitions?: {
    system_code: string
    name: string
  }[] | null
  deliverable_run_outputs?: Array<{
    id: string
    format: string
    storage_path: string
  }> | null
}

type VisitInstanceRow = {
  id: string
  visit_name: string | null
  started_at: string | null
  visit_status: string
  source_package_id: string | null
}

export async function loadSubjectDeliverables(
  supabase: SupabaseClient,
  studySubjectId: string,
  organizationId: string
): Promise<{ ok: true; model: SubjectDeliverablesModel } | { ok: false; error: string }> {
  try {
    // 1. Load run filters that match this subject
    const { data: filtersData, error: filtersError } = await supabase
      .from('deliverable_run_filters')
      .select('run_id, visit_instance_id')
      .eq('subject_id', studySubjectId)

    if (filtersError) {
      return { ok: false, error: `Failed to load deliverable runs for subject: ${filtersError.message}` }
    }

    const runIds = filtersData?.map(f => f.run_id) ?? []
    
    // 2. Load runs and outputs
    let deliverableRuns: SubjectDeliverablesModel['deliverableRuns'] = []
    if (runIds.length > 0) {
      const { data: runsData, error: runsError } = await supabase
        .from('deliverable_runs')
        .select(`
          id,
          run_status,
          started_at,
          completed_at,
          run_by,
          deliverable_definitions (
            system_code,
            name
          ),
          deliverable_run_outputs (
            id,
            format,
            storage_path
          )
        `)
        .in('id', runIds)
        .order('created_at', { ascending: false })

      if (runsError) {
        return { ok: false, error: `Failed to load deliverable runs: ${runsError.message}` }
      }

      deliverableRuns = (runsData || [] as DeliverableRunRow[]).map((run) => {
        const filter = filtersData?.find((f) => f.run_id === run.id)
        const definition = run.deliverable_definitions?.[0]
        return {
          id: run.id,
          status: run.run_status,
          startedAt: run.started_at,
          completedAt: run.completed_at,
          runBy: run.run_by,
          systemCode: definition?.system_code,
          deliverableName: definition?.name,
          visitInstanceId: filter?.visit_instance_id ?? null,
          outputs: (run.deliverable_run_outputs || []).map((out) => ({
            id: out.id,
            format: out.format,
            storagePath: out.storage_path,
          }))
        }
      })
    }

    // 3. Load visit instances for Printable Source Packet
    // A visit instance must have a source package assigned to generate a packet
    const { data: visitsData, error: visitsError } = await supabase
      .from('visit_runtime_instances')
      .select('id, visit_name, started_at, visit_status, source_package_id')
      .eq('subject_id', studySubjectId)
      .eq('organization_id', organizationId)
      .order('created_at', { ascending: false })

    if (visitsError) {
      return { ok: false, error: `Failed to load visit instances: ${visitsError.message}` }
    }

    const visitInstances = (visitsData || [] as VisitInstanceRow[]).map((v) => ({
      id: v.id,
      visitName: v.visit_name ?? 'Unknown Visit',
      visitDate: v.started_at ?? null,
      status: v.visit_status,
      sourcePackageId: v.source_package_id,
    }))

    return {
      ok: true,
      model: {
        deliverableRuns,
        visitInstances,
      },
    }
  } catch (error: unknown) {
    return { ok: false, error: error instanceof Error ? error.message : 'Unknown error loading deliverables' }
  }
}
