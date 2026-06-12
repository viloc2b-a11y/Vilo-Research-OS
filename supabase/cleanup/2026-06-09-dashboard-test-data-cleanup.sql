-- Dashboard test-data cleanup, dry-run first.
-- Date: 2026-06-09
-- Purpose: remove or isolate explicit smoke/staging/test records from coordinator-facing dashboards.
--
-- SAFE USE:
-- 1) Run the DRY-RUN SELECT sections first and review every matched row.
-- 2) Only after review, run the APPLY section inside a transaction.
-- 3) Do not broaden the patterns. This script intentionally matches explicit known test identifiers only.
--
-- Existing soft-archive support confirmed:
-- - public.studies.status supports 'archived' (0163_study_status_archived.sql).
-- - public.studies.created_source exists (0177_study_creation_provenance.sql).
-- - public.compliance_runtime_documents.status supports 'archived' (0106_document_intake_compliance_runtime.sql).
-- - public.source_response_sets.status supports 'archived' (0020_source_response_sets.sql).
--
-- No hidden_from_dashboard or is_test_data columns exist in the base runtime tables as of this repo state.
-- Test provenance is recorded via studies.created_source and JSON metadata/payload where available.

-- -----------------------------------------------------------------------------
-- Shared match predicates
-- -----------------------------------------------------------------------------

-- DRY RUN: studies
select
  'studies' as table_name,
  s.id,
  s.organization_id,
  s.name,
  s.slug,
  s.status,
  s.created_source,
  s.created_at
from public.studies s
where s.created_source in ('test_seed', 'e2e_demo')
   or s.name ~* '(VPI-STAGING|PHASE9A-PILOT|VPI seed|QA RBAC|Reader Closure|E2E Upload|MV_E2E|GEN_A001|GEN_A002|GEN_ONC|GEN_VAC)'
   or coalesce(s.slug, '') ~* '(VPI-STAGING|PHASE9A-PILOT|Reader Closure|E2E Upload|MV_E2E|GEN_A001|GEN_A002|GEN_ONC|GEN_VAC)'
order by s.created_at desc;

-- DRY RUN: subjects
select
  'study_subjects' as table_name,
  ss.id,
  ss.organization_id,
  ss.study_id,
  s.name as study_name,
  ss.subject_identifier,
  ss.enrollment_status,
  ss.created_at
from public.study_subjects ss
join public.studies s on s.id = ss.study_id
where ss.subject_identifier ~* '(VPI-STAGING|PHASE9A-PILOT|MV_E2E|GEN_A001|GEN_A002|GEN_ONC|GEN_VAC)'
   or s.created_source in ('test_seed', 'e2e_demo')
   or s.name ~* '(Reader Closure|E2E Upload|MV_E2E|GEN_A001|GEN_A002|GEN_ONC|GEN_VAC)'
order by ss.created_at desc;

-- DRY RUN: visits / VPI seed definitions
select
  'visits' as table_name,
  v.id,
  v.organization_id,
  v.study_id,
  s.name as study_name,
  ss.subject_identifier,
  vd.code as visit_code,
  vd.label as visit_label,
  v.visit_status,
  v.scheduled_date,
  v.created_at
from public.visits v
join public.studies s on s.id = v.study_id
join public.study_subjects ss on ss.id = v.study_subject_id
join public.visit_definitions vd on vd.id = v.visit_definition_id
where ss.subject_identifier ~* '(VPI-STAGING|PHASE9A-PILOT|MV_E2E|GEN_A001|GEN_A002|GEN_ONC|GEN_VAC)'
   or vd.code ~* '(VPI_SEED|PHASE9A-PILOT)'
   or vd.label ~* '(VPI seed|PHASE9A-PILOT)'
   or s.created_source in ('test_seed', 'e2e_demo')
order by v.created_at desc;

