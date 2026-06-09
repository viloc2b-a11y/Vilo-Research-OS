-- Pharmacy Runtime Phase 1: study-aware access foundation.
-- Access is computed per study from study configuration + membership + delegation + training + blinding scope.

create table if not exists public.pharmacy_study_access_config (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  study_id uuid not null references public.studies(id) on delete cascade,
  site_id uuid null references public.organizations(id) on delete set null,
  blinding_model text not null default 'open_label',
  training_requirement text not null default 'optional',
  status text not null default 'active',
  created_by uuid null references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint pharmacy_access_blinding_model_check check (
    blinding_model in ('open_label', 'single_blind', 'double_blind')
  ),
  constraint pharmacy_access_training_requirement_check check (
    training_requirement in ('required', 'optional')
  ),
  constraint pharmacy_access_status_check check (
    status in ('active', 'inactive')
  )
);

create table if not exists public.pharmacy_study_authorization_overrides (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  study_id uuid not null references public.studies(id) on delete cascade,
  site_id uuid null references public.organizations(id) on delete set null,
  user_id uuid not null references auth.users(id) on delete cascade,
  study_authorization_scope text not null,
  reason text not null,
  status text not null default 'active',
  granted_by uuid null references auth.users(id) on delete set null,
  granted_at timestamptz not null default now(),
  revoked_at timestamptz null,
  constraint pharmacy_auth_scope_check check (
    study_authorization_scope in (
      'blinded',
      'unblinded',
      'pharmacy_unblinded',
      'sponsor_unblinded',
      'monitor_blinded'
    )
  ),
  constraint pharmacy_auth_override_status_check check (
    status in ('active', 'revoked', 'expired')
  ),
  constraint pharmacy_auth_override_reason_required check (length(trim(reason)) > 0)
);

create table if not exists public.pharmacy_site_memberships (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  study_id uuid not null references public.studies(id) on delete cascade,
  site_id uuid not null references public.organizations(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  status text not null default 'active',
  created_by uuid null references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  constraint pharmacy_site_memberships_status_check check (status in ('active', 'inactive', 'revoked')),
  constraint pharmacy_site_memberships_unique unique (study_id, site_id, user_id)
);

create unique index if not exists pharmacy_auth_override_active_unique
  on public.pharmacy_study_authorization_overrides(study_id, coalesce(site_id, '00000000-0000-0000-0000-000000000000'::uuid), user_id)
  where status = 'active';

create unique index if not exists pharmacy_access_config_unique_study_site
  on public.pharmacy_study_access_config(study_id, coalesce(site_id, '00000000-0000-0000-0000-000000000000'::uuid));

create index if not exists pharmacy_access_config_study_idx
  on public.pharmacy_study_access_config(study_id);
create index if not exists pharmacy_access_config_org_idx
  on public.pharmacy_study_access_config(organization_id);
create index if not exists pharmacy_auth_override_user_idx
  on public.pharmacy_study_authorization_overrides(user_id);
create index if not exists pharmacy_auth_override_study_idx
  on public.pharmacy_study_authorization_overrides(study_id);
create index if not exists pharmacy_site_memberships_user_idx
  on public.pharmacy_site_memberships(user_id);
create index if not exists pharmacy_site_memberships_study_site_idx
  on public.pharmacy_site_memberships(study_id, site_id);

create or replace function public.pharmacy_access_touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists pharmacy_access_config_touch_updated_at
  on public.pharmacy_study_access_config;
create trigger pharmacy_access_config_touch_updated_at
before update on public.pharmacy_study_access_config
for each row execute function public.pharmacy_access_touch_updated_at();

create or replace function public.pharmacy_delegated_task_labels(_action text)
returns text[]
language sql
immutable
parallel safe
as $$
  select case _action
    when 'receipt' then array['Receipt of IP', 'IP Accountability']
    when 'inventory_review' then array['Inventory Review', 'IP Accountability']
    when 'inventory_reconciliation' then array['Inventory Reconciliation', 'IP Accountability']
    when 'correction' then array['Correction of Accountability Records', 'IP Accountability']
    when 'dispense' then array['Product Dispensing']
    when 'return' then array['Product Return']
    when 'destruction' then array['Product Destruction']
    else array[_action]
  end;
$$;

create or replace function public.pharmacy_user_has_active_delegation(
  _study_id uuid,
  _action text
)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1
    from public.study_delegation_log dl
    where dl.study_id = _study_id
      and dl.staff_user_id = auth.uid()
      and dl.delegation_status in ('Active', 'Locked')
      and dl.delegation_start_date <= current_date
      and (dl.is_ongoing = true or dl.delegation_stop_date >= current_date)
      and dl.task_labels && public.pharmacy_delegated_task_labels(_action)
  );
