-- Phase 6B.6 — Persisted runtime toolbar controls.
-- Operational coordinator controls only; no workflow engine or cryptographic signature.
-- Runtime actions are logged to the existing operational_events stream.

alter table public.procedure_executions
  add column if not exists fields_disabled_at timestamptz,
  add column if not exists fields_disabled_by uuid references auth.users (id) on delete set null,
  add column if not exists fields_disabled_reason text,
  add column if not exists section_disabled_at timestamptz,
  add column if not exists section_disabled_by uuid references auth.users (id) on delete set null,
  add column if not exists section_disabled_reason text,
  add column if not exists reopened_at timestamptz,
  add column if not exists reopened_by uuid references auth.users (id) on delete set null;
