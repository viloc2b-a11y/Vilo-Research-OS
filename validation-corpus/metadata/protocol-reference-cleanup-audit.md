# Protocol Reference Cleanup Audit

**Date:** 2026-06-22  
**Scope:** Full repository scan for hardcoded protocol/study/test identifiers  
**Method:** `ripgrep` across all source files (excluding `node_modules` and `.git`)  
**Total files scanned:** 2,592  

---

## 1. Executive Summary

The repository contains **4 categories** of protocol/study/test references:

| Category | Count | Action |
|----------|-------|--------|
| **Production security layer** (intentional) | ~9 patterns | KEEP — these are sanitization/blocking rules |
| **Dashboard test-data filters** (intentional) | ~12 patterns | KEEP — runtime filters for test data |
| **Smoke/e2e scripts** (one-time or rarely used) | ~8 files | NEEDS_REVIEW — some may be stale |
| **Test fixtures** (automated tests) | ~10 files | KEEP_TEST_FIXTURE — rename to generic |
| **Cleanup scripts** (database maintenance) | ~3 files | KEEP — needed for ongoing DB cleanup |
| **Docs** (historical validation references) | ~5 files | NEEDS_HUMAN_REVIEW |

**No references found** in production UI components, server actions, migrations (except identifier-safety migrations), seed data, or active runtime code.

---

## 2. All Matched Identifiers

| Identifier | Found in | Classification |
|------------|----------|----------------|
| `PARA_OA_012` | `lib/sanitization/forbidden-protocol-tokens.ts` | KEEP — security sanitization |
| `MV40618` | `lib/sanitization/forbidden-protocol-tokens.ts`, `scripts/reader-closure-live.ts` | KEEP (sanitization) + REMOVE (script has hardcoded filename) |
| `baloxavir` / `marboxil` | `lib/sanitization/forbidden-protocol-tokens.ts` | KEEP — security sanitization |
| `STUDY-INF-001` | `lib/sanitization/forbidden-protocol-tokens.ts` (as alias) + migrations 0091, 0178 + docs | KEEP (sanitization) + KEEP_DOCS |
| `GEN_A001`, `GEN_A002`, `GEN_ONC`, `GEN_VAC` | `lib/dashboard-test-data.ts`, `supabase/cleanup/*` | KEEP — intentional test-data filters + cleanup |
| `MV_E2E` | `lib/dashboard-test-data.ts`, `scripts/document-center-e2e-live.ts`, `supabase/cleanup/*` | KEEP (filter) + REMOVE (script) |
| `PARA_E2E` | `scripts/document-center-e2e-live.ts` | REMOVE — one-time smoke script |
| `VPI-STAGING`, `PHASE9A-PILOT`, `VPI seed`, `QA RBAC`, `Reader Closure`, `E2E Upload`, `Operational Calendar Manual Event` | `lib/dashboard-test-data.ts`, `supabase/cleanup/*` | KEEP — test-data filter patterns |
| `VALIDATION_PROTOCOL_001` | `fixtures/validation-protocol-001/runtime-manifest.v1.json`, `fixtures/intake-review/validation-protocol-001/*` | KEEP_TEST_FIXTURE |
| `VALIDATION_PROTOCOL_002` | `fixtures/validation-protocol-002/runtime-manifest.v1.json` | KEEP_TEST_FIXTURE |
| `Phase 2 Validation Host` | `fixtures/validation-protocol-002/runtime-manifest.v1.json` (in display_name) | KEEP_TEST_FIXTURE |
| `approved_intake_draft` | `scripts/phase12d-*`, `scripts/phase12e-*`, `lib/protocol-intake-review/*`, `lib/protocol-intake-publish-prep/*` | KEEP — artifact naming convention, not protocol name |
| `publish_candidate` | Multiple files in `lib/protocol-intake-publish-prep/`, `scripts/` | KEEP — artifact naming convention |
| `protocol_runtime` | 61 files across `lib/`, `app/`, `components/`, `docs/`, `tests/` | KEEP — core architecture term |

---

## 3. Full Match Detail by File

### 3.1 Security Sanitization Layer (KEEP)

**File:** `lib/sanitization/forbidden-protocol-tokens.ts`
```
Lines 5-9:   FORBIDDEN_PROTOCOL_TOKENS array (baloxavir, PARA_OA_012, MV40618, etc.)
Lines 16-24: DEFAULT_PROTOCOL_ALIAS_MAP mapping to generic aliases
```
**Classification:** KEEP  
**Rationale:** This is a deliberate security layer. It blocks real protocol identifiers from being published or exported, and maps them to generic aliases (`STUDY-KOA-001`, `STUDY-INF-001`, etc.). Removing it would expose real protocol names.

---

### 3.2 Dashboard Test-Data Filters (KEEP)

