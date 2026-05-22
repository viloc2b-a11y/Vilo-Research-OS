# Phase 12B — Canonical Source Composition

**Status:** Composition manifests, resolver, fixtures, and Source Builder preview. No auto-publish or PARA/MV SDV migration.

**Catalog:** `fixtures/source-composition/composition-templates.v1.json`  
**Resolver:** `@/lib/source-engine/source-composition`  
**Preview UI:** `/source-builder/composition`  
**Smoke:** `npx tsx scripts/phase12b-composition-smoke.ts`

## Architecture

A source document is described by a **composition manifest** (not a hand-written field list):

1. Load Phase 12A canonical libraries (version-pinned).
2. Walk manifest `sections` in order.
3. Apply `include` / `exclude` / `omissions` / `required_overrides` / `hidden_fields`.
4. Emit section-scoped runtime keys: `{section_key}__{logical_key}`.
5. At publish, freeze manifest + fingerprint + resolved field keys into `provenance_json`.

Runtime capture continues to use **published** `source_definition_fields` / `publishedFieldKeys` — not live library JSON.

## Manifest schema (12B.1.0)

| Field | Purpose |
|-------|---------|
| `template_key` | Stable template identifier |
| `library_version` | Pins `12A.1.0` canonical library |
| `sections[].section_key` | Unique; drives runtime key namespace |
| `sections[].library` / `overlay` | Exactly one per section |
| `include` / `exclude` | Explicit field filters only |
| `required_overrides` | Per-field required flag |
| `hidden_fields` | In manifest, hidden in preview |
| `omissions` | Optional fields removed with `omission_reason` |
| `aliases` | Optional logical → suffix remap within section |

No expressions, scripting, or runtime schema mutation.

## Collision strategy

- **Section-scoped runtime keys** prevent cross-library ambiguity (`screening_vitals__heart_rate` vs `screening_labs__collection_datetime`).
- **Duplicate `section_key`** → resolve error.
- **Duplicate runtime key** in one manifest (including bad aliases) → resolve error.
- **Required fields** cannot be `exclude`d or `omit`ted without `required_overrides[field]=false`.

## Canonical fixtures

| Template | Composition |
|----------|-------------|
| `SCREENING_CORE_V1` | Vitals (include) + Labs (exclude CS/AE link) + PE |
| `IP_ADMIN_VISIT_V1` | Vitals (include) + IP admin core |
| `AE_REVIEW_V1` | AE + ConMed |
| `PARA_ADRENAL_REVIEW_V1` | PE + PARA adrenal overlay |
| `MV_HOUSEHOLD_SICK_VISIT_V1` | MV symptom overlay + Labs (swab subset) |

## Publish immutability

`buildCompositionPublishSnapshot(manifest)` returns:

- `composition_fingerprint` (SHA-256 of stable resolved shape)
- `composition_manifest` (deep clone pinned at publish)
- `resolved_field_keys` (frozen list for `published_source_definition_versions`)

Existing publish RPCs already persist `provenance_json`; 12B defines the payload shape for composition-based SDVs. **Published rows are not updated by later 12A library edits.**

## Intentionally not done

- Auto-publish or auto-bind composed templates
- PARA/MV thin SDV replacement
- Drag/drop builder
- Runtime engine changes
