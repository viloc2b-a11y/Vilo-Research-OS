-- Phase 1b synthetic seed (reference)
-- Prefer: npm run db:provision (creates auth users + orgs via Admin API)
--
-- If running SQL manually after creating users in Supabase Auth Dashboard:
-- 1. Replace :user_a_id and :user_b_id with auth.users UUIDs
-- 2. Run after 0001 and 0002 migrations

-- insert into public.organizations (name) values
--   ('Synthetic Site Alpha (Staging)'),
--   ('Synthetic Site Beta (Staging)');
