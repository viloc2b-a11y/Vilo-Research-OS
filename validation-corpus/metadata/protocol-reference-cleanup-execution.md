# Protocol Reference Cleanup — Execution Report

**Date:** 2026-06-22  
**Based on audit:** `validation-corpus/metadata/protocol-reference-cleanup-audit.md`

---

## Files Deleted

| File | Reason | Classification |
|------|--------|---------------|
| `scripts/reader-closure-live.ts` | Hardcoded `MV40618` document filename. One-time live test script, not CI-automated, not imported by any other file. | SAFE_TO_DELETE |
| `scripts/document-center-e2e-live.ts` | Hardcoded `PARA_E2E` and `MV_E2E` study prefixes for test study creation. One-time smoke script, not imported by any other file. | SAFE_TO_DELETE |

### Pre-deletion import check

- `rg "reader-closure-live" --glob '!node_modules' --glob '!scripts/'` → **no results**
- `rg "document-center-e2e-live" --glob '!node_modules' --glob '!scripts/'` → **no results**
- Cross-references within `scripts/` → **no results**

Both scripts were standalone runner scripts. No imports, no consumers. Safe to delete.

---

## Files Intentionally Kept

| File | Rationale |
|------|-----------|
| `lib/sanitization/forbidden-protocol-tokens.ts` | Security sanitization layer — blocks real protocol identifiers from publish/export |
| `lib/dashboard-test-data.ts` | Runtime test-data filter — prevents smoke data from appearing in production dashboards |
| `supabase/cleanup/2026-06-09-dashboard-test-data-cleanup.sql` | Database maintenance tool — identifies and archives test records |
| `supabase/cleanup/dry_run_report.py` | Database maintenance tool — dry-run reporting |
| `supabase/cleanup/dryrun_report.py` | Database maintenance tool — dry-run reporting |
| `fixtures/validation-protocol-001/` | Test fixture — used by automated protocol intake/runtime tests |
| `fixtures/validation-protocol-002/` | Test fixture — used by automated protocol intake/runtime tests |
| `fixtures/intake-review/validation-protocol-001/` | Test fixture — used by intake review tests |
| `fixtures/protocol-intake/validation-protocol-001-excerpt.txt` | Test fixture — used by protocol-intake tests |
| `supabase/migrations/0091_*.sql` | Applied migration — implements protocol identifier sanitization |
| `supabase/migrations/0178_*.sql` | Applied migration — canonical identifier update |
| `scripts/phase12d-intake-review-smoke.ts` | Smoke test scaffolding — uses generic artifact names, not protocol names |
| `scripts/phase12e-publish-prep-smoke.ts` | Smoke test scaffolding — uses generic artifact names, not protocol names |
| `scripts/phase12eb-publish-candidate-review-smoke.ts` | Smoke test scaffolding — uses generic artifact names, not protocol names |
| `scripts/protocol-safety-smoke.ts` | Smoke test — tests the forbidden-protocol-tokens sanitization layer itself |

---

## Files Requiring Human Review (Not Modified)

| File | Reason |
|------|--------|
| `docs/MV40618-OPERATIONAL-11F-B.md` | Contains real protocol operational documentation. Needs human decision on archival vs redaction. |
| `docs/H5-E2E-VALIDATION-PLAN.md` | References STUDY-INF-001 in validation plan context. |
| `docs/PHASE-12A-CANONICAL-CLINICAL-LIBRARY.md` | References STUDY-INF-001 as part of clinical library documentation. |

---

## Validation Results

| Check | Result |
|-------|--------|
| `git status` | ✅ 2 deleted files staged, no unexpected changes |
| `npx tsc --noEmit` | ✅ **Clean** (0 errors) |
| `npx vitest run` | ✅ **531/532 passed** (1 pre-existing failure: `subject-runtime-completion.test.ts` — unrelated to cleanup) |

### Test impact

All test suites remain at baseline:
- No new failures
- No regressions
- No test files depend on the deleted scripts

---

## Remaining Known Protocol References

After this cleanup, the remaining protocol references in the codebase fall into **4 intentional categories**:

### 1. Security Sanitization (`lib/sanitization/forbidden-protocol-tokens.ts`)
- `PARA_OA_012`, `MV40618`, `baloxavir marboxil`, etc.
- **Purpose:** Block real identifiers from publish/export by mapping them to generic aliases (`STUDY-KOA-001`, `STUDY-INF-001`, `Compound-X`, etc.)
- **Action:** KEEP — removing would expose real protocol names.

### 2. Dashboard Test-Data Filters (`lib/dashboard-test-data.ts`)
- `VPI-STAGING`, `PHASE9A-PILOT`, `VPI seed`, `QA RBAC`, `Reader Closure`, `E2E Upload`, `MV_E2E`, `GEN_A001`, `GEN_A002`, `GEN_ONC`, `GEN_VAC`, `Operational Calendar Manual Event`
- **Purpose:** Filter test/smoke data from coordinator-facing dashboards
- **Action:** KEEP — removing would leak demo data into prod views.

### 3. Database Cleanup Tooling (`supabase/cleanup/`)
- Same pattern list as #2 above
- **Purpose:** SQL/Python tooling to identify and archive test records in the database
- **Action:** KEEP — needed for ongoing database maintenance.

### 4. Test Fixtures (`fixtures/validation-protocol-001/`, `fixtures/validation-protocol-002/`)
- `VALIDATION_PROTOCOL_001`, `VALIDATION_PROTOCOL_002`, `Phase 2 Validation Host`
- **Purpose:** Test data for automated protocol intake, reconciliation, and runtime generation tests
- **Action:** KEEP_TEST_FIXTURE — names are already generic (clearly not real protocols). Renaming would require updating test code.

### 5. Smoke Test Scripts (`scripts/phase12*.ts`, `scripts/protocol-safety-smoke.ts`)
- Reference `approved_intake_draft`, `publish_candidate` as artifact naming conventions
- **Purpose:** Smoke test scaffolding for the protocol intake → publish pipeline
- **Action:** KEEP — these are generic artifact names, not protocol identifiers.

---

## Summary

```
┌─────────────────────────────────────────────────────────────────┐
│  Protocol Reference Cleanup                                     │
├─────────────────────────────────────────────────────────────────┤
│  Files deleted:          2                                      │
│  Files kept (intentional): ~20                                  │
│  Files needing human review: 3 (docs)                           │
│  Tests passed:            531/532                               │
│  TypeScript:              clean                                 │
│  Regressions:             none                                  │
└─────────────────────────────────────────────────────────────────┘
```

No commit has been made yet. Review this report and approve the commit when ready.
