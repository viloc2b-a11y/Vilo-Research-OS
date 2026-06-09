-- Document Intelligence: coordinator-controlled active reference versions per family + study + domain

-- ---------------------------------------------------------------------------
-- document_intelligence_documents — version family columns
-- ---------------------------------------------------------------------------

alter table public.document_intelligence_documents
  add column if not exists document_family_id uuid null,
  add column if not exists version_number integer not null default 1,
  add column if not exists superseded_by_document_id uuid null references public.document_intelligence_documents (id) on delete set null,
  add column if not exists superseded_reason text null,
  add column if not exists effective_from timestamptz null,
  add column if not exists effective_to timestamptz null,
  add column if not exists active_reference_set_by uuid null references auth.users (id) on delete set null,
  add column if not exists active_reference_set_at timestamptz null,
  add column if not exists active_reference_reason text null;

create index if not exists document_intelligence_documents_family_idx
  on public.document_intelligence_documents (document_family_id);
create index if not exists document_intelligence_documents_family_study_idx
  on public.document_intelligence_documents (document_family_id, study_id);

-- Backfill families: one family per compliance document + study
update public.document_intelligence_documents d
set document_family_id = f.family_id
from (
  select
    compliance_document_id,
    study_id,
    gen_random_uuid() as family_id
  from public.document_intelligence_documents
  where study_id is not null
  group by compliance_document_id, study_id
) f
where d.compliance_document_id = f.compliance_document_id
  and d.study_id = f.study_id
  and d.document_family_id is null;

update public.document_intelligence_documents
set document_family_id = id
where document_family_id is null;

alter table public.document_intelligence_documents
  alter column document_family_id set not null;

-- Version numbers within family (stable ordering by created_at)
with ranked as (
  select
    id,
    row_number() over (
      partition by document_family_id, study_id
      order by created_at asc, id asc
    ) as vn
  from public.document_intelligence_documents
  where study_id is not null
)
update public.document_intelligence_documents d
set version_number = ranked.vn
from ranked
where d.id = ranked.id;

-- ---------------------------------------------------------------------------
-- document_intelligence_active_references (one active doc per family + study + domain)
-- ---------------------------------------------------------------------------

create table if not exists public.document_intelligence_active_references (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  study_id uuid not null references public.studies (id) on delete cascade,
  document_family_id uuid not null,
  domain text not null,
  intelligence_document_id uuid not null references public.document_intelligence_documents (id) on delete cascade,
  active_reference_set_by uuid null references auth.users (id) on delete set null,
  active_reference_set_at timestamptz not null default now(),
  active_reference_reason text null,
  metadata jsonb not null default '{}'::jsonb,
  constraint document_intelligence_active_references_domain_check check (
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
  )
);

alter table public.document_intelligence_active_references
  drop constraint if exists document_intelligence_active_references_family_study_domain_unique;

alter table public.document_intelligence_active_references
  add constraint document_intelligence_active_references_family_study_domain_unique unique (
    document_family_id,
    study_id,
    domain
  );

create index if not exists document_intelligence_active_references_org_idx
  on public.document_intelligence_active_references (organization_id);
create index if not exists document_intelligence_active_references_study_idx
  on public.document_intelligence_active_references (study_id);
create index if not exists document_intelligence_active_references_family_idx
  on public.document_intelligence_active_references (document_family_id);
create index if not exists document_intelligence_active_references_doc_idx
  on public.document_intelligence_active_references (intelligence_document_id);

-- ---------------------------------------------------------------------------
-- document_intelligence_active_reference_events (append-only audit)
-- ---------------------------------------------------------------------------

