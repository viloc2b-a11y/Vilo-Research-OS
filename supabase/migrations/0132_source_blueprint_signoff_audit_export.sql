-- K4: Formal sign-off + audit export for evidence-backed drafting.
-- Sign-off and audit packages are review artifacts only. They never mutate runtime or published source.

create table if not exists public.source_blueprint_draft_signoffs (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  study_id uuid not null references public.studies (id) on delete cascade,
  signoff_status text not null default 'signed',
  signoff_statement text not null,
  suggestion_ids uuid[] not null default '{}'::uuid[],
  evidence_ids uuid[] not null default '{}'::uuid[],
  signoff_snapshot jsonb not null default '{}'::jsonb,
  signed_by uuid null references auth.users (id) on delete set null,
  signed_at timestamptz not null default now(),
  voided_by uuid null references auth.users (id) on delete set null,
  voided_at timestamptz null,
  void_reason text null,
  metadata jsonb not null default '{}'::jsonb,
  constraint source_blueprint_draft_signoffs_status_check check (
    signoff_status in ('signed', 'voided')
  ),
  constraint source_blueprint_draft_signoffs_statement_length check (
    length(trim(signoff_statement)) >= 10
  ),
  constraint source_blueprint_draft_signoffs_snapshot_object check (
    jsonb_typeof(signoff_snapshot) = 'object'
  ),
  constraint source_blueprint_draft_signoffs_metadata_object check (
    jsonb_typeof(metadata) = 'object'
  )
);

create index if not exists source_blueprint_draft_signoffs_org_idx
  on public.source_blueprint_draft_signoffs (organization_id);
create index if not exists source_blueprint_draft_signoffs_study_idx
  on public.source_blueprint_draft_signoffs (study_id);
create index if not exists source_blueprint_draft_signoffs_status_idx
  on public.source_blueprint_draft_signoffs (signoff_status);
create index if not exists source_blueprint_draft_signoffs_signed_at_idx
  on public.source_blueprint_draft_signoffs (signed_at);

create table if not exists public.source_blueprint_audit_exports (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  study_id uuid not null references public.studies (id) on delete cascade,
  signoff_id uuid not null references public.source_blueprint_draft_signoffs (id) on delete restrict,
  package_json jsonb not null default '{}'::jsonb,
  package_hash text not null,
  generated_by uuid null references auth.users (id) on delete set null,
  generated_at timestamptz not null default now(),
  metadata jsonb not null default '{}'::jsonb,
  constraint source_blueprint_audit_exports_package_object check (
    jsonb_typeof(package_json) = 'object'
  ),
  constraint source_blueprint_audit_exports_metadata_object check (
    jsonb_typeof(metadata) = 'object'
  ),
  constraint source_blueprint_audit_exports_unique_hash unique (organization_id, study_id, package_hash)
);

create index if not exists source_blueprint_audit_exports_org_idx
  on public.source_blueprint_audit_exports (organization_id);
create index if not exists source_blueprint_audit_exports_study_idx
  on public.source_blueprint_audit_exports (study_id);
create index if not exists source_blueprint_audit_exports_signoff_idx
  on public.source_blueprint_audit_exports (signoff_id);
create index if not exists source_blueprint_audit_exports_generated_at_idx
  on public.source_blueprint_audit_exports (generated_at);

create or replace function public.source_blueprint_audit_exports_deny_mutation()
returns trigger
language plpgsql
as $$
begin
  raise exception 'source_blueprint_audit_exports is append-only';
end;
$$;

drop trigger if exists source_blueprint_audit_exports_deny_update
  on public.source_blueprint_audit_exports;
create trigger source_blueprint_audit_exports_deny_update
before update or delete on public.source_blueprint_audit_exports
for each row execute function public.source_blueprint_audit_exports_deny_mutation();

alter table public.source_blueprint_draft_signoffs enable row level security;
alter table public.source_blueprint_audit_exports enable row level security;

drop policy if exists source_blueprint_draft_signoffs_select on public.source_blueprint_draft_signoffs;
create policy source_blueprint_draft_signoffs_select
  on public.source_blueprint_draft_signoffs
  for select using (
    public.user_has_active_organization_membership(organization_id)
    and public.user_has_study_access(study_id)
  );

drop policy if exists source_blueprint_draft_signoffs_insert on public.source_blueprint_draft_signoffs;
create policy source_blueprint_draft_signoffs_insert
  on public.source_blueprint_draft_signoffs
  for insert with check (
    public.user_has_active_organization_membership(organization_id)
    and public.user_has_study_access(study_id)
  );

drop policy if exists source_blueprint_draft_signoffs_update on public.source_blueprint_draft_signoffs;
create policy source_blueprint_draft_signoffs_update
  on public.source_blueprint_draft_signoffs
  for update using (
    public.user_has_active_organization_membership(organization_id)
    and public.user_has_study_access(study_id)
  );

drop policy if exists source_blueprint_audit_exports_select on public.source_blueprint_audit_exports;
create policy source_blueprint_audit_exports_select
  on public.source_blueprint_audit_exports
  for select using (
    public.user_has_active_organization_membership(organization_id)
    and public.user_has_study_access(study_id)
  );

drop policy if exists source_blueprint_audit_exports_insert on public.source_blueprint_audit_exports;
create policy source_blueprint_audit_exports_insert
  on public.source_blueprint_audit_exports
  for insert with check (
    public.user_has_active_organization_membership(organization_id)
    and public.user_has_study_access(study_id)
  );
