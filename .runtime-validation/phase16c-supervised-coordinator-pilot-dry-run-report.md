# Phase 16C — Supervised Coordinator Pilot Dry Run

**Run at:** 2026-05-24T18:37:59.580Z
**Recommendation:** GO

## Environment

- Supabase: https://xwioewqzapbinvdyjxzm.supabase.co
- App: http://localhost:3000
- Coordinator: calendar.qa.coordinator@vilo-os.staging

## Fixture

```json
{
  "studyId": "6bae715a-8536-4000-8d24-22b6a3dbb8c9",
  "organizationId": "f7cf7d2b-49cd-4bcd-9e15-2675966c3e1e",
  "studySubjectId": "4384b789-4e16-4512-b3f3-50642b3b9735",
  "visitId": "6690da63-4bf1-4681-815a-3e39b7b014bc",
  "coordinatorActorUserId": "d7e43ee5-5c08-489b-b293-8ef288e7fdb7",
  "studySlug": "phase2-validation-study",
  "subjectIdentifier": "PHASE9A-PILOT-001",
  "canonicalSourceDefinitionVersionId": "2ee5a544-fba6-4edb-a5c1-61ba5e2eee00",
  "screeningProcedureDefinitionId": "17059af6-37fa-48a5-9bef-e82b7e2606b1",
  "screeningProcedureExecutionId": "c022a7f6-3bc1-4b81-a19f-8075a4e3a1dc"
}
```

## Results

| Step | Status | Detail |
| --- | --- | --- |
| environment | pass | Staging Supabase + app base http://localhost:3000 |
| preflight.migrations | pass | 0082–0089 tables present |
| projections.before | pass | visit_orch=true visit_ready=true |
| fixture.linkage | pass | PE SDV e0317385-5066-47af-b5dc-c0e4264f49d7 differs from binding 2ee5a544-fba6-4edb-a5c1-61ba5e2eee00; capture uses PE-bound published SDV (pre-capture rows may exist). |
| route.command_center | pass | topActions=4 queueBuckets=4 studies=1 |
| route.study_workspace | pass | risk=attention blockers=1 |
| route.subject_workspace | pass | currentVisit=true openSource=2 |
| auth.coordinator | pass | calendar.qa.coordinator@vilo-os.staging |
| rbac.capture | pass | Pilot coordinator can open/save/submit source via user-scoped API and RPC. |
| api.reachable | pass | HTTP 200 at http://localhost:3000 |
| source.open | pass | HTTP 200 |
| source.save_draft | warn | HTTP 409 |
| source.submit | pass | HTTP 200 |
| integrity.snapshots | pass | 42 snapshot row(s) for response set |
| visit.sign | warn | PE unsigned — coordinator signoff requires supervised UI action (server action; not exercised in API dry run) |
| ux.no_technical_errors | pass | No SQL/constraint leakage in API error envelopes checked |
| runtime.ui | pass | Unsigned procedures |
| obs.telemetry | pass | telemetry=0 workflow signal(s); operational_events=10 for visit |
| obs.no_phi | pass | No PHI patterns in sampled telemetry metadata |
| projections.after | pass | Post-pilot projection snapshot captured |
| preflight.e2e | warn | Overall: degraded (run npm run runtime:e2e:live separately) |

## Friction

- **source.save_draft:** HTTP 409
- **visit.sign:** PE unsigned — coordinator signoff requires supervised UI action (server action; not exercised in API dry run)
- **preflight.e2e:** Overall: degraded (run npm run runtime:e2e:live separately)
