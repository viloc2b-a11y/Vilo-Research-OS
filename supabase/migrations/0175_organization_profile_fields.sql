-- Vilo OS: Add detailed profile fields to the organizations table

alter table public.organizations
add column if not exists legal_name text,
add column if not exists address text,
add column if not exists phone text,
add column if not exists email text,
add column if not exists website text,
add column if not exists tax_id text,
add column if not exists npi text,
add column if not exists clia text,
add column if not exists status text not null default 'active',
add column if not exists updated_at timestamptz;
