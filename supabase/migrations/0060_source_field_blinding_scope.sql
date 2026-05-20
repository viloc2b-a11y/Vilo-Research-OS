-- Source/eSource field blinding metadata.
-- Existing rows default to blinded; sensitive legacy keys are additionally
-- protected in application code until metadata is curated.

alter table public.source_fields
  add column if not exists blinding_scope text not null default 'blinded';

alter table public.source_fields
  drop constraint if exists source_fields_blinding_scope_check;

alter table public.source_fields
  add constraint source_fields_blinding_scope_check
  check (blinding_scope in ('blinded', 'unblinded', 'public_to_site'));

alter table public.published_source_fields
  add column if not exists blinding_scope text not null default 'blinded';

alter table public.published_source_fields
  drop constraint if exists published_source_fields_blinding_scope_check;

alter table public.published_source_fields
  add constraint published_source_fields_blinding_scope_check
  check (blinding_scope in ('blinded', 'unblinded', 'public_to_site'));

alter table public.published_source_sections
  add column if not exists blinding_scope text not null default 'blinded';

alter table public.published_source_sections
  drop constraint if exists published_source_sections_blinding_scope_check;

alter table public.published_source_sections
  add constraint published_source_sections_blinding_scope_check
  check (blinding_scope in ('blinded', 'unblinded', 'public_to_site'));

comment on column public.source_fields.blinding_scope is
  'Source capture visibility: blinded | unblinded | public_to_site. Defaults to blinded.';

comment on column public.published_source_fields.blinding_scope is
  'Immutable published field visibility metadata copied from source definition packaging.';

comment on column public.published_source_sections.blinding_scope is
  'Immutable published section visibility metadata.';
