-- Organization member lifecycle: active / inactive / deactivated (no hard-delete from admin UI).

alter table public.organization_members
  add column if not exists status text not null default 'active',
  add column if not exists deactivated_at timestamptz,
  add column if not exists deactivated_by uuid references auth.users (id) on delete set null,
  add column if not exists deactivation_reason text;

alter table public.organization_members
  drop constraint if exists organization_members_status_check;

alter table public.organization_members
  add constraint organization_members_status_check
  check (status in ('active', 'inactive', 'deactivated'));

comment on column public.organization_members.status is
  'Membership lifecycle: active, inactive, or deactivated. Row is retained for audit attribution.';

comment on column public.organization_members.deactivated_at is
  'When the member was deactivated (status = deactivated).';

create index if not exists organization_members_org_status_idx
  on public.organization_members (organization_id, status);

-- True when the user has any org-scoped operational footprint that must retain linkage.
create or replace function public.user_has_org_historical_activity(
  _organization_id uuid,
  _user_id uuid
)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select
    exists (
      select 1
      from public.audit_events ae
      where ae.organization_id = _organization_id
        and ae.actor_user_id = _user_id
    )
    or exists (
      select 1
      from public.operational_events oe
      where oe.organization_id = _organization_id
        and oe.actor_user_id = _user_id
    )
    or exists (
      select 1
      from public.study_members sm
      where sm.organization_id = _organization_id
        and sm.user_id = _user_id
    )
    or exists (
      select 1
      from public.subject_workflow_actions wa
      where wa.organization_id = _organization_id
        and (
          wa.created_by = _user_id
          or wa.assigned_user_id = _user_id
          or wa.resolved_by = _user_id
        )
    )
    or exists (
      select 1
      from public.source_response_sets srs
      where srs.organization_id = _organization_id
        and (
          srs.opened_by_user_id = _user_id
          or srs.submitted_by_user_id = _user_id
          or srs.reviewed_by_user_id = _user_id
          or srs.signed_by_user_id = _user_id
          or srs.locked_by_user_id = _user_id
        )
    )
    or exists (
      select 1
      from public.source_responses sr
      where sr.organization_id = _organization_id
        and sr.originator_user_id = _user_id
    )
    or exists (
      select 1
      from public.source_response_corrections src
      where src.organization_id = _organization_id
        and src.corrected_by_user_id = _user_id
    )
    or exists (
      select 1
      from public.source_response_addenda sra
      where sra.organization_id = _organization_id
        and sra.added_by_user_id = _user_id
    )
    or exists (
      select 1
      from public.procedure_executions pe
      where pe.organization_id = _organization_id
        and pe.performed_by_user_id = _user_id
    )
    or exists (
      select 1
      from public.visits v
      where v.organization_id = _organization_id
        and (
          v.coordinator_signed_by = _user_id
          or v.investigator_signed_by = _user_id
        )
    )
    or exists (
      select 1
      from public.visit_progress_notes vpn
      where vpn.organization_id = _organization_id
        and (
          vpn.created_by = _user_id
          or vpn.updated_by = _user_id
          or vpn.coordinator_signed_by_user_id = _user_id
          or vpn.investigator_signed_by_user_id = _user_id
        )
    );
$$;

revoke all on function public.user_has_org_historical_activity(uuid, uuid) from public;
grant execute on function public.user_has_org_historical_activity(uuid, uuid) to authenticated, anon;
