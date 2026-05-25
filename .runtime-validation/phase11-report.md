# Phase 11 Runtime E2E — DEGRADED

Run: 2026-05-25T00:59:37.772Z
Mode: hybrid

## Pilot scope
- Study: 6bae715a-8536-4000-8d24-22b6a3dbb8c9
- Subject: 4384b789-4e16-4512-b3f3-50642b3b9735
- Visit: 6690da63-4bf1-4681-815a-3e39b7b014bc

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
- [PASS] **No silent mutation breaks the chain (static audit)** — No unapproved direct-mutation blockers in lib/ (33 findings, 26 warnings).
- [PASS] **Runtime actions emit operational_events (live visit)** — 34 operational_event(s) for visit.
- [PASS] **Events / compute refresh derived projections** — visit_readiness_projections: blocked, 2 blocker(s)
- [WARN] **Protocol graph blockers appear in readiness** — readiness=blocked (no graph blockers — OK if visit ready)
- [WARN] **Safety/governance blockers carry forward** — 0 projection blocker(s), safetyBlockerCount=0
- [PASS] **Replay explains blocked readiness** — signatures: Unsigned procedures; completion: Visit completion blocked
- [PASS] **Financial leakage derives correctly** — leakage_score=11, items=2
- [PASS] **Coordinator next action appears** — Unsigned procedures
- [PASS] **Automation proposal can be applied (supervised)** — 4 proposed; pending=4; applied=0
- [PASS] **UI model surfaces runtime intelligence** — next="Unsigned procedures", readiness=blocked
- [WARN] **No silent mutation breaks the chain (live integrity)** — integrity overall=critical; visit replay gaps=0

## Recommended fixes before real pilot
- Run npm run integrity:audit:strict and clear blocker paths before production pilot.
- Apply migrations 0076–0081 on staging; verify visit_readiness + orchestration + automation tables.
- Use PHASE11_* env vars with a PARA pilot subject that has blocked visit state for full live validation.
- Coordinator must explicitly apply automation — never expect blind apply on projection refresh.