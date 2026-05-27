# K1-K5 Staging Validation Checklist

Purpose: validate the Evidence Runtime Spine in staging before merge. This checklist covers migration order, read/write boundaries, coordinator workflows, operational eSignature controls, and rollback readiness.

## 1. Supabase Migration Order

Apply migrations in order:

```text
0122_document_intelligence_ingestion.sql
0123_document_intelligence_trgm_search.sql
0124_document_intelligence_domains.sql
0125_source_blueprint_evidence.sql
0126_source_blueprint_evidence_lineage.sql
0127_document_intelligence_version_control.sql
0128_document_intelligence_ingest_safeguards.sql
0129_document_intelligence_active_reference_atomic.sql
0130_document_intelligence_k2_closure_alignment.sql
0131_source_blueprint_draft_suggestions.sql
0132_source_blueprint_signoff_audit_export.sql
0133_operational_signature_runtime.sql
0134_operational_signature_runtime_hardening.sql
```

Before applying:
- Take a staging database backup or point-in-time recovery marker.
- Confirm no partially applied K1-K5 migrations exist.
- Confirm `pgvector` and `pg_trgm` support is available before `0122` and `0123`.

After applying:
- Confirm migrations applied without dependency errors.
- Check for duplicate index warnings that indicate a prior partial deploy.
- Confirm FK references resolve for `studies`, `organizations`, `document_intelligence_documents`, runtime source packages, and operational signature requests.
- Confirm append-only triggers exist for evidence review events, active reference events, audit exports, operational signatures, and operational signature events.
- Confirm RLS policies use active organization membership plus study access and do not use `organization_id = auth.uid()`.
- Confirm `0134` installed operational signature org/study scope triggers and duplicate pending request index.

## 2. Staging Smoke Checklist

Run from the staging-configured app environment:

```bash
npm run document-intelligence:smoke
npm run source-blueprint-evidence:smoke
npm run source-blueprint-drafting:smoke
npm run source-blueprint-signoff:smoke
npm run operational-signature:smoke
npm run coordinator-command-center:smoke
npm run scan:protocol-safety
```

Expected result: all commands pass. Lint warnings are not part of this staging smoke set unless staging validation also runs the full local readiness suite.

## 3. Manual Coordinator Walkthrough

Use one staging organization and one staging study with coordinator-access membership.

Walk the workflow:

```text
Document Intelligence
-> Source Evidence Review
-> Draft Suggestions
-> Signoff & Audit
-> Runtime Source
-> Operational Signature
-> Visit Execution
```

Validate:
- `study_id` is preserved when moving between Document Intelligence, Source Evidence Review, Draft Suggestions, Signoff & Audit, Operational Signatures, Runtime Source, and Visit Execution.
- Study-scoped pages do not show data from another study.
- Evidence review, draft review, and signoff do not mutate runtime source packages, published source, reconciliation, or visit execution.
- Evidence workflows do not auto-publish source.
- Signature workflows do not auto-sign and require explicit user action.
- Coordinator Command Center shows pending evidence reviews, draft suggestions, signatures, runtime alerts, and version changes without creating or mutating records.

## 4. Operational eSignature Boundary Checks

Validate in staging with controlled test records:

- Completed operational signatures are append-only; direct update/delete attempts fail.
- Operational signature events are append-only.
- Duplicate pending signature requests for the same organization, study, artifact type, artifact id, required role, and signature meaning are rejected.
- A signature request cannot be created when `study_id` belongs to a different `organization_id`.
- Admin/owner users cannot sign PI/Sub-I-required artifacts unless they also have the exact required role.
- Unsupported artifact types fail signing with an explicit trusted-loader error.
- Supported test fixture signing hashes the server-loaded artifact payload, not a client-supplied payload.
- `signature_recorded` audit event includes signature id, request id, artifact id/type, signer user/role, required role, signature meaning, delegation flag, hash, IP address, user agent, and signed timestamp.

## 5. Rollback Notes

Preferred rollback posture: restore the staging database backup or point-in-time marker taken before applying `0122` through `0134`.

If manual rollback is required, reverse by migration dependency order:

```text
0134 -> 0133 -> 0132 -> 0131 -> 0130 -> 0129 -> 0128 -> 0127 -> 0126 -> 0125 -> 0124 -> 0123 -> 0122
```

Tables/data to snapshot before deploy:
- `document_intelligence_documents`
- `document_intelligence_chunks`
- `document_intelligence_domains`
- `document_intelligence_active_references`
- `document_intelligence_active_reference_events`
- `source_blueprint_evidence`
- `source_blueprint_evidence_lineage`
- `source_blueprint_evidence_review_events`
- `source_blueprint_draft_suggestions`
- `source_blueprint_draft_signoffs`
- `source_blueprint_audit_exports`
- `operational_signature_requests`
- `operational_signatures`
- `operational_signature_events`

Non-reversible or caution areas:
- Ingested embeddings/chunks and extracted evidence are operational records; dropping tables loses review context.
- Active reference changes write append-only events; do not delete event history unless restoring the entire staging backup.
- Signoff/audit exports and operational signatures are audit records; prefer full restore over selective deletion.
- `0134` adds triggers and a partial unique index; if it must be backed out manually, drop triggers before functions and drop the duplicate pending request index last.

## 6. Go/No-Go

Ready for merge when:
- All migrations apply cleanly through `0134`.
- All staging smoke commands pass.
- Coordinator walkthrough confirms study-safe navigation and command center visibility.
- eSignature boundary checks pass.
- No evidence path mutates runtime, reconciliation, publication, or visit execution.
- No auto-publish or auto-sign behavior is observed.
