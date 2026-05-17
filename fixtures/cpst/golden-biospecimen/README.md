# Golden biospecimen CPST fixture

Deterministic QA fixture for **Phase 4C.11** — biospecimen collection-only studies.

## Study shape

| Item | Value |
|------|--------|
| Study | `ST-BIO-001` / `BIO-101` |
| Visit | `V-BIO-001` — Screening / Collection Event |
| Procedures | Eight canonical sections: Header, Consent, Specimen, Processing, Storage, Shipping, Quality, Closeout |
| Field_Definitions | 48 rows (`F-BIO-001` … `F-BIO-048`) — primary source dictionary |
| Value_Lists | SPECIMEN_TYPE, QUANTITY_UNIT, COLLECTION_CONDITION, SHIP_CONDITION |
| Domain module | `MR-BIO-001` → `MOD-biospecimen_collection` (capabilities + validation; not field replacement) |
| Canonical template | `fixtures/cpst/biospecimen-canonical-template.json` |

## Pipeline

```bash
npm run compile:graph:biospecimen
npm run compile:source:biospecimen
npm run render:source-preview:biospecimen
```

## Expected artifacts

| Output | Path |
|--------|------|
| CRG | `tmp/compiled/cpst-runtime-graph.golden-biospecimen.json` |
| Source definitions | `tmp/compiled/source-definitions.golden-biospecimen.json` |
| Preview | `tmp/compiled/source-preview.golden-biospecimen.md` |

## Compiler expectations

- One `DomainModuleNode` with six runtime capabilities on payload.
- `applies_to` edges to study, visit, and collection procedure.
- Module-backed source fields with provenance to `Biospecimen_Collection_Module` / `MR-BIO-001`.
- `BIOSPECIMEN_REVIEW` workflow when `reviewer_required` is true.
- Shipment section uses external source metadata reference (`Central Reference Lab Courier`).
