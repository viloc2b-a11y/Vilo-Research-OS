-- Production ingest safeguards: PHI quarantine gate + classification metadata + audit

-- ---------------------------------------------------------------------------
-- document_intelligence_documents — quarantine + classification fields
-- ---------------------------------------------------------------------------

alter table public.document_intelligence_documents
  drop constraint if exists document_intelligence_documents_intelligence_status_check;

alter table public.document_intelligence_documents
  add column if not exists quarantine_reason jsonb not null default '{}'::jsonb,
  add column if not exists classification_metadata jsonb not null default '{}'::jsonb,
  add column if not exists phi_override_by uuid null references auth.users (id) on delete set null,
  add column if not exists phi_override_at timestamptz null,
  add column if not exists phi_override_notes text null;

alter table public.document_intelligence_documents
  add constraint document_intelligence_documents_intelligence_status_check check (
    intelligence_status in (
      'pending',
      'ready',
      'failed',
      'archived',
      'superseded',
      'quarantine'
    )
  );

alter table public.document_intelligence_documents
  add constraint document_intelligence_documents_quarantine_reason_object check (
    jsonb_typeof (quarantine_reason) = 'object'
  );

alter table public.document_intelligence_documents
  add constraint document_intelligence_documents_classification_metadata_object check (
    jsonb_typeof (classification_metadata) = 'object'
  );

create index if not exists document_intelligence_documents_quarantine_idx
  on public.document_intelligence_documents (intelligence_status)
  where intelligence_status = 'quarantine';

-- ---------------------------------------------------------------------------
-- document_intelligence_phi_override_events (append-only audit)
-- ---------------------------------------------------------------------------

create table if not exists public.document_intelligence_phi_override_events (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  study_id uuid not null references public.studies (id) on delete cascade,
  intelligence_document_id uuid not null references public.document_intelligence_documents (id) on delete cascade,
  actor_id uuid null references auth.users (id) on delete set null,
  override_notes text not null,
  event_timestamp timestamptz not null default now(),
  event_payload jsonb not null default '{}'::jsonb,
  metadata jsonb not null default '{}'::jsonb
);

create index if not exists document_intelligence_phi_override_events_doc_idx
  on public.document_intelligence_phi_override_events (intelligence_document_id);

alter table public.document_intelligence_phi_override_events enable row level security;

create policy document_intelligence_phi_override_events_select
  on public.document_intelligence_phi_override_events
  for select using (
    public.user_has_active_organization_membership(organization_id)
    and public.user_has_study_access(study_id)
  );

create policy document_intelligence_phi_override_events_insert
  on public.document_intelligence_phi_override_events
  for insert with check (
    public.user_has_active_organization_membership(organization_id)
    and public.user_has_study_access(study_id)
  );

create or replace function public.document_intelligence_phi_override_events_deny_mutation()
returns trigger
language plpgsql
as $$
begin
  raise exception 'document_intelligence_phi_override_events is append-only';
end;
$$;

drop trigger if exists document_intelligence_phi_override_events_deny_update
  on public.document_intelligence_phi_override_events;
create trigger document_intelligence_phi_override_events_deny_update
before update or delete on public.document_intelligence_phi_override_events
for each row execute function public.document_intelligence_phi_override_events_deny_mutation();

-- ---------------------------------------------------------------------------
-- Search RPCs: never return quarantined documents
-- ---------------------------------------------------------------------------

create or replace function public.match_document_intelligence_chunks(
  query_embedding vector (1536),
  match_count integer,
  filter_organization_id uuid,
  filter_study_id uuid,
  filter_classification text default null,
  filter_domain text default null,
  filter_include_superseded boolean default false
)
returns table (
  chunk_id uuid,
  intelligence_document_id uuid,
  compliance_document_id uuid,
  source_filename text,
  section_title text,
  page_number integer,
  clean_chunk_text text,
  similarity double precision
)
language sql
stable
as $$
  select
    c.id as chunk_id,
    c.intelligence_document_id,
    c.compliance_document_id,
    d.source_filename,
    c.section_title,
    c.page_number,
    c.clean_chunk_text,
    1 - (c.embedding <=> query_embedding) as similarity
  from public.document_intelligence_chunks c
  inner join public.document_intelligence_documents d on d.id = c.intelligence_document_id
  where c.organization_id = filter_organization_id
    and c.study_id = filter_study_id
    and c.embedding is not null
    and c.embedding_status = 'embedded'
    and d.intelligence_status in ('ready', 'superseded', 'archived')
    and d.intelligence_status <> 'quarantine'
    and (filter_classification is null or d.document_classification = filter_classification)
    and (
      filter_domain is null
      or exists (
        select 1
        from public.document_intelligence_domains dom
        where dom.intelligence_document_id = c.intelligence_document_id
          and dom.domain = filter_domain
          and dom.status = 'active'
      )
    )
    and (
      filter_include_superseded = true
      or exists (
        select 1
        from public.document_intelligence_active_references ar
        where ar.intelligence_document_id = d.id
          and ar.organization_id = filter_organization_id
          and ar.study_id = filter_study_id
          and (
            filter_domain is null
            or ar.domain = filter_domain
          )
      )
    )
  order by c.embedding <=> query_embedding
  limit greatest(match_count, 1);
$$;

create or replace function public.keyword_search_document_intelligence_chunks(
  search_query text,
  match_count integer,
  filter_organization_id uuid,
  filter_study_id uuid,
  filter_classification text default null,
  filter_domain text default null,
  filter_include_superseded boolean default false
)
returns table (
  chunk_id uuid,
  intelligence_document_id uuid,
  compliance_document_id uuid,
  source_filename text,
  section_title text,
  page_number integer,
  clean_chunk_text text,
  similarity double precision
)
language sql
stable
as $$
  select
    c.id as chunk_id,
    c.intelligence_document_id,
    c.compliance_document_id,
    d.source_filename,
    c.section_title,
    c.page_number,
    c.clean_chunk_text,
    similarity(c.clean_chunk_text, search_query) as similarity
  from public.document_intelligence_chunks c
  inner join public.document_intelligence_documents d on d.id = c.intelligence_document_id
  where c.organization_id = filter_organization_id
    and c.study_id = filter_study_id
    and d.intelligence_status in ('ready', 'superseded', 'archived')
    and d.intelligence_status <> 'quarantine'
    and (filter_classification is null or d.document_classification = filter_classification)
    and search_query is not null
    and length(trim(search_query)) > 0
    and (
      filter_domain is null
      or exists (
        select 1
        from public.document_intelligence_domains dom
        where dom.intelligence_document_id = c.intelligence_document_id
          and dom.domain = filter_domain
          and dom.status = 'active'
      )
    )
    and (
      filter_include_superseded = true
      or exists (
        select 1
        from public.document_intelligence_active_references ar
        where ar.intelligence_document_id = d.id
          and ar.organization_id = filter_organization_id
          and ar.study_id = filter_study_id
          and (
            filter_domain is null
            or ar.domain = filter_domain
          )
      )
    )
    and (
      (
        c.clean_chunk_text % search_query
        and similarity(c.clean_chunk_text, search_query) >= 0.3
      )
      or c.clean_chunk_text ilike '%' || search_query || '%'
    )
  order by similarity(c.clean_chunk_text, search_query) desc nulls last
  limit greatest(match_count, 1);
$$;