$$;

create or replace function public.pharmacy_user_has_active_site_membership(
  _study_id uuid,
  _site_id uuid default null
)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select
    case
      when _site_id is null then public.user_has_study_access(_study_id)
      else exists (
        select 1
        from public.pharmacy_site_memberships psm
        where psm.study_id = _study_id
          and psm.site_id = _site_id
          and psm.user_id = auth.uid()
          and psm.status = 'active'
      )
    end;
$$;

create or replace function public.pharmacy_user_training_satisfied(
  _study_id uuid,
  _required boolean
)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select
    case
      when not _required then true
      else exists (
        select 1
        from public.study_training_assignments sta
        where sta.study_id = _study_id
          and sta.trainee_user_id = auth.uid()
          and sta.training_status in ('Completed', 'Locked')
      )
    end;
$$;

create or replace function public.pharmacy_study_blinding_model(
  _study_id uuid,
  _site_id uuid default null
)
returns text
language sql
security definer
set search_path = public
stable
as $$
  select coalesce(
    (
      select cfg.blinding_model
      from public.pharmacy_study_access_config cfg
      where cfg.study_id = _study_id
        and cfg.status = 'active'
        and (cfg.site_id is not distinct from _site_id or cfg.site_id is null)
      order by (cfg.site_id is not null) desc
      limit 1
    ),
    case
      when lower(coalesce((select s.blinding_type from public.studies s where s.id = _study_id), 'Open Label')) like '%double%' then 'double_blind'
      when lower(coalesce((select s.blinding_type from public.studies s where s.id = _study_id), 'Open Label')) like '%single%' then 'single_blind'
      else 'open_label'
    end
  );
$$;

create or replace function public.pharmacy_training_required(
  _study_id uuid,
  _site_id uuid default null
)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select coalesce(
    (
      select cfg.training_requirement = 'required'
      from public.pharmacy_study_access_config cfg
      where cfg.study_id = _study_id
        and cfg.status = 'active'
        and (cfg.site_id is not distinct from _site_id or cfg.site_id is null)
      order by (cfg.site_id is not null) desc
      limit 1
    ),
    false
  );
$$;

create or replace function public.pharmacy_user_authorization_scope(
  _study_id uuid,
  _site_id uuid default null
)
returns text
language sql
security definer
set search_path = public
stable
as $$
  select case
    when not public.user_has_study_access(_study_id) then 'none'
    when public.pharmacy_study_blinding_model(_study_id, _site_id) = 'open_label' then 'open_label'
    else coalesce(
      (
        select o.study_authorization_scope
        from public.pharmacy_study_authorization_overrides o
        where o.study_id = _study_id
          and o.user_id = auth.uid()
          and o.status = 'active'
          and (o.site_id is not distinct from _site_id or o.site_id is null)
        order by (o.site_id is not null) desc, o.granted_at desc
        limit 1
      ),
      case
        when public.pharmacy_study_blinding_model(_study_id, _site_id) = 'double_blind' then 'blinded'
        else 'blinded'
      end
    )
  end;
$$;

create or replace function public.pharmacy_user_can_access_action(
  _study_id uuid,
  _site_id uuid,
  _action text
)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select
    public.user_has_study_access(_study_id)
    and public.pharmacy_user_has_active_site_membership(_study_id, _site_id)
    and public.pharmacy_user_has_active_delegation(_study_id, _action)
    and public.pharmacy_user_training_satisfied(_study_id, public.pharmacy_training_required(_study_id, _site_id));
$$;

create or replace function public.pharmacy_user_can_view_unblinded_ip(
  _study_id uuid,
  _site_id uuid default null
)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select
    public.pharmacy_user_can_access_action(_study_id, _site_id, 'inventory_review')
    and public.pharmacy_user_authorization_scope(_study_id, _site_id) in (
      'open_label',
      'unblinded',
      'pharmacy_unblinded',
      'sponsor_unblinded'
    );
$$;

alter table public.pharmacy_study_access_config enable row level security;
alter table public.pharmacy_study_authorization_overrides enable row level security;
alter table public.pharmacy_site_memberships enable row level security;

drop policy if exists pharmacy_access_config_select on public.pharmacy_study_access_config;
create policy pharmacy_access_config_select
  on public.pharmacy_study_access_config
  for select using (
    public.user_has_active_organization_membership(organization_id)
    and public.user_has_study_access(study_id)
  );