**File:** `lib/dashboard-test-data.ts`
```
Lines 3-14:   DASHBOARD_TEST_DATA_PATTERNS (12 regex patterns)
Lines 16-20:  DASHBOARD_TEST_SOURCE_SET_IDS (5 UUID prefixes)
Lines 22-23:  TEST_CREATED_SOURCES (test_seed, e2e_demo)
```
**Classification:** KEEP  
**Rationale:** These patterns intentionally filter test/staging data from production dashboard views. Removing them would leak smoke/demo data into coordinator dashboards.

---

### 3.3 Database Cleanup Scripts (KEEP)

**Files:**
- `supabase/cleanup/2026-06-09-dashboard-test-data-cleanup.sql`
- `supabase/cleanup/dry_run_report.py`
- `supabase/cleanup/dryrun_report.py`

**Classification:** KEEP  
**Rationale:** These are database maintenance scripts that use the test-data patterns to identify and archive/remove smoke records. They reference all the VPI/PHASE9A/GEN/MV_E2E patterns as SQL regex filters.

---

### 3.4 Smoke/E2E Scripts (NEEDS_REVIEW / REMOVE)

**File:** `scripts/reader-closure-live.ts`
```
Line 35: 'MV40618_eCRF Completion Guidelines_9.0_16Jun2022.pdf',
```
**Classification:** REMOVE  
**Rationale:** Contains a hardcoded document filename with a real protocol identifier (`MV40618`). This is a one-time live test script, not run in CI.

**File:** `scripts/document-center-e2e-live.ts`
```
Line 59: studyPrefix: 'PARA_E2E',
Line 70: studyPrefix: 'MV_E2E',
```
**Classification:** REMOVE  
**Rationale:** One-time E2E smoke scripts with hardcoded study prefixes. Not part of automated test suite.

**Files:** `scripts/phase12d-intake-review-smoke.ts`, `scripts/phase12e-publish-prep-smoke.ts`, `scripts/phase12eb-publish-candidate-review-smoke.ts`
- Reference `approved_intake_draft` and `publish_candidate` as artifact filenames
**Classification:** KEEP  
**Rationale:** These are generic artifact naming conventions, not protocol-specific names. The smoke test framework uses descriptive filenames. However, they reference real protocol documents that may contain real names.

**File:** `scripts/document-center-generalization-batch.ts`
```
No protocol-specific identifiers found — uses dynamic study/org IDs.
```
**Classification:** KEEP  

---

### 3.5 Test Fixtures (KEEP_TEST_FIXTURE)

**Files:**
- `fixtures/validation-protocol-001/runtime-manifest.v1.json` — `protocol_id: "VALIDATION_PROTOCOL_001"`, references `PARA_*` visit codes
- `fixtures/validation-protocol-002/runtime-manifest.v1.json` — `protocol_id: "VALIDATION_PROTOCOL_002"`, display_name includes "Phase 2 Validation Host"
- `fixtures/intake-review/validation-protocol-001/*` — 9 JSON/MD files with `VALIDATION_PROTOCOL_001` references
- `fixtures/protocol-intake/validation-protocol-001-excerpt.txt` — text excerpt

**Classification:** KEEP_TEST_FIXTURE  
**Rationale:** These are deliberate test fixtures for automated protocol intake, reconciliation, and runtime generation tests. The names could be renamed to generic identifiers (e.g., `FI-X-001`) but this requires updating all test code that references these paths.

---

### 3.6 Protocol Identifier Migrations (KEEP)

**Files:**
- `supabase/migrations/0091_protocol_identifier_runtime_sanitization.sql` — creates sanitization infrastructure
- `supabase/migrations/0178_protocol_identifier_canonical_update.sql` — update canonical identifiers

**Classification:** KEEP  
**Rationale:** These are applied migrations that implement the protocol identifier sanitization layer. They reference the alias map (`STUDY-INF-001`, etc.) as part of the sanitization logic.

---

### 3.7 Documentation (NEEDS_HUMAN_REVIEW)

**Files:**
- `docs/MV40618-OPERATIONAL-11F-B.md` — full protocol reference
- `docs/PHASE-12A-CANONICAL-CLINICAL-LIBRARY.md` — references STUDY-INF-001
- `docs/H5-E2E-VALIDATION-PLAN.md` — references STUDY-INF-001
- `docs/PHASE-12D-INTAKE-REVIEW.md` — references approved_intake_draft
- `docs/PHASE-12E-CONTROLLED-PUBLISH.md` — references publish_candidate
- `docs/HARDENING-ACTION-INVENTORY.md` — references publish_candidate
- `docs/VILO-OS-GOVERNANCE-RUNTIME-REPORT.md` — references protocol_runtime_versions

**Classification:** NEEDS_HUMAN_REVIEW  
**Rationale:** Some docs explain historical validation runs with real protocol names. These should be reviewed individually to determine if they should be archived, redacted, or kept.

---

### 3.8 No Matches Found

