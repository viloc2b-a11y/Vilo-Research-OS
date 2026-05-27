-- K1: Document Intelligence Ingestion Foundation

create extension if not exists vector;
create extension if not exists pg_trgm;

-- ---------------------------------------------------------------------------
-- document_intelligence_documents
-- ---------------------------------------------------------------------------

create table if not exists public.document_intelligence_documents (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  study_id uuid null references public.studies (id) on delete set null,
  compliance_document_id uuid not null references public.compliance_runtime_documents (id) on delete restrict,
  document_classification text not null,
  intelligence_status text not null default 'pending',
  extraction_status text not null default 'pending',
  embedding_status text not null default 'pending',
  source_hash text not null,
  source_filename text not null,
  source_mime_type text not null,
  language text null default 'en',
  effective_date date null,
  version_label text null,
  supersedes_intelligence_document_id uuid null references public.document_intelligence_documents (id) on delete set null,
  metadata jsonb not null default '{}'::jsonb,
  created_by uuid null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint document_intelligence_documents_intelligence_status_check check (
    intelligence_status in ('pending', 'ready', 'failed', 'archived', 'superseded')
  ),
  constraint document_intelligence_documents_extraction_status_check check (
    extraction_status in ('pending', 'extracting', 'extracted', 'failed', 'unsupported')
  ),
  constraint document_intelligence_documents_embedding_status_check check (
    embedding_status in ('pending', 'embedding', 'embedded', 'failed', 'unsupported', 'skipped')
  ),
  constraint document_intelligence_documents_compliance_hash_unique unique (compliance_document_id, source_hash)
);

create index if not exists document_intelligence_documents_org_idx
  on public.document_intelligence_documents (organization_id);
create index if not exists document_intelligence_documents_study_idx
  on public.document_intelligence_documents (study_id);
create index if not exists document_intelligence_documents_compliance_idx
  on public.document_intelligence_documents (compliance_document_id);
create index if not exists document_intelligence_documents_class_idx
  on public.document_intelligence_documents (document_classification);
create index if not exists document_intelligence_documents_intelligence_status_idx
  on public.document_intelligence_documents (intelligence_status);
create index if not exists document_intelligence_documents_extraction_status_idx
  on public.document_intelligence_documents (extraction_status);
create index if not exists document_intelligence_documents_embedding_status_idx
  on public.document_intelligence_documents (embedding_status);
create index if not exists document_intelligence_documents_source_hash_idx
  on public.document_intelligence_documents (source_hash);

drop trigger if exists document_intelligence_documents_set_updated_at
  on public.document_intelligence_documents;
create trigger document_intelligence_documents_set_updated_at
before update on public.document_intelligence_documents
for each row execute function public.generic_set_updated_at();

-- ---------------------------------------------------------------------------
-- document_intelligence_chunks
-- ---------------------------------------------------------------------------

create table if not exists public.document_intelligence_chunks (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  study_id uuid null references public.studies (id) on delete set null,
  intelligence_document_id uuid not null references public.document_intelligence_documents (id) on delete cascade,
  compliance_document_id uuid not null references public.compliance_runtime_documents (id) on delete restrict,
  chunk_index integer not null,
  chunk_text text not null,
  clean_chunk_text text not null,
  chunk_hash text not null,
  token_estimate integer null,
  page_number integer null,
  section_code text null,
  section_title text null,
  chunk_type text not null default 'text',
  embedding vector (1536) null,
  embedding_model text null,
  embedding_status text not null default 'pending',
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  constraint document_intelligence_chunks_chunk_type_check check (
    chunk_type in ('text', 'table', 'heading', 'section', 'note')
  ),
  constraint document_intelligence_chunks_embedding_status_check check (
    embedding_status in ('pending', 'embedded', 'failed', 'skipped')
  ),
  constraint document_intelligence_chunks_doc_index_unique unique (intelligence_document_id, chunk_index),
  constraint document_intelligence_chunks_doc_hash_unique unique (intelligence_document_id, chunk_hash)
);

