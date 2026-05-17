# Phase 4C.5 — Source Definition Compiler (skeleton)

**Status:** Implemented (skeleton — no database persistence).

**Parents:** [`PHASE4C4-RUNTIME-GRAPH-COMPILER.md`](./PHASE4C4-RUNTIME-GRAPH-COMPILER.md) · [`PHASE4C2-CANONICAL-JSON-SCHEMAS.md`](./PHASE4C2-CANONICAL-JSON-SCHEMAS.md)

**Core principle:** The **Canonical Runtime Graph (CRG)** is the orchestration model. Source definitions are generated **deterministically** from CRG nodes and edges. Every section, field, rule, and requirement traces to CRG nodes and original dictionary provenance.

**Baseline:** GREEN Phase **3C** unchanged. Phase **4B** migrations unchanged.

---

## A. Purpose

```text
cpst-runtime-graph.json  →  compile-source-definitions.mjs  →  source-definitions.json
```

Produces compiler output aligned with `Compiler_Output.schema.json` (extended skeleton fields + schema-compatible subsets).

---

## B. Input/output

| Argument | Default |
|----------|---------|
| `--input` | `tmp/compiled/cpst-runtime-graph.golden-basic.json` |
| `--output` | `tmp/compiled/source-definitions.golden-basic.json` |
| `--strict` | Exit `1` when `validation_status === invalid` |

```bash
npm run compile:source:golden
```

Golden pipeline:

```bash
npm run compile:graph:golden
npm run compile:source:golden
```

---

## C. Determinism

| Input | Role |
|-------|------|
| `graph_id` | Prefix for all generated IDs |
| `input_hash` | From CRG; copied to every artifact |
| `compiler_version` | `0.1.0` |

ID pattern: `{prefix}_{graph_id}_{12-char-sha256(parts)}`

Double-compile compares SDV and field ID sets — must match byte-for-byte.

---

## D. Source definition version strategy

**One `source_definition_version` per `VisitNode`** (sorted by `visit_id`).

Includes: visit metadata, `study_template_id`, `protocol_version`, `source_status: draft_generated`, compiler metadata, provenance from visit node.

Schema-compatible fields: `instrument_code` (= visit code), `version_label` (= CPST version), `status: draft`.

---

## E. Section generation

For each visit → procedures via CRG edges:

`assigned_to_visit` | `requires` | `optional_for` (visit → procedure)

One **source section** per (visit, procedure) pair, ordered by matrix `execution_order` from `RuntimeExpectationNode` when present.

Section metadata from `ProcedureNode` payload + matrix marker → `required_status`.

---

## F. Field generation

Fields **only** from `FieldNode` linked to procedure:

- `belongs_to` edges (field → procedure)
- `Field_Definitions.procedure_id` match

No synthetic fields. Each field carries dictionary payload: labels, types, validation, export names, provenance.

---

## G. External source strategy

When `source_type` is `external` or `device_vendor`:

- Emit `external_source_requirements` from `ExternalSourceNode` + `sourced_from` edges
- `capture_strategy: metadata_reference_only` (no full clinical duplicate)
- Error if external procedure has no external map node

`operational_confirmation` procedures use internal/operational capture paths without external requirement rows.

---

## H. Validation / workflow / signature generation

| Output | Source |
|--------|--------|
| `validation_rules` | `ValidationRuleNode` + field required/expression |
| `conditional_rules` | `RuleNode` payloads |
| `workflow_requirements` | Rule `workflow_hook` + domain module hooks (e.g. ePRO rescue) |
| `signature_requirements` | Sections with `signature_required` + `Roles_Signoff` `can_sign` on procedure scope |
| `runtime_expectations` | `RuntimeExpectationNode` per visit×procedure |

---

## I. Provenance model

`provenance_map` keyed by generated artifact ID. Each entry includes:

- `source_dictionary`, `source_row_id`, `source_field_refs`
- `schema_version`, `input_hash`
- `crg_node_id` / `crg_edge_id` when applicable

---

## J. Current limitations

- No write to Phase **4A** `source_definition_versions` / `source_fields` tables
- No AJV validation against `Compiler_Output.schema.json` yet
- Field visibility rules not fully resolved to target field IDs
- `detailed_capture_required` heuristic for internal vs external
- One SDV per visit (not per study-wide instrument bundle)
- Schedule window rules not yet emitted as validation_rules

---

## K. Exact next step

1. **Golden CI gate** — `compile:graph:golden` + `compile:source:golden` in CI  
2. **Phase 4A persist adapter** — map compiler output → DDL (approved publish only)  
3. **Parser mapping** — `PHASE4C3-PARSER-MAPPING-PLAN.md`  

---

*Regulatory-informed engineering posture only.*