-- DRY RUN: procedure executions / source sets / workflow actions / projections
with matched_studies as (
  select id from public.studies
  where created_source in ('test_seed', 'e2e_demo')
     or name ~* '(VPI-STAGING|PHASE9A-PILOT|VPI seed|QA RBAC|Reader Closure|E2E Upload|MV_E2E|GEN_A001|GEN_A002|GEN_ONC|GEN_VAC)'
     or coalesce(slug, '') ~* '(VPI-STAGING|PHASE9A-PILOT|Reader Closure|E2E Upload|MV_E2E|GEN_A001|GEN_A002|GEN_ONC|GEN_VAC)'
), matched_subjects as (
  select ss.id from public.study_subjects ss
  where ss.study_id in (select id from matched_studies)
     or ss.subject_identifier ~* '(VPI-STAGING|PHASE9A-PILOT|MV_E2E|GEN_A001|GEN_A002|GEN_ONC|GEN_VAC)'
), matched_visits as (
  select v.id from public.visits v
  join public.visit_definitions vd on vd.id = v.visit_definition_id
  where v.study_id in (select id from matched_studies)
     or v.study_subject_id in (select id from matched_subjects)
     or vd.code ~* 'VPI_SEED'
     or vd.label ~* 'VPI seed'
), matched_source_sets as (
  select srs.id from public.source_response_sets srs
  where left(srs.id::text, 8) in ('3cea3f80', 'f0ed64b5', '21533aa7', '59f7a569', '31152a92')
     or srs.study_id in (select id from matched_studies)
     or srs.study_subject_id in (select id from matched_subjects)
     or srs.visit_id in (select id from matched_visits)
)
select 'procedure_executions' as table_name, pe.id::text as id, pe.study_id::text as study_id, pe.visit_id::text as parent_id, pe.execution_status as status
from public.procedure_executions pe
where pe.study_id in (select id from matched_studies)
   or pe.visit_id in (select id from matched_visits)
union all
select 'source_response_sets', srs.id::text, srs.study_id::text, srs.visit_id::text, srs.status
from public.source_response_sets srs
where srs.id in (select id from matched_source_sets)
union all
select 'subject_workflow_actions', swa.id::text, swa.study_id::text, coalesce(swa.visit_id::text, swa.source_response_set_id::text), swa.status
from public.subject_workflow_actions swa
where swa.study_id in (select id from matched_studies)
   or swa.study_subject_id in (select id from matched_subjects)
   or swa.visit_id in (select id from matched_visits)
   or swa.source_response_set_id in (select id from matched_source_sets)
   or swa.title ~* '(VPI seed|VPI_SEED|QA RBAC|PHASE9A-PILOT|Reader Closure|E2E Upload|MV_E2E)'
union all
select 'visit_readiness_projections', vrp.visit_id::text, vrp.study_id::text, vrp.study_subject_id::text, vrp.readiness_status
from public.visit_readiness_projections vrp
where vrp.study_id in (select id from matched_studies)
   or vrp.study_subject_id in (select id from matched_subjects)
   or vrp.visit_id in (select id from matched_visits)
union all
select 'visit_coordinator_orchestration_projections', vcop.visit_id::text, vcop.study_id::text, vcop.study_subject_id::text, vcop.top_priority_score::text
from public.visit_coordinator_orchestration_projections vcop
where vcop.study_id in (select id from matched_studies)
   or vcop.study_subject_id in (select id from matched_subjects)
   or vcop.visit_id in (select id from matched_visits)
order by table_name, id;

-- DRY RUN: document center recent-upload pollution
select
  'compliance_runtime_documents' as table_name,
  d.id,
  d.organization_id,
  d.study_id,
  d.operational_display_name,
  d.original_filename,
  d.status,
  d.metadata,
  d.created_at
from public.compliance_runtime_documents d
left join public.studies s on s.id = d.study_id
where d.operational_display_name ~* '(Reader Closure|E2E Upload|VALIDATION_PROTOCOL_001|VALIDATION_PROTOCOL_002|GEN_A001|GEN_A002|GEN_ONC|GEN_VAC|Phase 1[BCD].*Smoke|VALIDATION-PROTOCOL-001-SMOKE)'
   or d.original_filename ~* '(VALIDATION_PROTOCOL_001|VALIDATION_PROTOCOL_002|E2E Upload|Reader Closure)'
   or d.operational_notes ~* '(smoke|Reader closure live validation)'
   or d.metadata::text ~* '(smoke_test|runtime_validation|test_seed|e2e_demo)'
   or s.created_source in ('test_seed', 'e2e_demo')
order by d.created_at desc;

-- DRY RUN: append-only operational events that will be excluded by dashboard loaders.
-- These are intentionally not deleted here because operational_events has an immutability trigger.
select
  'operational_events' as table_name,
  oe.id,
  oe.organization_id,
  oe.study_id,
  s.name as study_name,
  oe.event_type,
  oe.payload,
  oe.occurred_at