create index if not exists document_intelligence_chunks_org_idx
  on public.document_intelligence_chunks (organization_id);
create index if not exists document_intelligence_chunks_study_idx
  on public.document_intelligence_chunks (study_id);
create index if not exists document_intelligence_chunks_intelligence_doc_idx
  on public.document_intelligence_chunks (intelligence_document_id);
create index if not exists document_intelligence_chunks_compliance_doc_idx
  on public.document_intelligence_chunks (compliance_document_id);
create index if not exists document_intelligence_chunks_chunk_index_idx
  on public.document_intelligence_chunks (chunk_index);
create index if not exists document_intelligence_chunks_chunk_hash_idx
  on public.document_intelligence_chunks (chunk_hash);
create index if not exists document_intelligence_chunks_embedding_status_idx
  on public.document_intelligence_chunks (embedding_status);
create index if not exists document_intelligence_chunks_section_title_idx
  on public.document_intelligence_chunks (section_title);

create index if not exists document_intelligence_chunks_embedding_idx
  on public.document_intelligence_chunks
  using hnsw (embedding vector_cosine_ops)
  with (m = 16, ef_construction = 64);

create index if not exists document_intelligence_chunks_trgm_idx
  on public.document_intelligence_chunks
  using gin (clean_chunk_text gin_trgm_ops);

-- ---------------------------------------------------------------------------
-- document_intelligence_ingestion_runs
-- ---------------------------------------------------------------------------

create table if not exists public.document_intelligence_ingestion_runs (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  study_id uuid null references public.studies (id) on delete set null,
  intelligence_document_id uuid null references public.document_intelligence_documents (id) on delete set null,
  compliance_document_id uuid not null references public.compliance_runtime_documents (id) on delete restrict,
  run_status text not null default 'started',
  started_by uuid null,
  started_at timestamptz not null default now(),
  completed_at timestamptz null,
  extracted_chunk_count integer not null default 0,
  embedded_chunk_count integer not null default 0,
  failed_chunk_count integer not null default 0,
  error_message text null,
  metadata jsonb not null default '{}'::jsonb,
  constraint document_intelligence_ingestion_runs_status_check check (
    run_status in ('started', 'completed', 'failed', 'partial', 'unsupported')
  )
);

create index if not exists document_intelligence_ingestion_runs_org_idx
  on public.document_intelligence_ingestion_runs (organization_id);
create index if not exists document_intelligence_ingestion_runs_study_idx
  on public.document_intelligence_ingestion_runs (study_id);
create index if not exists document_intelligence_ingestion_runs_intelligence_doc_idx
  on public.document_intelligence_ingestion_runs (intelligence_document_id);
create index if not exists document_intelligence_ingestion_runs_compliance_doc_idx
  on public.document_intelligence_ingestion_runs (compliance_document_id);
create index if not exists document_intelligence_ingestion_runs_status_idx
  on public.document_intelligence_ingestion_runs (run_status);
create index if not exists document_intelligence_ingestion_runs_started_at_idx
  on public.document_intelligence_ingestion_runs (started_at);

-- ---------------------------------------------------------------------------
-- document_intelligence_search_events (append-only)
-- ---------------------------------------------------------------------------

create table if not exists public.document_intelligence_search_events (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  study_id uuid null references public.studies (id) on delete set null,
  user_id uuid null,
  query_text_hash text not null,
  query_scope jsonb not null default '{}'::jsonb,
  result_chunk_ids uuid[] not null default '{}',
  result_count integer not null default 0,
  created_at timestamptz not null default now(),
  metadata jsonb not null default '{}'::jsonb
);

create index if not exists document_intelligence_search_events_org_idx
  on public.document_intelligence_search_events (organization_id);
create index if not exists document_intelligence_search_events_study_idx
  on public.document_intelligence_search_events (study_id);
create index if not exists document_intelligence_search_events_hash_idx
  on public.document_intelligence_search_events (query_text_hash);
