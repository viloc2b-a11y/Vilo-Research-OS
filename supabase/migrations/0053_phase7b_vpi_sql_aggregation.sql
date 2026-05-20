-- Phase 7B — VPI SQL aggregation (views + dashboard RPC)
-- Idempotent: create or replace views/functions; safe to re-run.

-- ---------------------------------------------------------------------------
-- 1. Workflow ownership column (keeps created_by)
-- ---------------------------------------------------------------------------
alter table public.subject_workflow_actions
  add column if not exists assigned_user_id uuid references auth.users (id) on delete set null;

comment on column public.subject_workflow_actions.assigned_user_id is
  'Coordinator assignee for inbox load; null = unassigned queue. created_by retained for audit.';

create index if not exists vpi_workflow_assigned_user_idx
  on public.subject_workflow_actions (organization_id, assigned_user_id, status, due_date)
  where status in ('open', 'in_progress');

create index if not exists vpi_workflow_study_status_idx
  on public.subject_workflow_actions (study_id, action_type, status)
  where status in ('open', 'in_progress');

create index if not exists vpi_visits_study_window_end_idx
  on public.visits (study_id, window_end)
  where window_end is not null;

create index if not exists vpi_visits_unsigned_completed_idx
  on public.visits (study_id, completed_at)
  where source_status <> 'signed' and completed_at is not null;

create index if not exists vpi_procedure_study_validation_idx
  on public.procedure_executions (study_id, validation_status)
  where validation_status = 'blocked';

-- ---------------------------------------------------------------------------
-- 2. vpi_study_health_v1
-- ---------------------------------------------------------------------------
create or replace view public.vpi_study_health_v1
with (security_invoker = true) as
select
  s.organization_id,
  s.id as study_id,
  s.name as study_name,
  s.status as study_status,

  (
    select count(*)::int
    from public.study_subjects ss
    where ss.study_id = s.id
  ) as subject_count,

  (
    select count(*)::int
    from public.study_subjects ss
    where ss.study_id = s.id
      and ss.enrollment_status = 'enrolled'
  ) as enrolled_count,

  (
    select count(*)::int
    from public.visits v
    where v.study_id = s.id
      and v.visit_status in ('scheduled', 'checked_in', 'in_progress', 'confirmed')
  ) as active_visit_count,

  (
    select count(*)::int
    from public.visits v
    where v.study_id = s.id
      and v.visit_status in ('missed', 'out_of_window')
  ) as missed_visit_count,

  (
    select count(*)::int
    from public.subject_workflow_actions wa
    where wa.study_id = s.id
      and wa.action_type = 'query'
      and wa.status in ('open', 'in_progress')
  ) as open_query_count,

  (
    select count(*)::int
    from public.source_response_validation_findings f
    join public.source_response_sets srs on srs.id = f.response_set_id
    where srs.study_id = s.id
      and f.status = 'open'
  ) as open_findings_count,

  (
    select count(*)::int
    from public.procedure_executions pe
    where pe.study_id = s.id
      and pe.validation_status = 'blocked'
  ) as blocked_procedure_count,

  (
    select count(*)::int
    from public.visits v
    where v.study_id = s.id
      and v.source_status <> 'signed'
      and v.completed_at is not null
      and v.completed_at < (now() - interval '48 hours')
  ) as unsigned_over_48h_count,

  (
    select count(*)::int
    from public.visits v
    where v.study_id = s.id
      and v.window_end = current_date
      and v.visit_status not in ('completed', 'cancelled', 'locked')
  ) as visits_closing_window_today,

  (
    coalesce(
      (
        select max(oe.occurred_at)
        from public.operational_events oe
        where oe.study_id = s.id
      ),
      s.updated_at
    ) < (now() - interval '14 days')
  ) as stale_study_flag,

  coalesce(
    (
      select max(oe.occurred_at)
      from public.operational_events oe
      where oe.study_id = s.id
    ),
    s.updated_at
  ) as last_activity_at
from public.studies s;

-- ---------------------------------------------------------------------------
-- 3. vpi_subject_risk_signals_v1
-- ---------------------------------------------------------------------------
create or replace view public.vpi_subject_risk_signals_v1
with (security_invoker = true) as

select
  v.organization_id,
  v.study_id,
  v.study_subject_id as subject_id,
  ss.subject_identifier,
  st.name as study_name,
  'missed_visit'::text as signal_kind,
  ('visits:' || v.id::text) as signal_source,
  v.id as signal_entity_id,
  coalesce(v.updated_at, v.created_at) as signal_created_at,
  round(extract(epoch from (now() - coalesce(v.updated_at, v.created_at))) / 3600.0)::int as signal_age_hours,
  0 as severity_rank,
  'Open visit and resolve missed status'::text as recommended_action