drop policy if exists pharmacy_access_config_insert on public.pharmacy_study_access_config;
create policy pharmacy_access_config_insert
  on public.pharmacy_study_access_config
  for insert with check (
    public.user_has_active_organization_membership(organization_id)
    and public.user_can_manage_study_roster(study_id)
  );

drop policy if exists pharmacy_access_config_update on public.pharmacy_study_access_config;
create policy pharmacy_access_config_update
  on public.pharmacy_study_access_config
  for update using (
    public.user_has_active_organization_membership(organization_id)
    and public.user_can_manage_study_roster(study_id)
  ) with check (
    public.user_has_active_organization_membership(organization_id)
    and public.user_can_manage_study_roster(study_id)
  );

drop policy if exists pharmacy_auth_override_select on public.pharmacy_study_authorization_overrides;
create policy pharmacy_auth_override_select
  on public.pharmacy_study_authorization_overrides
  for select using (
    public.user_has_active_organization_membership(organization_id)
    and public.user_has_study_access(study_id)
  );

drop policy if exists pharmacy_auth_override_insert on public.pharmacy_study_authorization_overrides;
create policy pharmacy_auth_override_insert
  on public.pharmacy_study_authorization_overrides
  for insert with check (
    public.user_has_active_organization_membership(organization_id)
    and public.user_can_manage_study_roster(study_id)
  );

drop policy if exists pharmacy_auth_override_update on public.pharmacy_study_authorization_overrides;
create policy pharmacy_auth_override_update
  on public.pharmacy_study_authorization_overrides
  for update using (
    public.user_has_active_organization_membership(organization_id)
    and public.user_can_manage_study_roster(study_id)
  ) with check (
    public.user_has_active_organization_membership(organization_id)
    and public.user_can_manage_study_roster(study_id)
  );

drop policy if exists pharmacy_site_memberships_select on public.pharmacy_site_memberships;
create policy pharmacy_site_memberships_select
  on public.pharmacy_site_memberships
  for select using (
    public.user_has_active_organization_membership(organization_id)
    and public.user_has_study_access(study_id)
  );

drop policy if exists pharmacy_site_memberships_insert on public.pharmacy_site_memberships;
create policy pharmacy_site_memberships_insert
  on public.pharmacy_site_memberships
  for insert with check (
    public.user_has_active_organization_membership(organization_id)
    and public.user_can_manage_study_roster(study_id)
  );

drop policy if exists pharmacy_site_memberships_update on public.pharmacy_site_memberships;
create policy pharmacy_site_memberships_update
  on public.pharmacy_site_memberships
  for update using (
    public.user_has_active_organization_membership(organization_id)
    and public.user_can_manage_study_roster(study_id)
  ) with check (
    public.user_has_active_organization_membership(organization_id)
    and public.user_can_manage_study_roster(study_id)
  );

revoke all on function public.pharmacy_delegated_task_labels(text) from public;
revoke all on function public.pharmacy_user_has_active_delegation(uuid, text) from public;
revoke all on function public.pharmacy_user_has_active_site_membership(uuid, uuid) from public;
revoke all on function public.pharmacy_user_training_satisfied(uuid, boolean) from public;
revoke all on function public.pharmacy_study_blinding_model(uuid, uuid) from public;
revoke all on function public.pharmacy_training_required(uuid, uuid) from public;
revoke all on function public.pharmacy_user_authorization_scope(uuid, uuid) from public;
revoke all on function public.pharmacy_user_can_access_action(uuid, uuid, text) from public;
revoke all on function public.pharmacy_user_can_view_unblinded_ip(uuid, uuid) from public;

grant execute on function public.pharmacy_delegated_task_labels(text) to authenticated, anon;
grant execute on function public.pharmacy_user_has_active_delegation(uuid, text) to authenticated, anon;
grant execute on function public.pharmacy_user_has_active_site_membership(uuid, uuid) to authenticated, anon;
grant execute on function public.pharmacy_user_training_satisfied(uuid, boolean) to authenticated, anon;
grant execute on function public.pharmacy_study_blinding_model(uuid, uuid) to authenticated, anon;
grant execute on function public.pharmacy_training_required(uuid, uuid) to authenticated, anon;
grant execute on function public.pharmacy_user_authorization_scope(uuid, uuid) to authenticated, anon;
grant execute on function public.pharmacy_user_can_access_action(uuid, uuid, text) to authenticated, anon;
grant execute on function public.pharmacy_user_can_view_unblinded_ip(uuid, uuid) to authenticated, anon;