The following identifiers from the search scope had **zero matches** in the codebase:
- `Centerstone`
- `03256`, `03256-Fake`
- `Fake Clinical Trial`, `Fake Study`, `FakeStudy`, `FAKE_STUDY`
- `sample protocol`, `sample study`, `SampleStudy`
- `demo study`, `demo readiness`, `DemoStudy`
- `validation host` (except in fixture display_name)
- `runtime manifest`, `parser extraction result`
- `schedule of events` (as a hardcoded protocol reference)
- `fixture protocol`, `test protocol`

---

## 4. Classification Summary

| Classification | Count | Description |
|---------------|-------|-------------|
| KEEP | 4 | Security sanitization, dashboard filters, cleanup scripts, artifact naming |
| KEEP_TEST_FIXTURE | 2 | Test fixture manifests (`VALIDATION_PROTOCOL_001/002`) + intake review fixtures |
| REMOVE | 3 | One-time smoke scripts with hardcoded identifiers |
| NEEDS_HUMAN_REVIEW | 7 | Documentation files referencing real protocols |
| KEEP_DOCS | — | Docs that explain architecture (not protocol-specific) |

---

## 5. Risk Notes

1. **Security sanitization must NOT be removed.** The forbidden-protocol-tokens.ts file is the only thing preventing real protocol identifiers from leaking through publish/export.
2. **Dashboard test-data filters must NOT be removed.** They prevent smoke/demo data from appearing in coordinator dashboards.
3. **Scripts referenced are NOT CI-automated.** `scripts/reader-closure-live.ts`, `scripts/document-center-e2e-live.ts` are manual one-time scripts. `scripts/phase12*` files are smoke-test scaffolding scripts.
4. **Fixture renames would be breaking.** Renaming `VALIDATION_PROTOCOL_001` to a generic name requires updating all test code that references these fixtures by path/name. The fixture names themselves are already generic (`VALIDATION_PROTOCOL_001` is clearly not a real protocol).
5. **Docs may contain real protocol data.** `docs/MV40618-OPERATIONAL-11F-B.md` appears to document a real protocol operationally. This needs human review before any action.
6. **`approved_intake_draft` and `publish_candidate` are NOT protocol names.** They are artifact/metadata naming conventions used by the intake and publish-prep pipelines. Renaming them would be a breaking change across the intake-publish pipeline.

---

## 6. Proposed Cleanup Plan

### Phase 1 — Safe removals (no risk)

| File | Action |
|------|--------|
| `scripts/reader-closure-live.ts` | Remove file — contains hardcoded MV40618 filename |
| `scripts/document-center-e2e-live.ts` | Remove file — contains hardcoded PARA_E2E/MV_E2E study prefixes |

### Phase 2 — Script cleanup (low risk)

| File | Action |
|------|--------|
| `scripts/phase12d-intake-review-smoke.ts` | Review for hardcoded protocol references in test data |
| `scripts/phase12e-publish-prep-smoke.ts` | Review for hardcoded protocol references |
| `scripts/phase12eb-publish-candidate-review-smoke.ts` | Review for hardcoded protocol references |
| `scripts/protocol-safety-smoke.ts` | Review for hardcoded references |

### Phase 3 — Fixture audit (medium risk, needs test validation)

| Directory | Action |
|-----------|--------|
| `fixtures/validation-protocol-001/` | Rename to generic fixture name + update all test references |
| `fixtures/validation-protocol-002/` | Rename to generic fixture name + update all test references |
| `fixtures/intake-review/validation-protocol-001/` | Rename path + update intake test references |
| `fixtures/protocol-intake/validation-protocol-001-excerpt.txt` | Rename + update protocol-intake test references |

### Phase 4 — Doc review (human decision)

| File | Action |
|------|--------|
| `docs/MV40618-OPERATIONAL-11F-B.md` | Human review — may contain real protocol data |
| `docs/H5-E2E-VALIDATION-PLAN.md` | Human review — references STUDY-INF-001 |
| `docs/PHASE-12A-CANONICAL-CLINICAL-LIBRARY.md` | Human review — references STUDY-INF-001 |

---

## 7. Appendix: Command Output

```
rg search patterns used:
  PARA_OA_012, MV40618, Centerstone, baloxavir, marboxil,
  GEN_A001, GEN_A002, GEN_ONC, GEN_VAC, MV_E2E, STUDY-INF-001,
  VALIDATION_PROTOCOL, Phase 2 Validation Host,
  VPI-STAGING, PHASE9A-PILOT, VPI seed, QA RBAC, Reader Closure, E2E Upload,
  approved_intake_draft, publish_candidate,
  Fake Study, Fake Clinical Trial, 03256,
  sample protocol, sample study, test protocol, fixture protocol,
  demo study, demo readiness, validation host,
  runtime manifest, parser extraction, schedule of events

Total unique identifier matches: 15
Total files with matches: ~35
Files scanned: 2,592
```
