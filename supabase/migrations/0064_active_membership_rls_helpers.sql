-- RLS helpers: only active organization memberships grant operational access.
-- Preserves multi-role admin detection from 0062. Historical rows unchanged.

-- ---------------------------------------------------------------------------
-- Status predicate (NULL legacy rows = active)
-- ---------------------------------------------------------------------------

create or replace function public.organization_membership_is_active(_status text)
returns boolean
language sql
immutable
parallel safe
as $$
  select coalesce(_status, 'active') = 'active';
$$;

comment on function public.organization_membership_is_active(text) is
  'True when organization_members.status is active or NULL (pre-deactivation rows).';

-- ---------------------------------------------------------------------------
-- Core org membership helpers (SECURITY DEFINER — bypass organization_members RLS)
-- ---------------------------------------------------------------------------

create or replace function public.user_organization_ids()
returns setof uuid
language sql
security definer
set search_path = public
stable
as $$
  select om.organization_id
  from public.organization_members om
  where om.user_id = auth.uid()
    and public.organization_membership_is_active(om.status);
$$;

create or replace function public.user_has_active_organization_membership(
  _organization_id uuid
)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1
    from public.organization_members om
    where om.organization_id = _organization_id
      and om.user_id = auth.uid()
      and public.organization_membership_is_active(om.status)
  );
$$;

create or replace function public.user_is_org_admin(_organization_id uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1
    from public.organization_members om
    where om.organization_id = _organization_id
      and om.user_id = auth.uid()
      and public.organization_membership_is_active(om.status)
      and (
        om.role in ('owner', 'admin')
        or om.roles && array['owner', 'admin']::text[]
      )
  );
$$;

-- ---------------------------------------------------------------------------
-- Study-scoped helpers: require active site membership for the study's org
-- ---------------------------------------------------------------------------

create or replace function public.user_study_ids()
returns setof uuid
language sql
security definer
set search_path = public
stable
as $$
  select sm.study_id
  from public.study_members sm
  where sm.user_id = auth.uid()
    and public.user_has_active_organization_membership(sm.organization_id);
$$;

create or replace function public.user_has_study_access(_study_id uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1
    from public.study_members sm
    where sm.study_id = _study_id
      and sm.user_id = auth.uid()
      and public.user_has_active_organization_membership(sm.organization_id)
  );
$$;

create or replace function public.user_is_study_admin(_study_id uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1
    from public.study_members sm
    where sm.study_id = _study_id
      and sm.user_id = auth.uid()
      and sm.role = 'study_admin'
      and public.user_has_active_organization_membership(sm.organization_id)
  );
$$;

create or replace function public.user_can_manage_study_roster(_study_id uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select
    public.user_is_org_admin(
      (select s.organization_id from public.studies s where s.id = _study_id)
    )
    or public.user_is_study_admin(_study_id);
$$;

create or replace function public.user_can_manage_subject_enrollment(_study_id uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select
    public.user_is_org_admin(
      (select s.organization_id from public.studies s where s.id = _study_id)
    )
    or exists (
      select 1
      from public.study_members sm
      where sm.study_id = _study_id
        and sm.user_id = auth.uid()
        and sm.role in ('study_admin', 'coordinator', 'lab')
        and public.user_has_active_organization_membership(sm.organization_id)
    );
$$;

create or replace function public.user_can_edit_study_definitions(_study_id uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select
    public.user_is_org_admin(
      (select s.organization_id from public.studies s where s.id = _study_id)
    )
    or exists (
      select 1
      from public.study_members sm
      where sm.study_id = _study_id
        and sm.user_id = auth.uid()
        and sm.role in ('study_admin', 'coordinator', 'lab')
        and public.user_has_active_organization_membership(sm.organization_id)
    );
$$;

create or replace function public.user_can_append_operational_events(_study_id uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select
    public.user_is_org_admin(
      (select s.organization_id from public.studies s where s.id = _study_id)
    )
    or exists (
      select 1
      from public.study_members sm
      where sm.study_id = _study_id
        and sm.user_id = auth.uid()
        and sm.role in ('study_admin', 'coordinator', 'lab')
        and public.user_has_active_organization_membership(sm.organization_id)
    );
$$;

-- Grants (idempotent)
revoke all on function public.organization_membership_is_active(text) from public;
grant execute on function public.organization_membership_is_active(text) to authenticated, anon;

revoke all on function public.user_has_active_organization_membership(uuid) from public;
grant execute on function public.user_has_active_organization_membership(uuid) to authenticated, anon;

revoke all on function public.user_organization_ids() from public;
revoke all on function public.user_is_org_admin(uuid) from public;
grant execute on function public.user_organization_ids() to authenticated, anon;
grant execute on function public.user_is_org_admin(uuid) to authenticated, anon;

revoke all on function public.user_study_ids() from public;
revoke all on function public.user_has_study_access(uuid) from public;
revoke all on function public.user_is_study_admin(uuid) from public;
revoke all on function public.user_can_manage_study_roster(uuid) from public;
grant execute on function public.user_study_ids() to authenticated, anon;
grant execute on function public.user_has_study_access(uuid) to authenticated, anon;
grant execute on function public.user_is_study_admin(uuid) to authenticated, anon;
grant execute on function public.user_can_manage_study_roster(uuid) to authenticated, anon;

revoke all on function public.user_can_manage_subject_enrollment(uuid) from public;
revoke all on function public.user_can_edit_study_definitions(uuid) from public;
revoke all on function public.user_can_append_operational_events(uuid) from public;
grant execute on function public.user_can_manage_subject_enrollment(uuid) to authenticated, anon;
grant execute on function public.user_can_edit_study_definitions(uuid) to authenticated, anon;
grant execute on function public.user_can_append_operational_events(uuid) to authenticated, anon;
