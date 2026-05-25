-- Phase 3 — Raw Vault boundary + study alias maps (de-identification at data model level).
-- Raw protocol filenames/paths stay in protocol_raw_documents; runtime uses study_alias_maps only.

-- ---------------------------------------------------------------------------
-- protocol_raw_documents (raw vault — not for runtime display)
-- ---------------------------------------------------------------------------

create table if not exists public.protocol_raw_documents (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  study_id uuid references public.studies (id) on delete set null,
  original_filename text not null,
  storage_path text not null,
  checksum text not null,
  mime_type text,
  status text not null default 'registered'
    check (status in ('registered', 'archived', 'superseded')),
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now()
);

create unique index if not exists protocol_raw_documents_storage_path_key
  on public.protocol_raw_documents (organization_id, storage_path);

create index if not exists protocol_raw_documents_organization_id_idx
  on public.protocol_raw_documents (organization_id);

create index if not exists protocol_raw_documents_study_id_idx
  on public.protocol_raw_documents (study_id)
  where study_id is not null;

create index if not exists protocol_raw_documents_created_at_idx
  on public.protocol_raw_documents (organization_id, created_at desc);

comment on table public.protocol_raw_documents is
  'Raw protocol document registry (vault). original_filename and storage_path are vault-only — never surface in runtime UI.';

comment on column public.protocol_raw_documents.original_filename is
  'Vault-only: commercial protocol filename. Do not expose outside protocol-vault modules.';

comment on column public.protocol_raw_documents.storage_path is
  'Vault-only: storage locator. Do not expose outside protocol-vault modules.';

-- ---------------------------------------------------------------------------
-- study_alias_maps (sanitized tokens for runtime / publish / source builder)
-- ---------------------------------------------------------------------------

create table if not exists public.study_alias_maps (
  id uuid primary key default gen_random_uuid(),
  study_id uuid not null references public.studies (id) on delete cascade,
  raw_token text not null,
  token_type text not null
    check (token_type in (
      'protocol_number',
      'sponsor',
      'compound',
      'study_code',
      'filename',
      'other'
    )),
  safe_alias text not null,
  source text not null default 'manual'
    check (source in ('manual', 'intake', 'migration', 'inferred')),
  confidence numeric(4, 3)
    check (confidence is null or (confidence >= 0 and confidence <= 1)),
  approved_by uuid references auth.users (id) on delete set null,
  approved_at timestamptz,
  created_at timestamptz not null default now()
);

create unique index if not exists study_alias_maps_study_token_type_key
  on public.study_alias_maps (study_id, raw_token, token_type);

create index if not exists study_alias_maps_study_id_idx
  on public.study_alias_maps (study_id);

create index if not exists study_alias_maps_token_type_idx
  on public.study_alias_maps (study_id, token_type);

comment on table public.study_alias_maps is
  'Per-study mapping from raw commercial protocol tokens to safe runtime aliases.';

-- ---------------------------------------------------------------------------
-- RLS (minimal — org / study membership; no column masking)
-- ---------------------------------------------------------------------------

alter table public.protocol_raw_documents enable row level security;
alter table public.study_alias_maps enable row level security;

drop policy if exists protocol_raw_documents_select on public.protocol_raw_documents;
drop policy if exists protocol_raw_documents_insert on public.protocol_raw_documents;
drop policy if exists protocol_raw_documents_update on public.protocol_raw_documents;
drop policy if exists study_alias_maps_select on public.study_alias_maps;
drop policy if exists study_alias_maps_insert on public.study_alias_maps;
drop policy if exists study_alias_maps_update on public.study_alias_maps;

create policy protocol_raw_documents_select on public.protocol_raw_documents
for select using (
  public.user_has_active_organization_membership(organization_id)
  and (
    study_id is null
    or public.user_has_study_access(study_id)
  )
);

create policy protocol_raw_documents_insert on public.protocol_raw_documents
for insert with check (
  public.user_has_active_organization_membership(organization_id)
  and (
    study_id is null
    or public.user_has_study_access(study_id)
  )
);

create policy protocol_raw_documents_update on public.protocol_raw_documents
for update using (
  public.user_has_active_organization_membership(organization_id)
  and (
    study_id is null
    or public.user_has_study_access(study_id)
  )
) with check (
  public.user_has_active_organization_membership(organization_id)
  and (
    study_id is null
    or public.user_has_study_access(study_id)
  )
);

create policy study_alias_maps_select on public.study_alias_maps
for select using (
  public.user_has_study_access(study_id)
);

create policy study_alias_maps_insert on public.study_alias_maps
for insert with check (
  public.user_has_study_access(study_id)
);

create policy study_alias_maps_update on public.study_alias_maps
for update using (
  public.user_has_study_access(study_id)
) with check (
  public.user_has_study_access(study_id)
);
