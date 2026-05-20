# Source Engine — Phase 1 (Config Library + Rule Engine)

**Status:** Implemented (`lib/source-engine/`). No UI integration in this phase.

**Parent:** `docs/DYNAMIC-SOURCE-ARCHITECTURE.md`

---

## Module layout

| File | Purpose |
|------|---------|
| `lib/source-engine/canonical.ts` | **Canonical contract:** `FieldType`, `Domain`, `FieldSpec`, `TriggerRule`, `BusinessRule` enums |
| `lib/source-engine/vilo-field-catalog.ts` | **`VILO_FIELD_CATALOG`** — study-agnostic `FieldSpec[]` registry (demo, vitals, proc, labs, supply) |
| `lib/source-engine/vilo-dynamic-rules.ts` | **`DYNAMIC_TRIGGERS`** + **`VILO_BUSINESS_RULES`** (form routing + validation) |
| `lib/source-engine/adapters.ts` | `FieldDefinition` ↔ `FieldSpec`, `sourcePath`, rule context builders |
| `lib/source-engine/engine.canonical.ts` | `applyTriggerRules`, `evaluateBusinessRules`, `validateFieldSpec` |
| `lib/source-engine/rules.generic-phase3-immunology-legacy.ts` | Generic Phase 3 trigger + business rule examples |
| `lib/source-engine/types.ts` | Template/section types, `SourceWidgetType`, runtime context |
| `lib/source-engine/config.library.ts` | Unified clinical field catalog by domain (22 domains) |
| `lib/source-engine/engine.rules.ts` | Pure rule engine: visibility, requirement, validation, derived values, triggers |
| `lib/source-engine/templates.generic-phase3-immunology-legacy.ts` | Example generic Phase 3 template (Vitals, Pregnancy, Adrenal, HIT, PK) |
| `lib/source-engine/examples.runtime.ts` | Runnable rule examples |
| `lib/source-engine/index.ts` | Public exports |

**Validate:** `npm run validate:source-engine`

---

## Design principles

- **Configurable, not hardcoded** — studies compose catalog fields into templates; thresholds live in `StudyEngineConfig`.
- **Pure functions** — no Supabase imports in this module.
- **Separate from persistence** — existing `source_response_sets`, publish pipeline, and capture UI unchanged.
- **Generic Phase 3 immunology patterns** — conditional pregnancy, cortisol/ACTH, HIT/4T, pharmacokinetic substudy, phone visit restrictions, household contact role.

---

## Next phases (not in scope)

- Wire engine into capture shell (section grouping, runtime state)
- Compile template → `publish_source_package` JSON
- Source Builder UI for section add/remove/reorder
- Zod schema generator from `FieldValidationRule` + `zodSchemaHint`