from public.operational_events oe
join public.studies s on s.id = oe.study_id
where oe.event_type ~* '(QA RBAC|Operational Calendar Manual Event|VPI_SEED|PHASE9A-PILOT)'
   or oe.payload::text ~* '(QA RBAC|Operational Calendar Manual Event|VPI seed|VPI_SEED|PHASE9A-PILOT|Reader Closure|E2E Upload|MV_E2E)'
   or s.created_source in ('test_seed', 'e2e_demo')
order by oe.occurred_at desc;

-- -----------------------------------------------------------------------------
-- APPLY SECTION: run only after reviewing dry-run output.
-- -----------------------------------------------------------------------------

begin;

with matched_studies as (
  select id from public.studies
  where created_source in ('test_seed', 'e2e_demo')
     or name ~* '(VPI-STAGING|PHASE9A-PILOT|VPI seed|QA RBAC|Reader Closure|E2E Upload|MV_E2E|GEN_A001|GEN_A002|GEN_ONC|GEN_VAC)'
     or coalesce(slug, '') ~* '(VPI-STAGING|PHASE9A-PILOT|Reader Closure|E2E Upload|MV_E2E|GEN_A001|GEN_A002|GEN_ONC|GEN_VAC)'
), matched_subjects as (
  select ss.id from public.study_subjects ss
  where ss.study_id in (select id from matched_studies)
     or ss.subject_identifier ~* '(VPI-STAGING|PHASE9A-PILOT|MV_E2E|GEN_A001|GEN_A002|GEN_ONC|GEN_VAC)'
), matched_visits as (
  select v.id from public.visits v
  join public.visit_definitions vd on vd.id = v.visit_definition_id
  where v.study_id in (select id from matched_studies)
     or v.study_subject_id in (select id from matched_subjects)
     or vd.code ~* 'VPI_SEED'
     or vd.label ~* 'VPI seed'
), matched_source_sets as (
  select srs.id from public.source_response_sets srs
  where left(srs.id::text, 8) in ('3cea3f80', 'f0ed64b5', '21533aa7', '59f7a569', '31152a92')
     or srs.study_id in (select id from matched_studies)
     or srs.study_subject_id in (select id from matched_subjects)
     or srs.visit_id in (select id from matched_visits)
), matched_documents as (
  select d.id from public.compliance_runtime_documents d
  left join public.studies s on s.id = d.study_id
  where d.operational_display_name ~* '(Reader Closure|E2E Upload|VALIDATION_PROTOCOL_001|VALIDATION_PROTOCOL_002|GEN_A001|GEN_A002|GEN_ONC|GEN_VAC|Phase 1[BCD].*Smoke|VALIDATION-PROTOCOL-001-SMOKE)'
     or d.original_filename ~* '(VALIDATION_PROTOCOL_001|VALIDATION_PROTOCOL_002|E2E Upload|Reader Closure)'
     or d.operational_notes ~* '(smoke|Reader closure live validation)'
     or d.metadata::text ~* '(smoke_test|runtime_validation|test_seed|e2e_demo)'
     or s.created_source in ('test_seed', 'e2e_demo')
)
update public.studies s
set status = 'archived', updated_at = now()
where s.id in (select id from matched_studies)
  and s.status <> 'archived';

with matched_documents as (
  select d.id from public.compliance_runtime_documents d
  left join public.studies s on s.id = d.study_id
  where d.operational_display_name ~* '(Reader Closure|E2E Upload|VALIDATION_PROTOCOL_001|VALIDATION_PROTOCOL_002|GEN_A001|GEN_A002|GEN_ONC|GEN_VAC|Phase 1[BCD].*Smoke|VALIDATION-PROTOCOL-001-SMOKE)'
     or d.original_filename ~* '(VALIDATION_PROTOCOL_001|VALIDATION_PROTOCOL_002|E2E Upload|Reader Closure)'
     or d.operational_notes ~* '(smoke|Reader closure live validation)'
     or d.metadata::text ~* '(smoke_test|runtime_validation|test_seed|e2e_demo)'
     or s.created_source in ('test_seed', 'e2e_demo')
)
update public.compliance_runtime_documents d
set status = 'archived',
    metadata = coalesce(d.metadata, '{}'::jsonb) || jsonb_build_object(
      'is_test_data', true,
      'created_by_system', true,
      'seed_source', 'dashboard_cleanup_2026_06_09',
      'provenance', 'dashboard_cleanup_2026_06_09'
    ),
    updated_at = now()
where d.id in (select id from matched_documents)
  and d.status <> 'archived';