create table if not exists public.document_intelligence_active_reference_events (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  study_id uuid not null references public.studies (id) on delete cascade,
  document_family_id uuid not null,
  domain text not null,
  previous_intelligence_document_id uuid null references public.document_intelligence_documents (id) on delete set null,
  new_intelligence_document_id uuid not null references public.document_intelligence_documents (id) on delete cascade,
  actor_id uuid null references auth.users (id) on delete set null,
  event_timestamp timestamptz not null default now(),
  reason text null,
  event_payload jsonb not null default '{}'::jsonb,
  metadata jsonb not null default '{}'::jsonb
);

create index if not exists document_intelligence_active_reference_events_family_idx
  on public.document_intelligence_active_reference_events (document_family_id, study_id);

create or replace function public.document_intelligence_active_reference_events_deny_mutation()
returns trigger
language plpgsql
as $$
begin
  raise exception 'document_intelligence_active_reference_events is append-only';
end;
$$;

drop trigger if exists document_intelligence_active_reference_events_deny_update
  on public.document_intelligence_active_reference_events;
create trigger document_intelligence_active_reference_events_deny_update
before update or delete on public.document_intelligence_active_reference_events
for each row execute function public.document_intelligence_active_reference_events_deny_mutation();

-- ---------------------------------------------------------------------------
-- RLS (K1 pattern)
-- ---------------------------------------------------------------------------

alter table public.document_intelligence_active_references enable row level security;
alter table public.document_intelligence_active_reference_events enable row level security;

drop policy if exists document_intelligence_active_references_select on public.document_intelligence_active_references;
create policy document_intelligence_active_references_select
  on public.document_intelligence_active_references
  for select using (
    public.user_has_active_organization_membership(organization_id)
    and public.user_has_study_access(study_id)
  );

drop policy if exists document_intelligence_active_references_insert on public.document_intelligence_active_references;
create policy document_intelligence_active_references_insert
  on public.document_intelligence_active_references
  for insert with check (
    public.user_has_active_organization_membership(organization_id)
    and public.user_has_study_access(study_id)
  );

drop policy if exists document_intelligence_active_references_update on public.document_intelligence_active_references;
create policy document_intelligence_active_references_update
  on public.document_intelligence_active_references
  for update using (
    public.user_has_active_organization_membership(organization_id)
    and public.user_has_study_access(study_id)
  );

drop policy if exists document_intelligence_active_references_delete on public.document_intelligence_active_references;
create policy document_intelligence_active_references_delete
  on public.document_intelligence_active_references
  for delete using (
    public.user_has_active_organization_membership(organization_id)
    and public.user_has_study_access(study_id)
  );

drop policy if exists document_intelligence_active_reference_events_select on public.document_intelligence_active_reference_events;
create policy document_intelligence_active_reference_events_select
  on public.document_intelligence_active_reference_events
  for select using (
    public.user_has_active_organization_membership(organization_id)
    and public.user_has_study_access(study_id)
  );

drop policy if exists document_intelligence_active_reference_events_insert on public.document_intelligence_active_reference_events;
create policy document_intelligence_active_reference_events_insert
  on public.document_intelligence_active_reference_events
  for insert with check (
    public.user_has_active_organization_membership(organization_id)
    and public.user_has_study_access(study_id)
  );

-- Backfill active references: latest ready document per family + study + active domain
insert into public.document_intelligence_active_references (
  organization_id,
  study_id,
  document_family_id,
  domain,
  intelligence_document_id,
  active_reference_reason
)
select distinct on (d.document_family_id, d.study_id, dom.domain)
  d.organization_id,
  d.study_id,
  d.document_family_id,
  dom.domain,
  d.id,
  'backfill_latest_ready'
from public.document_intelligence_documents d
inner join public.document_intelligence_domains dom
  on dom.intelligence_document_id = d.id
  and dom.status = 'active'
where d.study_id is not null
  and d.intelligence_status = 'ready'
order by d.document_family_id, d.study_id, dom.domain, d.created_at desc, d.id desc
on conflict (document_family_id, study_id, domain) do nothing;

-- ---------------------------------------------------------------------------
-- Search RPCs: default active-reference only; optional include superseded/history
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
