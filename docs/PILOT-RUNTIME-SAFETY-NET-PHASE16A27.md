# Phase 16A-2.7 — Pilot Runtime Safety Net

Hardening before supervised coordinator pilot use. No product UI, dashboards, or workflow rewrites.

## Snapshot version integrity (1A)

- `snapshot_version` on `source_response_field_snapshots` (from 0088); verified in 0089.
- Unique key: `(source_response_id, field_key, snapshot_type, snapshot_version)`.
- Allocation: `allocate_source_field_snapshot_version()` — advisory lock + `SELECT MAX + 1` in one transaction (no `ON CONFLICT`).
- Each unlock/relock cycle intentionally produces a new immutable snapshot version for audit continuity.
- `captureSourceSnapshot` uses RPC via `allocateSnapshotVersion`; failures are best-effort (never block submit/sign).

## Consent version prep (1B)

- `study_subjects.consent_version_id`, `consent_signed_at`.
- Stub `document_versions` table (no workflow integration yet).

## SAE timeline prep (1C)

- `subject_adverse_events`: `sae_onset_at`, `initial_notification_due_at`, `followup_due_at`, `narrative_due_at`.
- `lib/safety/sae-timeline-calculator.ts` — UTC defaults: 24h / 7d / 15d (GCP/ICH E6(R3); protocol overrides deferred).

## Workflow stale index (1D)

- Partial index `workflow_activity_checkpoints_stale_detection_idx` on `last_active_at` where `status IN ('active','stale')`.

## Canonical serialization (Step 2)

- `canonicalSerialize()` — deterministic key order, explicit nulls, array order preserved.
- `hashFieldValue()` uses canonical payload normalization.

## Runtime error translation (Step 3)

- `translateRuntimeError()` — coordinator-safe messages; codes for unique/RLS/study access/snapshot/OCC/response set/break-glass/generic.
- `coordinator-facing.ts` — `apiErrorFromRuntimeError()`, `coordinatorMessageFromError()` wired into Source API (`normalizeRpcError` / `fromRpcThrown`), capture actions, visit lifecycle actions, sign/automation server actions, and read/write clients.
- Smoke: `npm run runtime-api:hardening-smoke`

## Temporal pending (Step 4)

- Missing one or both timestamps → `evaluation_result = pending` (insufficient evidence; non-blocking; audit-visible).
- `pending` ≠ `pass`.

## Break-glass expiry (Step 5)

- `validateBreakGlassAccess()` / `validateBreakGlassAccessAttempt()` — expired attempts emit `BREAK_GLASS_EXPIRED_ACCESS_ATTEMPT`.

## Service role audit (Step 6)

- `scripts/phase16a27-service-role-audit.ts` → `.runtime-validation/service-role-audit.md`
- Fails only when coordinator-facing runtime/source paths use service role.

## Pilot feedback (Step 7)

- Append-only `pilot_feedback` + `block_pilot_feedback_mutation` trigger.
- `submitPilotFeedback()` — insert only, never throws to caller.

## Validation

```bash
npx tsc --noEmit
npm run lint
npm run build
npx tsx scripts/phase16a27-canonical-hash-parity-smoke.ts
npx tsx scripts/phase16a27-pre-pilot-safety-hardening-smoke.ts
npx tsx scripts/phase16a27-runtime-error-translation-smoke.ts
npx tsx scripts/phase16a27-service-role-audit.ts
npm run integrity:audit:strict
```
