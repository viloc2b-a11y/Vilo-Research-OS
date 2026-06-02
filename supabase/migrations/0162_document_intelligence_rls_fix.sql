-- Fix RLS policies for document_intelligence to allow Org Admins to ingest documents for studies
-- Org Admins (owner/admin) are allowed to perform document ingestion and updates for any study in their org.

drop policy if exists document_intelligence_documents_insert on public.document_intelligence_documents;
create policy document_intelligence_documents_insert on public.document_intelligence_documents
  for insert with check (
    public.user_has_active_organization_membership(organization_id)
    and (study_id is null or public.user_has_study_access(study_id) or public.user_is_org_admin(organization_id))
  );

drop policy if exists document_intelligence_documents_update on public.document_intelligence_documents;
create policy document_intelligence_documents_update on public.document_intelligence_documents
  for update using (
    public.user_has_active_organization_membership(organization_id)
    and (study_id is null or public.user_has_study_access(study_id) or public.user_is_org_admin(organization_id))
  );

drop policy if exists document_intelligence_chunks_insert on public.document_intelligence_chunks;
create policy document_intelligence_chunks_insert on public.document_intelligence_chunks
  for insert with check (
    public.user_has_active_organization_membership(organization_id)
    and (study_id is null or public.user_has_study_access(study_id) or public.user_is_org_admin(organization_id))
  );

drop policy if exists document_intelligence_chunks_update on public.document_intelligence_chunks;
create policy document_intelligence_chunks_update on public.document_intelligence_chunks
  for update using (
    public.user_has_active_organization_membership(organization_id)
    and (study_id is null or public.user_has_study_access(study_id) or public.user_is_org_admin(organization_id))
  );

drop policy if exists document_intelligence_ingestion_runs_insert on public.document_intelligence_ingestion_runs;
create policy document_intelligence_ingestion_runs_insert on public.document_intelligence_ingestion_runs
  for insert with check (
    public.user_has_active_organization_membership(organization_id)
    and (study_id is null or public.user_has_study_access(study_id) or public.user_is_org_admin(organization_id))
  );

drop policy if exists document_intelligence_ingestion_runs_update on public.document_intelligence_ingestion_runs;
create policy document_intelligence_ingestion_runs_update on public.document_intelligence_ingestion_runs
  for update using (
    public.user_has_active_organization_membership(organization_id)
    and (study_id is null or public.user_has_study_access(study_id) or public.user_is_org_admin(organization_id))
  );

drop policy if exists document_intelligence_search_events_insert on public.document_intelligence_search_events;
create policy document_intelligence_search_events_insert on public.document_intelligence_search_events
  for insert with check (
    public.user_has_active_organization_membership(organization_id)
    and (study_id is null or public.user_has_study_access(study_id) or public.user_is_org_admin(organization_id))
  );
