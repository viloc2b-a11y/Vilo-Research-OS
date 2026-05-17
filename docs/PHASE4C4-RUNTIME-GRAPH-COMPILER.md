# Phase 4C.4 — Deterministic CPST Runtime Graph Compiler (skeleton)

**Status:** Implemented (skeleton — no source definition generation).

**Parents:** [`PHASE4C3B-WORKBOOK-IMPORT-VALIDATOR.md`](./PHASE4C3B-WORKBOOK-IMPORT-VALIDATOR.md) · [`PHASE4C1-DOMAIN-MODULE-REGISTRY-RUNTIME-GRAPH.md`](./PHASE4C1-DOMAIN-MODULE-REGISTRY-RUNTIME-GRAPH.md)

**Core principle:** The compiler is **deterministic**. Same schema version + same canonicalized CPST rows ⇒ same `graph_id`, node IDs, edge IDs, and `input_hash`. No random IDs, no silent inference.

**Baseline:** GREEN Phase **3C** unchanged. Phase **4B** migrations unchanged.

---

## A. Purpose

Convert a **validated import bundle** into a **Canonical Runtime Graph (CRG)** JSON artifact for downstream source-definition compilation (future Phase 4C.5+).

```text
cpst-workbook-v3.import.json  →  compile-cpst-runtime-graph.mjs  →  cpst-runtime-graph.json
```

---

## B. Input/output

| Argument | Default |
|----------|---------|
| `--input` | `tmp/imports/cpst-workbook-v3.import.json` |
| `--output` | `tmp/compiled/cpst-runtime-graph.json` |
| `--strict` | Exit `1` when `validation_report.validation_status === invalid` |

```bash
npm run compile:graph
```

Reads `cpst_bundle` (falls back to `data`). Does **not** mutate import rows.

---

## C. Determinism rules

| Rule | Implementation |
|------|----------------|
| Canonical input | Stable-sort arrays; normalize null/empty; exclude `x_vilo_provenance` / `_` fields |
| `input_hash` | `sha256:` + SHA-256 of stable JSON string |
| `graph_id` | `CRG-` + first 4 hex chars of hash |
| Node ID | `node_<Type>_<12-char hash>` from `nodeType + schema_version + dictionary + source_row_id` |
| Edge ID | `edge_<type>_<12-char hash>` from `edgeType + schema_version + from + to + source_row_id` |
| Output order | Nodes and edges sorted by `id` ascending |
| Self-check | Double-compile compares `graph_id`, node IDs, edge IDs |

`compiled_at` is informational only (excluded from determinism check).

---

## D. Canonicalization strategy

1. Copy `cpst_bundle` arrays (exclude `runtime_support`).
2. Sort each array by technical ID field (composite sort for `value_lists`).
3. Trim strings; drop empty strings; omit nulls.
4. Sort `domain_modules` keys and rows by `module_row_id`.
5. Hash canonical object → `input_hash`.

---

## E. Node mapping

| Dictionary | Node type |
|------------|-----------|
| Study_Setup | StudyTemplateNode |
| Audit_and_Versioning | VersionNode |
| Visit_Groups | VisitGroupNode |
| Visit_Templates | VisitNode |
| Procedure_Library | ProcedureNode |
| Field_Definitions | FieldNode |
| Conditional_Rules | RuleNode |
| Schedule_Windows | WindowNode |
| External_Source_Map | ExternalSourceNode |
| Substudy_Map | SubstudyNode |
| Roles_Signoff | RoleNode |
| Domain module rows | DomainModuleNode |
| Visit_Procedure_Matrix | RuntimeExpectationNode |
| Procedure `signature_required` / matrix `signature_override` | SignatureRequirementNode |
| Field validation / required | ValidationRuleNode |

---

## F. Edge mapping

| Relationship | Edge type |
|--------------|-----------|
| Study → visit groups / procedures | `contains` |
| Visit group → visits | `contains` |
| Visit ↔ procedure (matrix) | `assigned_to_visit` / `requires` / `optional_for` |
| Visit → window | `occurs_within` |
| Procedure → external source | `sourced_from` |
| Substudy → visit/procedure | `applies_to_cohort` |
| Rule → target / expectation | `conditional_on`, `triggers` |
| Role → procedure / signature | `reviewed_by`, `signed_by` |
| Field → procedure | `belongs_to` |
| Expectation → field | `generates_source` |
| Domain → study/visit/procedure | `belongs_to`, `assigned_to_visit`, `requires` |
| Version chain | `supersedes` |

Missing targets → **error** (no silent inference).

---

## G. Validation report

`validation_status`: `valid` | `warning` | `invalid`

| Code | Severity |
|------|----------|
| `EMPTY_CPST_BUNDLE` | warning |
| `NO_STUDY_SETUP` | warning |
| `MISSING_STUDY_SETUP` | error |
| `DUPLICATE_TECHNICAL_ID` | error |
| `MATRIX_*` / `DOMAIN_*` / `FIELD_*` | error |
| `CONDITIONAL_WITHOUT_RULE` | error |
| `EXTERNAL_MAP_MISSING` | error |
| `SIGNATURE_NO_SIGNER` | error |
| `WINDOW_MIN_GT_MAX` | error |

---

## H. Provenance model

Each node/edge includes `provenance`:

- `source_dictionary`, `source_row_id`, `source_field_refs`
- `schema_version`, `input_hash`

Top-level `provenance_map` keyed by node/edge `id`.

---

## I. Current limitations

- No **source definition** / Phase 4A persistence
- No cross-bundle FK closure (e.g. Value_Lists membership)
- `Value_Lists` rows do not create graph nodes
- `runtime_support.visit_execution_log` excluded from compile input
- Rule `trigger_entity=field` not fully resolved to FieldNode
- Compiler skeleton does not validate against `Canonical_Runtime_Graph.schema.json` (AJV deferred)

---

## J. Exact next step

1. **Golden CPST fixture** — minimal valid rows for integration tests  
2. **Source Definition Compiler** — CRG → `Compiler_Output` (Phase 4C.5)  
3. **Publish gate** — require `validation_status !== invalid` + human approval  

---

*Regulatory-informed engineering posture only.*
