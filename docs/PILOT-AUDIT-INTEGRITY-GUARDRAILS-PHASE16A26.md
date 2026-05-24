# Phase 16A-2.6 — Pilot Audit Integrity Guardrails

Supervised coordinator pilot guardrails that detect audit-risk behavior **before it becomes invisible**. Foundations only — not full compliance modules, dashboards, or blocking UI.

**Migrations:**
- `0087_phase16a26_gov1_extension.sql` — GOV-1 workflow registry + escalation rules
- `0088_phase16a26_source_integrity.sql` — snapshots, workflow abandonment, role conflicts

**Smoke:** `npm run audit-integrity:smoke`

---

## Why pilot guardrails (not full modules)

| Area | This phase | Later |
|------|------------|-------|
| Field integrity | SHA256 hash snapshots + violation signals | Monitoring review UI, diff viewers |
| Workflow abandonment | Checkpoints + callable stale detector | Hourly scheduler, escalation workflows |
| Role conflicts | Policy lookup + audit events | Global enforcement UI, blocking gates |

All helpers are **best-effort** and **non-blocking** unless an existing runtime path already enforces the action. **No DB triggers** auto-create snapshots on `source_responses`.

---

## GOV-1 extension (Step 1)

| `workflow_key` | `base_authority_level` | `system_blocking` | Notes |
|----------------|------------------------|-------------------|-------|
| `source_integrity_snapshot` | `system_enforced` | false | Routine submit/sign/lock/monitoring_review hashes |
| `source_integrity_violation` | `system_enforced` | false | Hash mismatch audit signal (non-blocking in pilot) |
| `workflow_abandonment_review` | `human_required` | false | Stale workflow review |
| `role_conflict_resolution` | `human_required` | true | Blocking by default; small-site exemption via escalation rule |

**Escalation rules (schema only; evaluator deferred):**

| `workflow_key` | `rule_key` |
|----------------|------------|
| `source_integrity_snapshot` | `hash_mismatch_detected` |
| `workflow_abandonment_review` | `stale_workflow_unresolved_past_escalation_threshold` |
| `role_conflict_resolution` | `single_staff_site_exemption` |

TypeScript: `WORKFLOW_KEY`, `WORKFLOW_ESCALATION_RULE_KEY` in `lib/governance/workflow-authority/constants.ts`.

---

## Source integrity snapshots (Step 2)

**Table:** `source_response_field_snapshots`

- Stores `field_key` + `field_value_hash` only — **never raw field values**.
- `snapshot_type`: `submit` \| `sign` \| `lock` \| `monitoring_review`
- `snapshot_version` — monotonic per `(source_response_id, field_key, snapshot_type)`
- **Immutable** after insert (`block_source_snapshot_updates` trigger; INSERT only grants)

**Helpers:** `lib/source/integrity/`

| Function | Purpose |
|----------|---------|
| `hashFieldValue()` | SHA256 of normalized value slots |
| `captureSourceSnapshot()` | Explicit runtime batch capture |
| `captureSourceSnapshotBestEffort()` | Non-blocking wrapper for submit/sign |
| `verifySourceSnapshot()` | Recompute vs latest `snapshot_version` |
| `verifySourceSnapshotBestEffort()` | Emit violation signal on mismatch (non-blocking) |

**Snapshot vs violation:**

- **Snapshot** — routine capture at lifecycle points; spine event `SOURCE_FIELD_SNAPSHOT_CAPTURED`; OBS `source_field_snapshot_captured` under GOV-1 `source_integrity_snapshot`.
- **Violation** — `verifySourceSnapshot()` finds `mismatch`; spine `SOURCE_INTEGRITY_VIOLATION_DETECTED`; OBS `source_integrity_violation_detected` under GOV-1 `source_integrity_violation`. **Does not block runtime during Phase 16A-2.6.**

**Wiring:** successful submit (`observe-source-api.ts`), procedure sign (`signProcedure.ts`). No lock path unless added later.

---

## Workflow abandonment (Step 3)

- `upsertWorkflowCheckpoint()` — heartbeat
- `detectStaleWorkflows()` — callable for future hourly job
- Emits `WORKFLOW_STALE_ALERT` + OBS `workflow_stale_alert` (GOV-1 `workflow_abandonment_review`)
- No scheduler, no auto-escalation workflows

---

## Role conflict detection (Step 4)

Five global policies (see migration seeds). `checkRoleConflict()` returns policy outcome only — **no global enforcement**. `recordRoleConflictEvent()` persists audit row + `ROLE_CONFLICT_DETECTED`.

---

## OBS-2 integration (Step 5)

Signals: `source_field_snapshot_captured`, `source_integrity_violation_detected`, `workflow_stale_alert`, `role_conflict_detected`.

All hooks use `safeObserve()`, `redactTelemetryMetadata()`, and GOV-1 authority enums only.

---

## Phase 21 prerequisites (Step 6 — documentation only)

See `docs/PHASE-21-PREREQUISITES.md`. No implementation in this phase.

---

## Out of scope

- Monitoring review UI
- Protocol adherence checks
- Data entry velocity anomaly
- Full role conflict resolution UI
- Automatic blocking beyond existing runtime paths
- DB auto-snapshot triggers on `source_responses`

---

## Validation

```bash
npx tsc --noEmit
npm run lint
npm run build
npm run audit-integrity:smoke
git diff --check
```

Apply migrations `0087` then `0088` on each environment before pilot capture paths persist snapshots.
