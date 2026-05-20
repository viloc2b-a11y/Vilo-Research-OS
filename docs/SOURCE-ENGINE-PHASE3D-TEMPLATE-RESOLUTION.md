# Source Engine Phase 3D — Template Resolution

## Problem

Phase 1–2 used a single dev template (`GENERIC_OA_PHASE3_TEMPLATE` + example rules) for every procedure. That is fine for architecture validation but not for production protocol-aware execution.

## Resolver priority

`resolveSourceEngineRuntimeConfig()` loads `source_definition_versions` (+ optional `published_source_definition_versions`) and resolves in order:

| Priority | Source | How |
|----------|--------|-----|
| A | **Published** | `meta.source_engine_template_id`, `validation_rules_manifest`, or `published_source_definition_versions.provenance_json` |
| B | **Registry** | `STUDY_SOURCE_ENGINE_BINDINGS[studyId]` or heuristic on `source_definitions.code` |
| C | **Fallback** | `getFallbackGenericTemplate()` — dev only |

Registry template ids (generic names only):

- `GENERIC_OA_PHASE3_TEMPLATE`
- `GENERIC_RESPIRATORY_PHASE3_TEMPLATE`
- `GENERIC_BIOSPECIMEN_COLLECTION_TEMPLATE`

## Fallback rules

When fallback is used:

- `engineStatus.resolution.fallback = true`, `degraded = true`
- Server logs `[source-engine]` warning
- Advisory panel shows **Generic fallback template in use**
- `enforceSignatureBlockers = false` — signature gate does **not** apply template-specific `blocksSignature` findings

Published/registry resolutions set `enforceSignatureBlockers = true`.

## Integration

| Path | Behavior |
|------|----------|
| `load-capture-shell.ts` | `resolveSourceEngineRuntimeConfig()` → `resolveCaptureShellEngineRuntime({ runtimeConfig })` |
| `engine-signature-validation.ts` | Same resolver before `validateProcedureSourceForSignature` |
| `capture-runtime-adapter.ts` | Uses `runtimeConfig` when provided; legacy explicit `template` option = dev override |

`engineSnapshot.engineStatus.resolution` exposes `source`, `templateId`, `fallback`, `publishedPackageId`, etc.

## Why generic template is not production truth

The fallback template is a **study-agnostic example** with demo rules (WOCBP, cortisol, HIT, PK). Real procedures must bind a template via published SDV metadata or registry mapping tied to the **published source definition version** on the procedure execution.

## Future: protocol ingestion

- Compiler writes `source_engine_template_id` into SDV `meta` at publish time
- Optional per-field rules in `validation_rules_manifest`
- Dynamic template build from `published_source_fields` graph (no static registry)
- No sponsor/protocol-specific ids in code — only generic registry keys and study UUID bindings

## Files

- `lib/source-engine/resolution/template-registry.ts`
- `lib/source-engine/resolution/source-template-resolver.ts`
- `lib/source-engine/resolution/load-resolution-context.ts`
- `lib/source-engine/resolution/index.ts`
