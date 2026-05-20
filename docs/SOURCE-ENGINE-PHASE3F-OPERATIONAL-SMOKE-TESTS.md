# Source Engine Phase 3F — Operational QA Smoke Tests

Automated smoke coverage for Phase 3D–3E operational paths without live Supabase or UI changes.

## Run

```bash
npm run validate:source-engine:operational
```

## Coverage

| Area | Assertions |
|------|------------|
| Template resolution | Published/registry enable `enforceSignatureBlockers`; fallback disables blockers; `engineStatus.resolution` on snapshots |
| Runtime mapping | WOCBP pregnancy visibility; required/disabled/hidden field states; `parseCaptureFormToResponses` skips hidden/disabled required fields |
| Signature gate | Signed edit blocks when enforced; advisory warnings do not block; fallback strips `blocksSignature`; `engine_signature_gate_failed_closed` event |
| Task materialization | One task per blocker; dedupe on repeat; fallback skip unless `source_engine_allow_tasks_on_fallback` |
| Operational events | `engine_signature_blocked`, `engine_tasks_materialized`, `engine_fallback_template_used`; logging failures are non-throwing |

## Implementation

- `lib/source-engine/operational/smoke-tests.ts` — `runOperationalSmokeTests()`
- `scripts/validate-source-engine-operational.ts` — CLI runner
- Mock Supabase injected via optional `supabase` on task materializer and `logSourceEngineOperationalEvent`