from public.visits v
join public.study_subjects ss on ss.id = v.study_subject_id
join public.studies st on st.id = v.study_id
where v.visit_status = 'missed'

union all

select
  v.organization_id,
  v.study_id,
  v.study_subject_id,
  ss.subject_identifier,
  st.name,
  'out_of_window',
  'visits:' || v.id::text,
  v.id,
  coalesce(v.updated_at, v.created_at),
  round(extract(epoch from (now() - coalesce(v.updated_at, v.created_at))) / 3600.0)::int,
  1,
  'Review out-of-window visit'::text
from public.visits v
join public.study_subjects ss on ss.id = v.study_subject_id
join public.studies st on st.id = v.study_id
where v.visit_status = 'out_of_window'
   or v.window_status = 'outside_window'

union all

select
  v.organization_id,
  v.study_id,
  v.study_subject_id,
  ss.subject_identifier,
  st.name,
  'window_warning',
  'visits:' || v.id::text,
  v.id,
  coalesce(v.updated_at, v.created_at),
  round(extract(epoch from (now() - coalesce(v.updated_at, v.created_at))) / 3600.0)::int,
  2,
  'Monitor visit window warning'::text
from public.visits v
join public.study_subjects ss on ss.id = v.study_subject_id
join public.studies st on st.id = v.study_id
where v.window_status = 'warning'
  and v.visit_status not in ('completed', 'cancelled', 'locked')
  and v.visit_status <> 'missed'
  and v.visit_status <> 'out_of_window'

union all

select
  v.organization_id,
  v.study_id,
  v.study_subject_id,
  ss.subject_identifier,
  st.name,
  'window_closing_today',
  'visits:' || v.id::text,
  v.id,
  coalesce(v.window_end::timestamptz, v.updated_at, v.created_at),
  round(extract(epoch from (now() - coalesce(v.window_end::timestamptz, v.updated_at, v.created_at))) / 3600.0)::int,
  1,
  'Confirm visit before window closes today'::text
from public.visits v
join public.study_subjects ss on ss.id = v.study_subject_id
join public.studies st on st.id = v.study_id
where v.window_end = current_date
  and v.visit_status not in ('completed', 'cancelled', 'locked')

union all

select
  v.organization_id,
  v.study_id,
  v.study_subject_id,
  ss.subject_identifier,
  st.name,
  'unsigned_procedure_48h',
  'visits:' || v.id::text,
  v.id,
  v.completed_at,
  round(extract(epoch from (now() - v.completed_at)) / 3600.0)::int,
  1,
  'Sign completed visit source (>48h)'::text
from public.visits v
join public.study_subjects ss on ss.id = v.study_subject_id
join public.studies st on st.id = v.study_id
where v.source_status <> 'signed'
  and v.completed_at is not null
  and v.completed_at < (now() - interval '48 hours')

union all

select
  wa.organization_id,
  wa.study_id,
  wa.study_subject_id,
  ss.subject_identifier,
  st.name,
  'overdue_action',
  'subject_workflow_actions:' || wa.id::text,
  wa.id,
  coalesce(wa.updated_at, wa.created_at),
  round(extract(epoch from (now() - coalesce(wa.due_date::timestamptz, wa.updated_at))) / 3600.0)::int,
  1,
  'Complete overdue workflow action'::text
from public.subject_workflow_actions wa
join public.study_subjects ss on ss.id = wa.study_subject_id
join public.studies st on st.id = wa.study_id
where wa.status in ('open', 'in_progress')
  and wa.due_date is not null
  and wa.due_date < current_date

union all

select
  pe.organization_id,
  pe.study_id,
  v.study_subject_id,
  ss.subject_identifier,
  st.name,
  'blocked_procedure',
  'procedure_executions:' || pe.id::text,
  pe.id,
  coalesce(pe.updated_at, pe.created_at),
  round(extract(epoch from (now() - coalesce(pe.updated_at, pe.created_at))) / 3600.0)::int,
  0,
  'Resolve blocking procedure validation'::text
from public.procedure_executions pe
join public.visits v on v.id = pe.visit_id
join public.study_subjects ss on ss.id = v.study_subject_id
join public.studies st on st.id = pe.study_id
where pe.validation_status = 'blocked'

union all

