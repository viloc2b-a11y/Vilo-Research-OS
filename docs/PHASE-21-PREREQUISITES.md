# Phase 21 — Prerequisites (Documentation Only)

Phase 21 is **not implemented** in Phase 16A-2.6. This document records explicit prerequisites that must be satisfied before any Phase 21 work begins.

## Required foundations

### 1. Site data sharing consent framework

A regulated consent model for what operational and de-identified metrics may leave a site boundary. Must be separate from internal RBAC and must support audit of consent scope changes.

### 2. Sponsor permission model separate from internal RBAC

Sponsor-facing access cannot be derived solely from org membership roles. Requires an explicit sponsor permission layer (study-scoped grants, expiration, audit trail) distinct from coordinator/PI runtime RBAC.

### 3. Operational metric de-identification layer

Before cross-site or sponsor-visible operational analytics:

- Metric definitions must pass a de-identification review
- Payloads must exclude PHI and re-identification keys
- Aggregation thresholds must be documented (small-N suppression)

## Relationship to Phase 16A-2.6

Pilot audit integrity guardrails (hash snapshots, stale workflow signals, role conflict audit) operate **within** a single organization’s regulated runtime. They do not satisfy Phase 21 cross-boundary requirements and must not be mistaken for sponsor analytics or multi-site data sharing readiness.

## Status

| Prerequisite | Status |
|--------------|--------|
| Site data sharing consent framework | Not started |
| Sponsor permission model | Not started |
| Operational metric de-identification layer | Not started |
