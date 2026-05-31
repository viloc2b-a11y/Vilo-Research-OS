-- Pharmacy Runtime Phase 1: blueprint persistence.
-- Runtime activation follows Document Center -> Document Reader -> Blueprint -> CRC Review -> Activation.

create table if not exists public.pharmacy_runtime_blueprints (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  study_id uuid not null references public.studies(id) on delete cascade,
  site_id uuid null references public.organizations(id) on delete set null,
  source_document_id uuid not null references public.compliance_runtime_documents(id) on delete restrict,
  document_reader_artifact_id uuid not null references public.document_intelligence_documents(id) on delete restrict,
  status text not null default 'generated',
  crc_reviewed_at timestamptz null,
  crc_reviewed_by uuid null references auth.users(id) on delete set null,
  activated_at timestamptz null,
  activated_by uuid null references auth.users(id) on delete set null,
  created_by uuid null references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  metadata jsonb not null default '{}'::jsonb,
  constraint pharmacy_blueprints_status_check check (
    status in ('generated', 'reviewed', 'active', 'inactive')
  ),
  constraint pharmacy_blueprints_review_gate check (
    status not in ('reviewed', 'active')
    or (crc_reviewed_at is not null and crc_reviewed_by is not null)
  ),
  constraint pharmacy_blueprints_activation_gate check (
    status <> 'active'
    or (
      crc_reviewed_at is not null
      and crc_reviewed_by is not null
      and activated_at is not null
      and activated_by is not null
    )
  ),
  constraint pharmacy_blueprints_metadata_object check (jsonb_typeof(metadata) = 'object')
);

create unique index if not exists pharmacy_blueprints_active_unique
  on public.pharmacy_runtime_blueprints(study_id, coalesce(site_id, '00000000-0000-0000-0000-000000000000'::uuid))
  where status = 'active';

create index if not exists pharmacy_blueprints_org_idx
  on public.pharmacy_runtime_blueprints(organization_id);
create index if not exists pharmacy_blueprints_study_idx
  on public.pharmacy_runtime_blueprints(study_id);
create index if not exists pharmacy_blueprints_site_idx
  on public.pharmacy_runtime_blueprints(site_id);
create index if not exists pharmacy_blueprints_source_doc_idx
  on public.pharmacy_runtime_blueprints(source_document_id);
create index if not exists pharmacy_blueprints_reader_artifact_idx
  on public.pharmacy_runtime_blueprints(document_reader_artifact_id);
create index if not exists pharmacy_blueprints_status_idx
  on public.pharmacy_runtime_blueprints(status);

create or replace function public.pharmacy_blueprints_touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists pharmacy_blueprints_touch_updated_at
  on public.pharmacy_runtime_blueprints;
create trigger pharmacy_blueprints_touch_updated_at
before update on public.pharmacy_runtime_blueprints
for each row execute function public.pharmacy_blueprints_touch_updated_at();

create or replace function public.pharmacy_blueprint_is_active(_blueprint_id uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1
    from public.pharmacy_runtime_blueprints b
    where b.id = _blueprint_id
      and b.status = 'active'
      and b.crc_reviewed_at is not null
      and b.activated_at is not null
  );
$$;

alter table public.pharmacy_runtime_blueprints enable row level security;

create policy pharmacy_blueprints_select
  on public.pharmacy_runtime_blueprints
  for select using (
    public.user_has_active_organization_membership(organization_id)
    and public.user_has_study_access(study_id)
    and public.pharmacy_user_can_access_action(study_id, site_id, 'inventory_review')
  );

create policy pharmacy_blueprints_insert
  on public.pharmacy_runtime_blueprints
  for insert with check (
    public.user_has_active_organization_membership(organization_id)
    and public.user_can_manage_study_roster(study_id)
  );

create policy pharmacy_blueprints_update
  on public.pharmacy_runtime_blueprints
  for update using (
    public.user_has_active_organization_membership(organization_id)
    and public.user_can_manage_study_roster(study_id)
  ) with check (
    public.user_has_active_organization_membership(organization_id)
    and public.user_can_manage_study_roster(study_id)
  );

revoke all on function public.pharmacy_blueprint_is_active(uuid) from public;
grant execute on function public.pharmacy_blueprint_is_active(uuid) to authenticated, anon;
