-- Document Intelligence usage domains (per intelligence document)

create table if not exists public.document_intelligence_domains (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  study_id uuid null references public.studies (id) on delete set null,
  intelligence_document_id uuid not null references public.document_intelligence_documents (id) on delete cascade,
  compliance_document_id uuid not null references public.compliance_runtime_documents (id) on delete restrict,
  domain text not null,
  status text not null default 'active',
  created_by uuid null,
  created_at timestamptz not null default now(),
  metadata jsonb not null default '{}'::jsonb,
  constraint document_intelligence_domains_domain_check check (
    domain in (
      'source_creation',
      'budget_analysis',
      'contract_analysis',
      'regulatory_binder',
      'training',
      'delegation',
      'procedure_library',
      'general_library'
    )
  ),
  constraint document_intelligence_domains_status_check check (
    status in ('active', 'inactive', 'archived')
  ),
  constraint document_intelligence_domains_doc_domain_unique unique (intelligence_document_id, domain)
);

create index if not exists document_intelligence_domains_org_idx
  on public.document_intelligence_domains (organization_id);
create index if not exists document_intelligence_domains_study_idx
  on public.document_intelligence_domains (study_id);
create index if not exists document_intelligence_domains_intelligence_doc_idx
  on public.document_intelligence_domains (intelligence_document_id);
create index if not exists document_intelligence_domains_compliance_doc_idx
  on public.document_intelligence_domains (compliance_document_id);
create index if not exists document_intelligence_domains_domain_idx
  on public.document_intelligence_domains (domain);
create index if not exists document_intelligence_domains_status_idx
  on public.document_intelligence_domains (status);

create index if not exists document_intelligence_domains_org_study_idx
  on public.document_intelligence_domains (organization_id, study_id);

create index if not exists document_intelligence_domains_study_domain_active_idx
  on public.document_intelligence_domains (study_id, domain)
  where status = 'active';

create index if not exists document_intelligence_domains_doc_domain_active_idx
  on public.document_intelligence_domains (intelligence_document_id, domain)
  where status = 'active';

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------

alter table public.document_intelligence_domains enable row level security;

create policy document_intelligence_domains_select on public.document_intelligence_domains
  for select using (
    public.user_has_active_organization_membership(organization_id)
    and (study_id is null or public.user_has_study_access(study_id))
  );

create policy document_intelligence_domains_insert on public.document_intelligence_domains
  for insert with check (
    public.user_has_active_organization_membership(organization_id)
    and (study_id is null or public.user_has_study_access(study_id))
  );

create policy document_intelligence_domains_update on public.document_intelligence_domains
  for update using (
    public.user_has_active_organization_membership(organization_id)
    and (study_id is null or public.user_has_study_access(study_id))
  );

-- ---------------------------------------------------------------------------
-- Search RPCs with optional domain filter (EXISTS — no duplicate chunks)
-- ---------------------------------------------------------------------------

create or replace function public.match_document_intelligence_chunks(
  query_embedding vector (1536),
  match_count integer,
  filter_organization_id uuid,
  filter_study_id uuid,
  filter_classification text default null,
  filter_domain text default null
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
    and d.intelligence_status = 'ready'
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
  order by c.embedding <=> query_embedding
  limit greatest(match_count, 1);
$$;

create or replace function public.keyword_search_document_intelligence_chunks(
  search_query text,
  match_count integer,
  filter_organization_id uuid,
  filter_study_id uuid,
  filter_classification text default null,
  filter_domain text default null
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
    and d.intelligence_status = 'ready'
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
      (
        c.clean_chunk_text % search_query
        and similarity(c.clean_chunk_text, search_query) >= 0.3
      )
      or c.clean_chunk_text ilike '%' || search_query || '%'
    )
  order by similarity(c.clean_chunk_text, search_query) desc nulls last
  limit greatest(match_count, 1);
$$;
