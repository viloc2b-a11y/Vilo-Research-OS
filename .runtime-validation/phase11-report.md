# Phase 11 Runtime E2E — PASS

Run: 2026-06-04T00:48:18.786Z
Mode: offline

## Pilot scope
- Study: n/a
- Subject: n/a
- Visit: n/a

## Chain checks
- [PASS] **Runtime actions emit operational_events** — Automation spine event types registered in GATEWAY_EMITTED_EVENT_TYPES.
- [PASS] **Protocol graph blockers appear in readiness** — Graph-category blockers on synthetic blocked visit.
- [PASS] **Safety/governance blockers carry forward** — 2 safety/governance blocker(s).
- [PASS] **Replay explains blocked readiness** — protocol_graph: Graph dependency; safety_continuity: Unresolved AE; source: Unresolved CBC
- [PASS] **Financial leakage derives correctly** — 7 leakage item(s), score 67.
- [PASS] **Coordinator next action appears** — Unresolved AE
- [PASS] **Automation proposal can be applied (supervised)** — 12 proposed action(s); coordinator supervised.
- [PASS] **UI model surfaces runtime intelligence** — next="Unresolved AE", blocked=true.
- [PASS] **Events / compute refresh derived projections** — Enrich chain wired in visit-readiness compute (phases 3–10 integration smokes).
- [PASS] **No silent mutation breaks the chain (static audit)** — No unapproved direct-mutation blockers in lib/ (40 findings, 28 warnings).

## Recommended fixes before real pilot
- Run npm run integrity:audit:strict and clear blocker paths before production pilot.
- Apply migrations 0076–0081 on staging; verify visit_readiness + orchestration + automation tables.
- Use PHASE11_* env vars with a PARA pilot subject that has blocked visit state for full live validation.
- Coordinator must explicitly apply automation — never expect blind apply on projection refresh.