create index if not exists document_intelligence_search_events_created_at_idx
  on public.document_intelligence_search_events (created_at);

-- ---------------------------------------------------------------------------
-- Search helpers (org/study filtered inside function)
-- ---------------------------------------------------------------------------

create or replace function public.match_document_intelligence_chunks(
  query_embedding vector (1536),
  match_count integer,
  filter_organization_id uuid,
  filter_study_id uuid,
  filter_classification text default null
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
    and (filter_study_id is null or c.study_id = filter_study_id)
    and c.embedding is not null
    and c.embedding_status = 'embedded'
    and d.intelligence_status = 'ready'
    and (filter_classification is null or d.document_classification = filter_classification)
  order by c.embedding <=> query_embedding
  limit greatest(match_count, 1);
$$;

create or replace function public.keyword_search_document_intelligence_chunks(
  search_query text,
  match_count integer,
  filter_organization_id uuid,
  filter_study_id uuid,
  filter_classification text default null
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
    and (filter_study_id is null or c.study_id = filter_study_id)
    and d.intelligence_status = 'ready'
    and (filter_classification is null or d.document_classification = filter_classification)
    and (
      c.clean_chunk_text ilike '%' || search_query || '%'
      or c.clean_chunk_text % search_query
    )
  order by similarity(c.clean_chunk_text, search_query) desc nulls last
  limit greatest(match_count, 1);
$$;

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------

alter table public.document_intelligence_documents enable row level security;
alter table public.document_intelligence_chunks enable row level security;
alter table public.document_intelligence_ingestion_runs enable row level security;
alter table public.document_intelligence_search_events enable row level security;

create policy document_intelligence_documents_select on public.document_intelligence_documents
  for select using (
    public.user_has_active_organization_membership(organization_id)
    and (study_id is null or public.user_has_study_access(study_id))
  );

create policy document_intelligence_documents_insert on public.document_intelligence_documents
  for insert with check (
    public.user_has_active_organization_membership(organization_id)
    and (study_id is null or public.user_has_study_access(study_id))
  );

create policy document_intelligence_documents_update on public.document_intelligence_documents
  for update using (
    public.user_has_active_organization_membership(organization_id)
    and (study_id is null or public.user_has_study_access(study_id))
  );

create policy document_intelligence_chunks_select on public.document_intelligence_chunks
  for select using (
    public.user_has_active_organization_membership(organization_id)
    and (study_id is null or public.user_has_study_access(study_id))
  );

create policy document_intelligence_chunks_insert on public.document_intelligence_chunks
  for insert with check (
    public.user_has_active_organization_membership(organization_id)
    and (study_id is null or public.user_has_study_access(study_id))
  );

create policy document_intelligence_chunks_update on public.document_intelligence_chunks
  for update using (
    public.user_has_active_organization_membership(organization_id)
    and (study_id is null or public.user_has_study_access(study_id))
  );

create policy document_intelligence_ingestion_runs_select on public.document_intelligence_ingestion_runs
  for select using (
    public.user_has_active_organization_membership(organization_id)
    and (study_id is null or public.user_has_study_access(study_id))
  );

create policy document_intelligence_ingestion_runs_insert on public.document_intelligence_ingestion_runs
  for insert with check (
    public.user_has_active_organization_membership(organization_id)
    and (study_id is null or public.user_has_study_access(study_id))
  );

create policy document_intelligence_ingestion_runs_update on public.document_intelligence_ingestion_runs
  for update using (
    public.user_has_active_organization_membership(organization_id)
    and (study_id is null or public.user_has_study_access(study_id))
  );

create policy document_intelligence_search_events_select on public.document_intelligence_search_events
  for select using (
    public.user_has_active_organization_membership(organization_id)
    and (study_id is null or public.user_has_study_access(study_id))
  );

create policy document_intelligence_search_events_insert on public.document_intelligence_search_events
  for insert with check (
    public.user_has_active_organization_membership(organization_id)
    and (study_id is null or public.user_has_study_access(study_id))
  );
