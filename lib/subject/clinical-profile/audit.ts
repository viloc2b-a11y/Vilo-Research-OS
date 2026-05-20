// lib/subject/clinical-profile/audit.ts
// Immutable audit event writer for all subject clinical profile mutations.
// Called from every server action that mutates the profile — never called from client.
// ALCOA+ compliance: actor_id, occurred_at (DB-side), before/after snapshots.

import { createServerClient } from '@/lib/supabase/server'
import type { ProfileSection, ProfileEventType } from './types'

export interface WriteProfileEventInput {
  study_subject_id: string
  section: ProfileSection
  record_id: string
  event_type: ProfileEventType
  actor_role?: string | null
  before_snapshot?: Record<string, unknown> | null
  after_snapshot: Record<string, unknown>
  change_reason?: string | null
  source_attribution?: string | null
}

/**
 * Append an immutable audit event to subject_clinical_profile_events.
 * organization_id is resolved by DB trigger from study_subject_id.
 * occurred_at is set to now() by DB trigger — never trust client timestamps.
 *
 * Throws on failure — callers must handle or let the error propagate
 * so the parent transaction is not silently completed without an audit trail.
 */
export async function writeProfileEvent(input: WriteProfileEventInput): Promise<void> {
  const supabase = await createServerClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('writeProfileEvent: no authenticated user')

  const { error } = await supabase
    .from('subject_clinical_profile_events')
    .insert({
      // organization_id is resolved by DB trigger
      organization_id: '00000000-0000-0000-0000-000000000000', // placeholder; trigger overwrites
      study_subject_id: input.study_subject_id,
      section: input.section,
      record_id: input.record_id,
      event_type: input.event_type,
      actor_id: user.id,
      actor_role: input.actor_role ?? null,
      // occurred_at: set by DB trigger to now()
      before_snapshot: input.before_snapshot ?? null,
      after_snapshot: input.after_snapshot,
      change_reason: input.change_reason ?? null,
      source_attribution: input.source_attribution ?? null,
    })

  if (error) {
    throw new Error(`writeProfileEvent failed [${input.section}/${input.event_type}]: ${error.message}`)
  }
}
