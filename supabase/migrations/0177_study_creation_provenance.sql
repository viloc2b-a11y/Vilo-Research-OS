-- Phase 17: Hardened Study Creation Provenance
-- Block unauthorized/fake study creation in production

alter table public.studies
add column if not exists created_by_user_id uuid references auth.users (id),
add column if not exists created_source text;

-- Backfill legacy
update public.studies
set created_source = 'legacy'
where created_source is null;

-- Enforce controlled provenance
alter table public.studies
add constraint studies_creation_provenance_check
check (
  created_source in ('legacy', 'human_new_study', 'test_seed', 'e2e_demo')
);

alter table public.studies
add constraint studies_created_by_user_check
check (
  created_source = 'legacy'
  or created_source in ('test_seed', 'e2e_demo')
  or created_by_user_id is not null
);

-- Force non-human sources to explicitly be allowed via app setting, otherwise they fail in prod.
-- If someone tries to insert 'test_seed' without the setting, it will fail this constraint.
alter table public.studies
add constraint studies_prevent_prod_seed_check
check (
  created_source in ('legacy', 'human_new_study')
  or coalesce(current_setting('app.allow_test_seed', true), 'false') = 'true'
);
