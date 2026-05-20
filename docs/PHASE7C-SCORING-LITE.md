# Phase 7C — VPI Scoring Lite

**Status:** Complete  
**Depends on:** [PHASE7B-SQL-AGGREGATION.md](./PHASE7B-SQL-AGGREGATION.md)

## Objective

Map Phase 7B `subject_risk_signals` and `study_health` rows into four operational states (`healthy`, `watch`, `risk`, `critical`) with a controlled recommended-action vocabulary. No rules engine, no config tables, no charts.

## Module layout

```
lib/performance/scoring/
├── types.ts
├── subject-scoring.ts
├── study-scoring.ts
├── recommended-actions.ts
├── risk-queue.ts
├── enrich-read-model.ts
├── flags.ts
└── index.ts
```

## Rules (hardcoded)

### Subject (`signal_kind`)

| State | Signals |
|-------|---------|
| critical | `blocked_procedure`, `missed_visit`, `out_of_window` |
| risk | `overdue_action`, `window_closing_today` |
| watch | `unsigned_procedure_48h`, `window_warning`, `stale_subject` |

### Study (`study_health` metrics)

| State | Condition |
|-------|-----------|
| critical | `blocked_procedure_count > 0` OR `missed_visit_count > 2` |
| risk | `open_query_count > 5` OR `open_findings_count > 3` |
| watch | `unsigned_over_48h_count > 0` OR `visits_closing_window_today > 0` OR `stale_study_flag` |
| healthy | otherwise |

## Recommended actions (controlled vocabulary)

`contact_subject_today`, `resolve_blocked_validation`, `obtain_pi_signature`, `reschedule_visit`, `review_open_query`, `triage_assignment`, `review_stale_study`

## Risk queue

1. Score signals per subject  
2. **Dedupe** by `studyId:subjectId` (highest `priorityRank`, tie → older `sortDate`)  
3. **Sort** critical → risk → watch → healthy, then `sortDate`  
4. Map to legacy `SubjectRiskSeverity` for existing UI (`critical` / `attention` / `warning`)  
5. `priorityRank` is internal only — never rendered

## Read paths

| Mode | Risk queue | Study cards |
|------|------------|-------------|
| RPC | `buildScoredRiskQueueFromVpiRows` | `enrichStudyCardFromVpiRow` |
| Fallback | `buildFallbackSubjectSignals` → `buildScoredRiskQueueFromSignals` | `enrichStudyCardFromHealth` (partial metrics) |

## Validation

```bash
npm run db:validate-phase7c-scoring
npx tsc --noEmit
npm run build
```

## Out of scope

- Configurable thresholds / `vpi_rule_thresholds`
- Charts and trends
- Command center routes (Phase 7E)
