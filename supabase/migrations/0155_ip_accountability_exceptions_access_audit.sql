-- Pharmacy Runtime Phase 1: accountability exception foundation and access audit.

create table if not exists public.ip_accountability_exceptions (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  study_id uuid not null references public.studies(id) on delete cascade,
  site_id uuid null references public.organizations(id) on delete set null,
  blueprint_id uuid not null references public.pharmacy_runtime_blueprints(id) on delete restrict,
  source_receipt_id uuid null references public.ip_receipts(id) on delete restrict,
  source_ledger_event_id uuid null references public.ip_ledger_events(id) on delete restrict,
  exception_type text not null,
  status text not null default 'open',
  summary text not null,
  opened_by uuid not null references auth.users(id) on delete restrict,
  opened_at timestamptz not null default now(),
  resolved_by uuid null references auth.users(id) on delete set null,
  resolved_at timestamptz null,
  closed_by uuid null references auth.users(id) on delete set null,
  closed_at timestamptz null,
  metadata jsonb not null default '{}'::jsonb,
  constraint ip_accountability_exception_status_check check (
    status in ('open', 'investigating', 'resolved', 'closed')
  ),
  constraint ip_accountability_exception_type_required check (length(trim(exception_type)) > 0),
  constraint ip_accountability_exception_summary_required check (length(trim(summary)) > 0),
  constraint ip_accountability_exception_resolved_gate check (
    status not in ('resolved', 'closed')
    or (resolved_by is not null and resolved_at is not null)
  ),
  constraint ip_accountability_exception_closed_gate check (
    status <> 'closed'
    or (closed_by is not null and closed_at is not null)
  ),
  constraint ip_accountability_exception_metadata_object check (jsonb_typeof(metadata) = 'object')
);

create table if not exists public.ip_access_audit (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  study_id uuid not null references public.studies(id) on delete cascade,
  site_id uuid null references public.organizations(id) on delete set null,
  actor_id uuid null references auth.users(id) on delete set null,
  requested_action text not null,
  resource_type text not null,
  resource_id uuid null,
  study_blinding_model text not null,
  study_authorization_scope text not null,
  delegation_log_id uuid null references public.study_delegation_log(id) on delete set null,
  training_status text not null default 'not_evaluated',
  allowed boolean not null,
  reason text not null,
  occurred_at timestamptz not null default now(),
  metadata jsonb not null default '{}'::jsonb,
  constraint ip_access_audit_action_required check (length(trim(requested_action)) > 0),
  constraint ip_access_audit_resource_type_required check (length(trim(resource_type)) > 0),
  constraint ip_access_audit_metadata_object check (jsonb_typeof(metadata) = 'object')
);

create index if not exists ip_accountability_exceptions_study_idx
  on public.ip_accountability_exceptions(study_id);
create index if not exists ip_accountability_exceptions_status_idx
  on public.ip_accountability_exceptions(status);
create index if not exists ip_accountability_exceptions_receipt_idx
  on public.ip_accountability_exceptions(source_receipt_id);
create index if not exists ip_accountability_exceptions_ledger_idx
  on public.ip_accountability_exceptions(source_ledger_event_id);
create index if not exists ip_access_audit_study_idx
  on public.ip_access_audit(study_id, occurred_at desc);
create index if not exists ip_access_audit_actor_idx
  on public.ip_access_audit(actor_id, occurred_at desc);
create index if not exists ip_access_audit_resource_idx
  on public.ip_access_audit(resource_type, resource_id);

create or replace function public.ip_accountability_exception_active_blueprint_gate()
returns trigger
language plpgsql
as $$
begin
  if not public.pharmacy_blueprint_is_active(new.blueprint_id) then
    raise exception 'Cannot create IP accountability exception without active Pharmacy Runtime Blueprint';
  end if;

  if not public.pharmacy_user_can_access_action(new.study_id, new.site_id, 'correction') then
    raise exception 'Delegation/training gate failed for IP accountability exception';
  end if;

  return new;
end;
$$;

drop trigger if exists ip_accountability_exception_active_blueprint_gate
  on public.ip_accountability_exceptions;
create trigger ip_accountability_exception_active_blueprint_gate
before insert on public.ip_accountability_exceptions
for each row execute function public.ip_accountability_exception_active_blueprint_gate();

create or replace function public.ip_access_audit_log(
  _organization_id uuid,
  _study_id uuid,
  _site_id uuid,
  _requested_action text,
  _resource_type text,
  _resource_id uuid,
  _allowed boolean,
  _reason text,
  _metadata jsonb default '{}'::jsonb
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  audit_id uuid;
begin
  insert into public.ip_access_audit (
    organization_id,
    study_id,
    site_id,
    actor_id,
    requested_action,
    resource_type,
    resource_id,
    study_blinding_model,
    study_authorization_scope,
    training_status,
    allowed,
    reason,
    metadata
  )
  values (
    _organization_id,
    _study_id,
    _site_id,
    auth.uid(),
    _requested_action,
    _resource_type,
    _resource_id,
    public.pharmacy_study_blinding_model(_study_id, _site_id),
    public.pharmacy_user_authorization_scope(_study_id, _site_id),
    case
      when public.pharmacy_training_required(_study_id, _site_id) then 'required'
      else 'optional'
    end,
    _allowed,
    _reason,
    coalesce(_metadata, '{}'::jsonb)
  )
  returning id into audit_id;

  return audit_id;
end;
$$;

alter table public.ip_accountability_exceptions enable row level security;
alter table public.ip_access_audit enable row level security;

drop policy if exists ip_accountability_exceptions_select on public.ip_accountability_exceptions;
create policy ip_accountability_exceptions_select
  on public.ip_accountability_exceptions
  for select using (public.pharmacy_user_can_access_action(study_id, site_id, 'correction'));

drop policy if exists ip_accountability_exceptions_insert on public.ip_accountability_exceptions;
create policy ip_accountability_exceptions_insert
  on public.ip_accountability_exceptions
  for insert with check (public.pharmacy_user_can_access_action(study_id, site_id, 'correction'));

drop policy if exists ip_accountability_exceptions_update on public.ip_accountability_exceptions;
create policy ip_accountability_exceptions_update
  on public.ip_accountability_exceptions
  for update using (public.pharmacy_user_can_access_action(study_id, site_id, 'correction'))
  with check (public.pharmacy_user_can_access_action(study_id, site_id, 'correction'));

drop policy if exists ip_access_audit_select on public.ip_access_audit;
create policy ip_access_audit_select
  on public.ip_access_audit
  for select using (
    public.user_has_active_organization_membership(organization_id)
    and public.user_has_study_access(study_id)
  );

drop policy if exists ip_access_audit_insert on public.ip_access_audit;
create policy ip_access_audit_insert
  on public.ip_access_audit
  for insert with check (
    public.user_has_active_organization_membership(organization_id)
    and public.user_has_study_access(study_id)
  );

revoke all on function public.ip_access_audit_log(uuid, uuid, uuid, text, text, uuid, boolean, text, jsonb) from public;
grant execute on function public.ip_access_audit_log(uuid, uuid, uuid, text, text, uuid, boolean, text, jsonb) to authenticated, anon;
