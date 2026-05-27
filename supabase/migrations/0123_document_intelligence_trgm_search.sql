-- K1: study-scoped search RPCs — pg_trgm % operator only (no ilike)

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
    and c.study_id = filter_study_id
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
    and c.study_id = filter_study_id
    and d.intelligence_status = 'ready'
    and (filter_classification is null or d.document_classification = filter_classification)
    and search_query is not null
    and length(trim(search_query)) > 0
    and c.clean_chunk_text % search_query
    and similarity(c.clean_chunk_text, search_query) >= 0.3
  order by similarity(c.clean_chunk_text, search_query) desc nulls last
  limit greatest(match_count, 1);
$$;