with matched_studies as (
  select id from public.studies
  where created_source in ('test_seed', 'e2e_demo')
     or name ~* '(VPI-STAGING|PHASE9A-PILOT|VPI seed|QA RBAC|Reader Closure|E2E Upload|MV_E2E|GEN_A001|GEN_A002|GEN_ONC|GEN_VAC)'
), matched_subjects as (
  select ss.id from public.study_subjects ss
  where ss.study_id in (select id from matched_studies)
     or ss.subject_identifier ~* '(VPI-STAGING|PHASE9A-PILOT|MV_E2E|GEN_A001|GEN_A002|GEN_ONC|GEN_VAC)'
), matched_visits as (
  select v.id from public.visits v
  join public.visit_definitions vd on vd.id = v.visit_definition_id
  where v.study_id in (select id from matched_studies)
     or v.study_subject_id in (select id from matched_subjects)
     or vd.code ~* 'VPI_SEED'
     or vd.label ~* 'VPI seed'
), matched_source_sets as (
  select srs.id from public.source_response_sets srs
  where left(srs.id::text, 8) in ('3cea3f80', 'f0ed64b5', '21533aa7', '59f7a569', '31152a92')
     or srs.study_id in (select id from matched_studies)
     or srs.study_subject_id in (select id from matched_subjects)
     or srs.visit_id in (select id from matched_visits)
)
update public.source_response_sets srs
set status = 'archived', updated_at = now()
where srs.id in (select id from matched_source_sets)
  and srs.status <> 'archived';

with matched_studies as (
  select id from public.studies
  where created_source in ('test_seed', 'e2e_demo')
     or name ~* '(VPI-STAGING|PHASE9A-PILOT|VPI seed|QA RBAC|Reader Closure|E2E Upload|MV_E2E|GEN_A001|GEN_A002|GEN_ONC|GEN_VAC)'
), matched_subjects as (
  select ss.id from public.study_subjects ss
  where ss.study_id in (select id from matched_studies)
     or ss.subject_identifier ~* '(VPI-STAGING|PHASE9A-PILOT|MV_E2E|GEN_A001|GEN_A002|GEN_ONC|GEN_VAC)'
), matched_visits as (
  select v.id from public.visits v
  join public.visit_definitions vd on vd.id = v.visit_definition_id
  where v.study_id in (select id from matched_studies)
     or v.study_subject_id in (select id from matched_subjects)
     or vd.code ~* 'VPI_SEED'
     or vd.label ~* 'VPI seed'
), matched_source_sets as (
  select srs.id from public.source_response_sets srs
  where left(srs.id::text, 8) in ('3cea3f80', 'f0ed64b5', '21533aa7', '59f7a569', '31152a92')
     or srs.study_id in (select id from matched_studies)
     or srs.study_subject_id in (select id from matched_subjects)
     or srs.visit_id in (select id from matched_visits)
)
delete from public.visit_coordinator_orchestration_projections vcop
where vcop.study_id in (select id from matched_studies)
   or vcop.study_subject_id in (select id from matched_subjects)
   or vcop.visit_id in (select id from matched_visits);

with matched_studies as (
  select id from public.studies
  where created_source in ('test_seed', 'e2e_demo')
     or name ~* '(VPI-STAGING|PHASE9A-PILOT|VPI seed|QA RBAC|Reader Closure|E2E Upload|MV_E2E|GEN_A001|GEN_A002|GEN_ONC|GEN_VAC)'
), matched_subjects as (
  select ss.id from public.study_subjects ss
  where ss.study_id in (select id from matched_studies)
     or ss.subject_identifier ~* '(VPI-STAGING|PHASE9A-PILOT|MV_E2E|GEN_A001|GEN_A002|GEN_ONC|GEN_VAC)'
), matched_visits as (
  select v.id from public.visits v
  join public.visit_definitions vd on vd.id = v.visit_definition_id
  where v.study_id in (select id from matched_studies)
     or v.study_subject_id in (select id from matched_subjects)
     or vd.code ~* 'VPI_SEED'
     or vd.label ~* 'VPI seed'
)
delete from public.visit_readiness_projections vrp
where vrp.study_id in (select id from matched_studies)
   or vrp.study_subject_id in (select id from matched_subjects)
   or vrp.visit_id in (select id from matched_visits);

