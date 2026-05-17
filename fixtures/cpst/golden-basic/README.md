# Golden Basic CPST Fixture

## Purpose

Minimal **realistic ambulatory study schedule** for end-to-end validation of the manual CPST path:

```text
JSON Schemas → Workbook v3 → Import JSON → Canonical Runtime Graph
```

Fixture ID: **ST-001** · CPST version **v1.0.0** · Schema **1.0.0**

## Schedule represented

| Phase | Visits | Procedures (high level) |
|-------|--------|-------------------------|
| Screening (VG-001) | V-001 | Consent, eligibility, vitals, conmeds, labs |
| Treatment / Baseline (VG-002) | V-002 Day 1 | Eligibility, vitals, conmeds, AE, IP, ePRO |
| Follow-up (VG-003) | V-003 | Vitals, conmeds, AE, labs, ePRO |
| Closeout (VG-004) | V-004 EOS, V-005 ET | AE, labs, disposition, ET reason |

**Windows:** Screening Day -30..-1; Day 1 fixed; Follow-up Day 7 ±2; EOS Day 30 ±7; ET unscheduled.

**Rules:** SAE → investigator review (R-001); ET → termination reason + EOS disposition (R-002); abnormal labs → review (R-003).

## Fixture rows included

| Dictionary | Rows |
|------------|------|
| Study_Setup | 1 |
| Audit_and_Versioning | 1 (`needs_review` — no fake UUIDs) |
| Visit_Groups | 4 |
| Visit_Templates | 5 |
| Procedure_Library | 10 |
| Visit_Procedure_Matrix | 25 |
| Conditional_Rules | 3 |
| Schedule_Windows | 5 |
| External_Source_Map | 2 |
| Roles_Signoff | 7 |
| Value_Lists | 22 items |
| Field_Definitions | 22 |
| Domain: ePRO_Workflows | 1 |
| Domain: EDC_Reconciliation | 1 |

## Expected graph behavior

- **StudyTemplateNode** + **VersionNode** + visit/procedure/field/rule/window graph
- **25 RuntimeExpectationNode** from matrix
- **SignatureRequirementNode** for P-001, P-005, P-007, P-009
- **ValidationRuleNode** per field with validation/required metadata
- Edges: `contains`, `requires`, `assigned_to_visit`, `occurs_within`, `sourced_from`, `conditional_on`, `signed_by`, `generates_source`, domain `belongs_to`

## Commands

```bash
npm run schemas:validate

node scripts/compile-cpst-runtime-graph.mjs \
  --input fixtures/cpst/golden-basic/cpst-golden-basic.import.json \
  --output tmp/compiled/cpst-runtime-graph.golden-basic.json
```

Or: `npm run compile:graph:golden`

## Expected validation status

- **`valid`** or **`warning`** only (no errors)
- Non-zero **nodes** and **edges**
- Deterministic **`input_hash`** and **`graph_id`** across repeated compiles

## Known limitations

- Hand-authored import JSON (not exported from workbook); use to validate compiler/graph logic
- `approval_state: needs_review` — publish fields intentionally omitted
- Value list items for field option codes (e.g. `AE_SEVERITY`) not fully expanded
- `Value_Lists` rows do not create CRG nodes (by design in compiler skeleton)
- No `Visit_Execution_Log` rows (runtime support only)

## Files

| File | Role |
|------|------|
| `cpst-golden-basic.import.json` | Validated CPST bundle (import shape) |
| `../../tmp/compiled/cpst-runtime-graph.golden-basic.json` | Compiled CRG output (generated) |
