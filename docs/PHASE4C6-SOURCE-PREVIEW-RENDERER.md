# Phase 4C.6 — Source Preview Renderer (skeleton)

**Status:** Implemented (review-only Markdown; no UI or persistence).

**Parents:** [`PHASE4C5-SOURCE-DEFINITION-COMPILER.md`](./PHASE4C5-SOURCE-DEFINITION-COMPILER.md) · [`PHASE4C2-CANONICAL-JSON-SCHEMAS.md`](./PHASE4C2-CANONICAL-JSON-SCHEMAS.md)

**Core principle:** Preview is **review-only**. It is **not** the regulatory source of record. It reflects what would become `source_definition_versions`, sections, fields, rules, and requirements after publish — with full provenance references.

**Baseline:** GREEN Phase **3C** unchanged. Phase **4B** migrations unchanged.

---

## A. Purpose

```text
source-definitions.json  →  render-source-preview.mjs  →  source-preview.md
```

Human-readable Markdown for CPST authors and clinical ops reviewers before approving publish to Phase 4A.

---

## B. Input/output

| Argument | Default |
|----------|---------|
| `--input` | `tmp/compiled/source-definitions.golden-basic.json` |
| `--output` | `tmp/compiled/source-preview.golden-basic.md` |

```bash
npm run render:source-preview:golden
```

Golden pipeline:

```bash
npm run compile:source:golden
npm run render:source-preview:golden
```

---

## C. Preview structure

1. **Summary** — `generated_at`, `compiler_output_id`, `graph_id`, `input_hash`, counts, validation status  
2. **Validation issues** — errors and warnings from `validation_report` (if any)  
3. **Per visit** (`source_definition_version`) — visit metadata, then sections/procedures  
4. **Per section** — capture flags, external requirements, signatures, field table  
5. **Study-wide** — conditional rules, workflow requirements  
6. **Runtime expectations** — compact matrix summary  

---

## D. Provenance strategy

Compact line per artifact:

`{source_dictionary} · row:{source_row_id} · node:{crg_node_id} · edge:{crg_edge_id}`

Omitted when null. No full dictionary payload dumps.

---

## E. Review limitations

- Markdown only — not interactive UI  
- Does not execute validation rules or workflows  
- Does not reflect published Phase 4A row versions or e-signatures  
- Conditional visibility targets may show rule IDs only (not resolved field labels)  
- Not suitable for regulatory submission as-is  

---

## F. Current gaps

- No HTML/PDF export  
- No diff between two compiler outputs  
- No inline link back to workbook row numbers  
- Runtime expectations shown as summary table only (not nested under visits)  
- No redaction layer for demo environments  

---

## G. Exact next step

1. **Golden CI gate** — add `render:source-preview:golden` after `compile:source:golden`  
2. **Phase 4A publish preview** — compare compiler output hash vs last published version  
3. **Optional HTML renderer** — same data model, styled for stakeholder review  

---

*Regulatory-informed engineering posture only.*