select
  ss.organization_id,
  ss.study_id,
  ss.id,
  ss.subject_identifier,
  st.name,
  'stale_subject',
  'study_subjects:' || ss.id::text,
  ss.id,
  coalesce(ss.updated_at, ss.created_at),
  round(extract(epoch from (now() - coalesce(ss.updated_at, ss.created_at))) / 3600.0)::int,
  2,
  'Review subject with no recent activity'::text
from public.study_subjects ss
join public.studies st on st.id = ss.study_id
where ss.enrollment_status in ('screening', 'enrolled')
  and coalesce(ss.updated_at, ss.created_at) < (now() - interval '30 days')
  and not exists (
    select 1
    from public.visits v
    where v.study_subject_id = ss.id
      and v.updated_at > (now() - interval '30 days')
  )
  and not exists (
    select 1
    from public.subject_workflow_actions wa
    where wa.study_subject_id = ss.id
      and wa.updated_at > (now() - interval '30 days')
  );

-- ---------------------------------------------------------------------------
-- 4. vpi_coordinator_load_v1
-- ---------------------------------------------------------------------------
create or replace view public.vpi_coordinator_load_v1
with (security_invoker = true) as
with open_actions as (
  select *
  from public.subject_workflow_actions wa
  where wa.status in ('open', 'in_progress')
),
org_unassigned as (
  select
    oa.organization_id,
    count(*)::int as unassigned_queue
  from open_actions oa
  where oa.assigned_user_id is null
  group by oa.organization_id
),
by_user as (
  select
    oa.organization_id,
    coalesce(oa.assigned_user_id, oa.created_by) as user_id,
    count(*)::int as assigned_items,
    count(*) filter (
      where oa.due_date is not null and oa.due_date < current_date
    )::int as overdue_items,
    count(*) filter (where oa.due_date = current_date)::int as due_today,
    max(oa.updated_at) as last_active_at
  from open_actions oa
  where coalesce(oa.assigned_user_id, oa.created_by) is not null
  group by oa.organization_id, coalesce(oa.assigned_user_id, oa.created_by)
)
select
  bu.organization_id,
  bu.user_id,
  bu.assigned_items,
  bu.overdue_items,
  (
    select count(*)::int
    from public.procedure_executions pe
    where pe.organization_id = bu.organization_id
      and pe.validation_status = 'blocked'
      and pe.performed_by_user_id = bu.user_id
  ) as blocked_items,
  bu.due_today,
  coalesce(ou.unassigned_queue, 0) as unassigned_queue,
  bu.last_active_at
from by_user bu
left join org_unassigned ou on ou.organization_id = bu.organization_id;

-- ---------------------------------------------------------------------------
-- 5. RPC — vpi_load_dashboard()
-- ---------------------------------------------------------------------------
create or replace function public.vpi_load_dashboard()
returns jsonb
language plpgsql
security definer
set search_path = public
stable
as $$
declare
  v_user uuid := auth.uid();
begin
  if v_user is null then
    raise exception 'not authenticated'
      using errcode = '42501';
  end if;

  return jsonb_build_object(
    'study_health',
    coalesce(
      (
        select jsonb_agg(to_jsonb(sh.*) order by sh.study_name)
        from public.vpi_study_health_v1 sh
        where sh.organization_id in (select public.user_organization_ids())
      ),
      '[]'::jsonb
    ),
    'subject_risk_signals',
    coalesce(
      (
        select jsonb_agg(to_jsonb(rs.*) order by rs.severity_rank asc, rs.signal_created_at asc)
        from public.vpi_subject_risk_signals_v1 rs
        where rs.organization_id in (select public.user_organization_ids())
      ),
      '[]'::jsonb
    ),
    'coordinator_load',
    coalesce(
      (
        select jsonb_agg(to_jsonb(cl.*) order by cl.assigned_items desc)
        from public.vpi_coordinator_load_v1 cl
        where cl.organization_id in (select public.user_organization_ids())
      ),
      '[]'::jsonb
    ),
    'generated_at', to_jsonb(now())
  );
end;
$$;

revoke all on function public.vpi_load_dashboard() from public;
grant execute on function public.vpi_load_dashboard() to authenticated;

grant select on public.vpi_study_health_v1 to authenticated;
grant select on public.vpi_subject_risk_signals_v1 to authenticated;
grant select on public.vpi_coordinator_load_v1 to authenticated;

revoke all on public.vpi_study_health_v1 from anon;
revoke all on public.vpi_subject_risk_signals_v1 from anon;
revoke all on public.vpi_coordinator_load_v1 from anon;
revoke execute on function public.vpi_load_dashboard() from anon;
