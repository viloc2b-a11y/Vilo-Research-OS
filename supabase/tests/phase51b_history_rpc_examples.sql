-- Phase 5.1B Step 1 — manual RPC examples (staging only).
-- Prerequisites: migration 0040 applied; authenticated session (set request.jwt.claim.sub).
-- Replace UUID placeholders before running.

-- Example: history for a response set after E2E capture
-- select public.get_source_response_set_history(
--   '<organization_id>'::uuid,
--   '<source_response_set_id>'::uuid
-- );

-- Example: inspect append-only finding lifecycle events for a set
-- select *
-- from public.source_response_validation_finding_events
-- where response_set_id = '<source_response_set_id>'::uuid
-- order by occurred_at;

-- Example: verify correction lineage preserved (no in-place value mutation)
-- select src.id, src.superseded_response_id, src.response_id, src.corrected_at
-- from public.source_response_corrections src
-- join public.source_responses sr on sr.id = src.superseded_response_id
-- where sr.response_set_id = '<source_response_set_id>'::uuid;
