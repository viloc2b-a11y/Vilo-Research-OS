# Site Defense Runtime Layer

**Mission:** Protect the coordinator and site; resolve operational risk before CRA/CRO monitoring escalates.

Vilo OS is a **Site Execution Operating System** — not sponsor-first, not CRA-first.

## Internal risk detection

`lib/site-defense/risk-detection` derives site-only findings from projection counts:

| Category | Trigger |
|----------|---------|
| unsigned_procedure | Unsigned completed procedures |
| missing_signature | Missing signature coverage |
| stale_workflow | Stale workflow steps |
| temporal_inconsistency | Chronology gaps |
| source_integrity_mismatch | Integrity mismatch |
| unresolved_blocker | Open governance/ops blockers |
| overdue_source_completion | Incomplete/overdue source |
| pi_sub_i_bottleneck | PI/Sub-I or delegation gaps |
| workload_accumulation | Coordinator open-item overload |

## Pre-monitor remediation queue (internal only)

Buckets (`lib/site-defense/prevention-queue`):

1. `resolve_before_sdv`
2. `high_deviation_risk`
3. `signature_risk`
4. `missing_source_continuity`
5. `unresolved_escalation`
6. `monitor_likely_finding`
7. `inspection_risk`

Mapped to coordinator **Finding prevention** bucket via `mapSiteDefensePreventionQueueToCoordinatorBucket`.

## Finding prevention signals (internal only)

| Signal | Meaning |
|--------|---------|
| `likely_monitor_query` | Monitor may ask about this evidence |
| `likely_source_finding` | Source completeness/query risk |
| `likely_deviation` | Temporal/protocol deviation risk |
| `likely_signature_finding` | Signoff finding risk |
| `likely_sdv_mismatch` | SDV alignment risk |

All signals carry `visibility: site_internal_only`.

## Coordinator protection

`COORDINATOR_PROTECTION_RULES` — max 5 visible actions, dedupe, plain-language next steps, no technical noise, external actors denied.

## Runtime stabilization

| State | External access |
|-------|-----------------|
| `unstable` | Denied |
| `stabilizing` | Denied |
| `reviewed` | Denied |
| `finalized_for_external_review` | Allowed (site-reviewed evidence only) |

Gates: `lib/site-defense/site-review`, `lib/external-access/site-defense-gate.ts`.

## External visibility

CRA/monitor never receive signals, queues, replay review, or raw runtime. See `docs/CRA_ACCESS_BOUNDARY.md`.

## Validation

```bash
npm run site-defense:smoke
npm run cra-access:smoke
```
