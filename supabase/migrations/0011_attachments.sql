-- Phase 2: attachments — file metadata linked to study entities (storage policies later in Phase 2b)

create table if not exists public.attachments (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  study_id uuid not null references public.studies (id) on delete cascade,
  entity_type text not null
    check (entity_type in ('study', 'study_subject', 'visit', 'procedure_execution')),
  entity_id uuid not null,
  storage_bucket text not null,
  storage_path text not null,
  file_name text not null,
  mime_type text,
  size_bytes bigint,
  uploaded_by_user_id uuid references auth.users (id),
  created_at timestamptz not null default now()
);

create index if not exists attachments_study_id_idx on public.attachments (study_id);
create index if not exists attachments_organization_id_idx on public.attachments (organization_id);
create index if not exists attachments_entity_idx on public.attachments (entity_type, entity_id);

drop trigger if exists attachments_enforce_org on public.attachments;
create trigger attachments_enforce_org
before insert or update of organization_id, study_id on public.attachments
for each row execute function public.enforce_row_study_organization_consistency();

alter table public.attachments enable row level security;

drop policy if exists attachments_select on public.attachments;
create policy attachments_select on public.attachments
for select using (
  organization_id in (select public.user_organization_ids())
  and (
    public.user_is_org_admin(organization_id)
    or public.user_has_study_access(study_id)
  )
);

drop policy if exists attachments_insert on public.attachments;
create policy attachments_insert on public.attachments
for insert with check (
  organization_id in (select public.user_organization_ids())
  and public.user_can_manage_subject_enrollment(study_id)
);

drop policy if exists attachments_delete on public.attachments;
create policy attachments_delete on public.attachments
for delete using (
  organization_id in (select public.user_organization_ids())
  and (
    public.user_is_org_admin(organization_id)
    or public.user_is_study_admin(study_id)
  )
);

-- No UPDATE policy for authenticated roles (immutable metadata in MVP; corrections via delete + re-upload).
comment on table public.attachments is
  'Storage bucket RLS must align with organization/study membership (Phase 2b).';
