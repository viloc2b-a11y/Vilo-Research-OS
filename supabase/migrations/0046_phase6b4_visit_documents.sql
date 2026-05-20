-- Phase 6B.4 — Visit Documents operational repository.
-- Simple coordinator-facing visit file storage; not eTMF, DMS, OCR, or sponsor exchange.

insert into storage.buckets (id, name, public)
values ('visit-documents', 'visit-documents', false)
on conflict (id) do nothing;

create table if not exists public.subject_visit_documents (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations (id) on delete cascade,
  study_id uuid not null references public.studies (id) on delete cascade,
  study_subject_id uuid not null references public.study_subjects (id) on delete cascade,
  subject_visit_id uuid not null references public.visits (id) on delete cascade,
  document_type text not null
    check (document_type in (
      'ICF',
      'Labs',
      'Imaging',
      'ECG',
      'Source Document',
      'External Record',
      'Procedure Report',
      'Eligibility Document',
      'Progress Note Attachment',
      'Other'
    )),
  file_name text not null,
  file_path text not null,
  mime_type text not null
    check (mime_type in ('application/pdf', 'image/jpeg', 'image/png')),
  file_size bigint not null default 0 check (file_size >= 0),
  uploaded_by uuid references auth.users (id) on delete set null,
  uploaded_at timestamptz not null default now(),
  notes text,
  constraint subject_visit_documents_file_path_key unique (file_path)
);

create index if not exists subject_visit_documents_visit_idx
  on public.subject_visit_documents (subject_visit_id, uploaded_at desc);

create index if not exists subject_visit_documents_subject_idx
  on public.subject_visit_documents (study_subject_id, uploaded_at desc);

create or replace function public.phase6b4_enforce_visit_document_scope()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_org uuid;
  v_study uuid;
  v_subject uuid;
begin
  select v.organization_id, v.study_id, v.study_subject_id
    into v_org, v_study, v_subject
  from public.visits v
  where v.id = new.subject_visit_id;

  if v_org is null then
    raise exception 'subject_visit_id not found';
  end if;

  if new.org_id is distinct from v_org then
    new.org_id := v_org;
  end if;

  if new.study_id is distinct from v_study then
    new.study_id := v_study;
  end if;

  if new.study_subject_id is distinct from v_subject then
    new.study_subject_id := v_subject;
  end if;

  return new;
end;
$$;

drop trigger if exists subject_visit_documents_enforce_scope on public.subject_visit_documents;
create trigger subject_visit_documents_enforce_scope
before insert or update of org_id, study_id, study_subject_id, subject_visit_id
on public.subject_visit_documents
for each row execute function public.phase6b4_enforce_visit_document_scope();

alter table public.subject_visit_documents enable row level security;

drop policy if exists subject_visit_documents_select on public.subject_visit_documents;
create policy subject_visit_documents_select on public.subject_visit_documents
for select using (
  org_id in (select public.user_organization_ids())
  and (
    public.user_is_org_admin(org_id)
    or public.user_has_study_access(study_id)
  )
);

drop policy if exists subject_visit_documents_insert on public.subject_visit_documents;
create policy subject_visit_documents_insert on public.subject_visit_documents
for insert with check (
  org_id in (select public.user_organization_ids())
  and public.user_can_manage_subject_enrollment(study_id)
);

drop policy if exists subject_visit_documents_delete on public.subject_visit_documents;
create policy subject_visit_documents_delete on public.subject_visit_documents
for delete using (
  org_id in (select public.user_organization_ids())
  and public.user_can_manage_subject_enrollment(study_id)
);

comment on table public.subject_visit_documents is
  'Coordinator operational visit documents. Supports PDFs/images for visit evidence; not eTMF or sponsor exchange.';