-- Delete explicitly matched mutable runtime rows after soft-archiving containers above.
-- operational_events remains untouched because it is append-only by design.
with matched_studies as (
  select id from public.studies
  where created_source in ('test_seed', 'e2e_demo')
     or name ~* '(VPI-STAGING|PHASE9A-PILOT|VPI seed|QA RBAC|Reader Closure|E2E Upload|MV_E2E|GEN_A001|GEN_A002|GEN_ONC|GEN_VAC)'
), matched_subjects as (
  select ss.id from public.study_subjects ss
  where ss.study_id in (select id from matched_studies)
     or ss.subject_identifier ~* '(VPI-STAGING|PHASE9A-PILOT|MV_E2E|GEN_A001|GEN_A002|GEN_ONC|GEN_VAC)'
), matched_visits as (
  select v.id from public.visits v
  join public.visit_definitions vd on vd.id = v.visit_definition_id
  where v.study_id in (select id from matched_studies)
     or v.study_subject_id in (select id from matched_subjects)
     or vd.code ~* 'VPI_SEED'
     or vd.label ~* 'VPI seed'
), matched_source_sets as (
  select srs.id from public.source_response_sets srs
  where left(srs.id::text, 8) in ('3cea3f80', 'f0ed64b5', '21533aa7', '59f7a569', '31152a92')
     or srs.study_id in (select id from matched_studies)
     or srs.study_subject_id in (select id from matched_subjects)
     or srs.visit_id in (select id from matched_visits)
)
delete from public.subject_workflow_actions swa
where swa.study_id in (select id from matched_studies)
   or swa.study_subject_id in (select id from matched_subjects)
   or swa.visit_id in (select id from matched_visits)
   or swa.source_response_set_id in (select id from matched_source_sets)
   or swa.title ~* '(VPI seed|VPI_SEED|QA RBAC|PHASE9A-PILOT|Reader Closure|E2E Upload|MV_E2E)';

with matched_studies as (
  select id from public.studies
  where created_source in ('test_seed', 'e2e_demo')
     or name ~* '(VPI-STAGING|PHASE9A-PILOT|VPI seed|QA RBAC|Reader Closure|E2E Upload|MV_E2E|GEN_A001|GEN_A002|GEN_ONC|GEN_VAC)'
), matched_subjects as (
  select ss.id from public.study_subjects ss
  where ss.study_id in (select id from matched_studies)
     or ss.subject_identifier ~* '(VPI-STAGING|PHASE9A-PILOT|MV_E2E|GEN_A001|GEN_A002|GEN_ONC|GEN_VAC)'
), matched_visits as (
  select v.id from public.visits v
  join public.visit_definitions vd on vd.id = v.visit_definition_id
  where v.study_id in (select id from matched_studies)
     or v.study_subject_id in (select id from matched_subjects)
     or vd.code ~* 'VPI_SEED'
     or vd.label ~* 'VPI seed'
)
delete from public.procedure_executions pe
where pe.study_id in (select id from matched_studies)
   or pe.visit_id in (select id from matched_visits);

with matched_studies as (
  select id from public.studies
  where created_source in ('test_seed', 'e2e_demo')
     or name ~* '(VPI-STAGING|PHASE9A-PILOT|VPI seed|QA RBAC|Reader Closure|E2E Upload|MV_E2E|GEN_A001|GEN_A002|GEN_ONC|GEN_VAC)'
), matched_subjects as (
  select ss.id from public.study_subjects ss
  where ss.study_id in (select id from matched_studies)
     or ss.subject_identifier ~* '(VPI-STAGING|PHASE9A-PILOT|MV_E2E|GEN_A001|GEN_A002|GEN_ONC|GEN_VAC)'
)
delete from public.visits v
using public.visit_definitions vd
where vd.id = v.visit_definition_id
  and (
    v.study_id in (select id from matched_studies)
    or v.study_subject_id in (select id from matched_subjects)
    or vd.code ~* 'VPI_SEED'
    or vd.label ~* 'VPI seed'
  );

-- Keep study rows archived for audit context; remove only explicit test subjects now detached from visits.
with matched_studies as (
  select id from public.studies
  where created_source in ('test_seed', 'e2e_demo')
     or name ~* '(VPI-STAGING|PHASE9A-PILOT|VPI seed|QA RBAC|Reader Closure|E2E Upload|MV_E2E|GEN_A001|GEN_A002|GEN_ONC|GEN_VAC)'
)
delete from public.study_subjects ss
where ss.study_id in (select id from matched_studies)
   or ss.subject_identifier ~* '(VPI-STAGING|PHASE9A-PILOT|MV_E2E|GEN_A001|GEN_A002|GEN_ONC|GEN_VAC)';

commit;
