# Operational Calm Language Guide

**Phase 16G-3** — Coordinator-facing copy standards. Site-internal only; never used for CRA/monitor surfaces.

## Principles

- Reduce cognitive load; one clear next step beats ten warnings.
- Prevention-first: help the coordinator stay ahead of monitor review.
- Recovery-first: assume good intent; recommend continuation paths.
- Never surveillance: no scoring, ranking, or productivity metrics.

## Approved operational language

| Situation | Preferred phrasing |
|-----------|-------------------|
| Unsigned procedure | Signoff pending |
| Incomplete source | Source continuity incomplete |
| Chronology gap | Chronology needs review |
| Blocker open | Completion blocked |
| Stale workflow | Recovery recommended |
| Before SDV | Stabilize before SDV |
| Evidence not ready | Stabilization needed |
| Needs PI | Investigator review needed |
| Prevention queue | Prevention focus |

## Forbidden coordinator-hostile terminology

Do **not** use on command center, study/subject workspace, visit panels, or source capture helper text:

- violation, failure, enforcement, noncompliance
- escalation triggered, monitoring issue, audit problem
- coordinator score, productivity, ranking, surveillance
- you must, non-compliant, failed audit

Use `toCoordinatorSafeOperationalLanguage()` from `lib/coordinator-calm/language.ts` for dynamic strings.

## Prevention-first examples

- Instead of: "Audit finding likely" → "Prevention focus"
- Instead of: "Deviation detected" → "Chronology needs review"
- Instead of: "Source validation failure" → "Source continuity incomplete"

## Stabilization-first examples

- Instead of: "Evidence not compliant" → "Stabilization needed"
- Instead of: "Blocked by policy" → "Completion blocked"
- Instead of: "Monitor will reject" → "Stabilize before SDV"

## Surface audit notes (16G-3)

| Surface | Status |
|---------|--------|
| Command center | Calm applied via `applyOperationalCalmToSiteSurface` |
| Site defense prevention queue | Calm labels in derive + map |
| Operational work queue | Calm labels in `mapOperationalWorkQueue` |
| Source capture | Review helper text when adding new copy |
| Visit runtime panels | Inherit orchestration calm labels |

## Internal-only artifacts

- Friction refinement recommendations (`deriveCalmRefinementRecommendations`)
- Confidence signals (`deriveCoordinatorConfidenceSignals`)
- Warning suppression metrics

Never export these on external DTOs or CRA routes.

## Validation

```bash
npm run operational-calm:smoke
```
