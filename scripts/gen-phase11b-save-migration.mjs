import fs from 'node:fs'

const src = fs.readFileSync('supabase/migrations/0034_phase4b1_open_and_save_rpc.sql', 'utf8')
const match = src.match(/create or replace function public\.save_source_draft[\s\S]*?^\$\$/m)
if (!match) throw new Error('save_source_draft not found')

let fn = match[0]
fn = fn.replace(
  /p_responses jsonb\s*\)/,
  'p_responses jsonb,\n  p_expected_updated_at timestamptz default null\n)',
)
fn = fn.replace(
  /select\s+srs\.\* into v_set\s+from\s+public\.source_response_sets srs\s+where\s+srs\.id = p_source_response_set_id;/,
  `select srs.* into v_set
  from public.source_response_sets srs
  where srs.id = p_source_response_set_id
  for update;`,
)
fn = fn.replace(
  /if not public\.phase4b_srs_is_mutable_status \(v_set\.status\) then/,
  `if p_expected_updated_at is not null
    and v_set.updated_at is distinct from p_expected_updated_at then
    raise exception 'STALE_WRITE: response set changed on server; refresh and retry';
  end if;

  if not public.phase4b_srs_is_mutable_status (v_set.status) then`,
)
fn = fn.replace(
  /if v_saved > 0\s+and v_set\.status = 'draft' then[\s\S]*?v_set\.status := 'in_progress';\s+end if;/,
  `if v_saved > 0 then
    update public.source_response_sets
    set
      status = case when status = 'draft' then 'in_progress' else status end,
      updated_at = clock_timestamp()
    where id = v_set.id
    returning status, updated_at into v_set.status, v_set.updated_at;
  end if;`,
)
fn = fn.replace(
  /'responses',\s+v_summaries/,
  `'response_set_updated_at', v_set.updated_at,
      'responses',
      v_summaries`,
)
fn = fn.replace(
  /return jsonb_build_object\(\s+'ok',\s+jsonb_array_length \(v_errors\) = 0\s+or v_saved > 0,/,
  `return jsonb_build_object(
    'ok',
    jsonb_array_length (v_errors) = 0,`,
)
fn = fn.replace(
  /when v_saved > 0 then 'SUCCESS'\s+when jsonb_array_length \(v_errors\) > 0 then 'PARTIAL_FAILURE'/,
  `when jsonb_array_length (v_errors) > 0 then 'PARTIAL_FAILURE'
      when v_saved > 0 then 'SUCCESS'`,
)
// Ensure function terminator is valid for COMMENT ON
if (!fn.trimEnd().endsWith('$$;')) {
  fn = fn.replace(/\$\$\s*$/, '$$;')
}
fn = fn.replace(
  /comment on function public\.save_source_draft \(uuid, uuid, jsonb\)/,
  'comment on function public.save_source_draft (uuid, uuid, jsonb, timestamptz)',
)

const reopen = `
create or replace function public.reopen_visit_coordinator_closeout (
  p_organization_id uuid,
  p_visit_id uuid,
  p_actor_name text,
  p_reopen_reason text default null
) returns jsonb
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_now timestamptz := clock_timestamp();
  v_visit public.visits%rowtype;
  v_event_id uuid;
begin
  if v_uid is null then
    return jsonb_build_object('ok', false, 'error', 'authentication required', 'idempotent', false);
  end if;

  select v.*
  into v_visit
  from public.visits v
  where v.id = p_visit_id
    and v.organization_id = p_organization_id
  for update;

  if not found then
    return jsonb_build_object('ok', false, 'error', 'visit not found', 'idempotent', false);
  end if;

  if not public.user_can_manage_subject_enrollment (v_visit.study_id) then
    return jsonb_build_object('ok', false, 'error', 'insufficient study access', 'idempotent', false);
  end if;

  if v_visit.visit_review_status = 'reopened' then
    return jsonb_build_object('ok', true, 'error', null, 'idempotent', true);
  end if;

  if v_visit.visit_review_status not in ('coordinator_signed', 'investigator_signed') then
    return jsonb_build_object(
      'ok', false,
      'error', 'visit closeout was changed; refresh before reopening',
      'idempotent', false
    );
  end if;

  update public.visit_progress_notes
  set
    coordinator_signature_status = 'draft',
    coordinator_signed_by_user_id = null,
    coordinator_signed_by_name = null,
    coordinator_signed_at = null,
    investigator_review_status = 'pending',
    investigator_signed_by_user_id = null,
    investigator_signed_by_name = null,
    investigator_role = null,
    investigator_signed_at = null,
    updated_by = v_uid
  where visit_id = p_visit_id;

  update public.visits
  set
    visit_review_status = 'reopened',
    coordinator_signed_by = null,
    coordinator_signed_by_name = null,
    coordinator_signed_at = null,
    investigator_signed_by = null,
    investigator_signed_by_name = null,
    investigator_role = null,
    investigator_signed_at = null
  where id = p_visit_id;

  if public.user_can_append_operational_events (v_visit.study_id) then
    insert into public.operational_events (
      organization_id,
      study_id,
      visit_id,
      procedure_execution_id,
      event_type,
      payload,
      actor_user_id,
      occurred_at
    )
    values (
      v_visit.organization_id,
      v_visit.study_id,
      p_visit_id,
      null,
      'CLOSEOUT_REOPENED',
      jsonb_build_object(
        'source', 'reopen_visit_coordinator_closeout_rpc',
        'actor_name', nullif(trim(p_actor_name), ''),
        'closeout_context', 'coordinator_reopened',
        'reopen_reason', nullif(trim(p_reopen_reason), '')
      ),
      v_uid,
      v_now
    )
    returning id into v_event_id;
  end if;

  return jsonb_build_object(
    'ok', true,
    'error', null,
    'idempotent', false,
    'operational_event_id', v_event_id
  );
end;
$$;
`

const indexes = `
create unique index if not exists operational_events_source_submit_once_idx
  on public.operational_events (procedure_execution_id, (payload ->> 'source_response_set_id'))
  where event_type = 'SOURCE_RESPONSE_SET_SUBMITTED'
    and procedure_execution_id is not null;

create unique index if not exists operational_events_subject_terminal_once_idx
  on public.operational_events (study_id, (payload ->> 'subject_id'), event_type)
  where event_type in (
    'SUBJECT_COMPLETED',
    'SUBJECT_WITHDRAWN',
    'SUBJECT_SCREEN_FAILED',
    'SUBJECT_LOST_TO_FOLLOW_UP',
    'external_randomization_recorded'
  );
`

const grants = `
revoke all on function public.reopen_visit_coordinator_closeout (uuid, uuid, text, text) from public;
grant execute on function public.reopen_visit_coordinator_closeout (uuid, uuid, text, text) to authenticated;

revoke all on function public.save_source_draft (uuid, uuid, jsonb, timestamptz) from public;
grant execute on function public.save_source_draft (uuid, uuid, jsonb, timestamptz) to authenticated;
`

const out = `-- Phase 11B: concurrency + multi-actor runtime hardening

-- ---------------------------------------------------------------------------
-- P0-1: optimistic concurrency on draft source save (FOR UPDATE + updated_at token)
-- ---------------------------------------------------------------------------

drop function if exists public.save_source_draft (uuid, uuid, jsonb);

${fn}

comment on function public.save_source_draft (uuid, uuid, jsonb, timestamptz) is
  'Phase 11B: draft save with row lock and optional updated_at stale-write rejection.';

-- ---------------------------------------------------------------------------
-- P0-3: atomic coordinator closeout reopen (CAS on visit_review_status)
-- ---------------------------------------------------------------------------
${reopen}

comment on function public.reopen_visit_coordinator_closeout (uuid, uuid, text, text) is
  'Phase 11B: atomically reopen coordinator/investigator closeout with visit row lock.';

-- ---------------------------------------------------------------------------
-- P1-6: dedupe semantic terminal / submit operational events
-- ---------------------------------------------------------------------------
${indexes}

${grants}
`

fs.writeFileSync('supabase/migrations/0068_phase11b_concurrency.sql', out)
console.log('wrote 0068_phase11b_concurrency.sql', out.length, 'bytes')
