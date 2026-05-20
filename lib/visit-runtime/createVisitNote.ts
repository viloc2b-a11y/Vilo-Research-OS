import { OPERATIONAL_EVENT_TYPES } from '@/lib/operations/event-types'
import { logProcedureOperationalEvent } from '@/lib/operations/logOperationalEvent'
import type { createServerClient } from '@/lib/supabase/server'

type Supabase = Awaited<ReturnType<typeof createServerClient>>

export async function createVisitNote(params: {
  supabase: Supabase
  procedure: { id: string; organization_id: string; study_id: string; visit_id: string }
  actorUserId: string
  noteText: string
}) {
  const { error } = await params.supabase.from('subject_visit_notes').insert({
    organization_id: params.procedure.organization_id,
    study_id: params.procedure.study_id,
    subject_visit_id: params.procedure.visit_id,
    procedure_execution_id: params.procedure.id,
    note_text: params.noteText,
    created_by: params.actorUserId,
  })
  if (error) return { ok: false as const, error: error.message }

  await logProcedureOperationalEvent({
    supabase: params.supabase,
    procedure: params.procedure,
    actorUserId: params.actorUserId,
    eventType: OPERATIONAL_EVENT_TYPES.NOTE_ADDED,
    payload: {
      note_preview: params.noteText.slice(0, 200),
      context: 'procedure_runtime',
    },
  })

  return { ok: true as const }
}
