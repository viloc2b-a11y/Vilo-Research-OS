import type { SupabaseClient } from '@supabase/supabase-js'
import { createServerClient } from '@/lib/supabase/server'

export type StudyCloseoutSummary = {
  finalPiSignedVisitCount: number | null
  sourceCompletionSignoffCount: number | null
  regulatoryOpenHoldCount: number | null
  regulatoryCloseoutReady: boolean | null
  unavailable: string[]
}

async function safeExactCount(
  label: string,
  unavailable: string[],
  run: () => Promise<{ count: number | null; error: { message: string } | null }>,
): Promise<number | null> {
  try {
    const { count, error } = await run()
    if (error) {
      unavailable.push(`${label}: ${error.message}`)
      return null
    }
    return count ?? 0
  } catch (err) {
    unavailable.push(`${label}: ${err instanceof Error ? err.message : 'unavailable'}`)
    return null
  }
}

export async function loadStudyCloseoutSummary(
  studyId: string,
  organizationId: string,
  supabaseClient?: SupabaseClient,
): Promise<StudyCloseoutSummary> {
  const supabase = supabaseClient ?? (await createServerClient())
  const unavailable: string[] = []

  const [finalPiSignedVisitCount, sourceCompletionSignoffCount, openHoldCount] =
    await Promise.all([
      safeExactCount('Final PI signed visits', unavailable, async () =>
        supabase
          .from('visits')
          .select('id', { count: 'exact', head: true })
          .eq('organization_id', organizationId)
          .eq('study_id', studyId)
          .eq('visit_review_status', 'investigator_signed'),
      ),
      safeExactCount('Source completion signoffs', unavailable, async () =>
        supabase
          .from('source_blueprint_draft_signoffs')
          .select('id', { count: 'exact', head: true })
          .eq('organization_id', organizationId)
          .eq('study_id', studyId)
          .eq('signoff_status', 'signed'),
      ),
      safeExactCount('Regulatory closeout holds', unavailable, async () => {
        const obligations = await supabase
          .from('compliance_obligations')
          .select('id, compliance_runtime_documents!inner(study_id)', { count: 'exact', head: true })
          .eq('organization_id', organizationId)
          .eq('compliance_runtime_documents.study_id', studyId)
          .in('status', ['pending', 'overdue', 'escalated'])

        if (obligations.error) return { count: null, error: obligations.error }

        const expirations = await supabase
          .from('compliance_expiration_alerts')
          .select('id, compliance_runtime_documents!inner(study_id)', { count: 'exact', head: true })
          .eq('organization_id', organizationId)
          .eq('compliance_runtime_documents.study_id', studyId)
          .in('status', ['pending', 'escalated'])

        if (expirations.error) return { count: null, error: expirations.error }

        return {
          count: (obligations.count ?? 0) + (expirations.count ?? 0),
          error: null,
        }
      }),
    ])

  return {
    finalPiSignedVisitCount,
    sourceCompletionSignoffCount,
    regulatoryOpenHoldCount: openHoldCount,
    regulatoryCloseoutReady:
      openHoldCount !== null ? openHoldCount === 0 : null,
    unavailable,
  }
}
