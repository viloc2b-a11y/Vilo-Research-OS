# Source Engine Phase 1 — Clinical Foundation

## Principle

**Separate clinical definitions from runtime execution.**

| Layer | Path | Responsibility |
|-------|------|----------------|
| Definitions | `lib/source-engine/definitions/` | Fields, sections, templates, domains — static metadata only |
| Runtime | `lib/source-engine/runtime/` | Context, responses, resolved field/section state |
| Rules | `lib/source-engine/rules/` | Declarative visibility, requiredness, disable, flags |
| Validators | `lib/source-engine/validators/` | Submission/signature validation |
| Calculators | `lib/source-engine/calculators/` | Derived metrics (BMI, HIT drop %, visit window, …) |
| Workflow | `lib/source-engine/workflow/` | Tasks from `CREATE_TASK` actions |
| Audit | `lib/source-engine/audit/` | Part 11 signature policy (declarative only) |

## Future connections (not built in Phase 1)

1. **Dynamic eSource UI** — `resolveSourceRuntime()` drives visible/required/disabled fields per visit.
2. **Visit execution** — `RuntimeContext` binds study/site/subject/visit; repeatable sections map to row instances.
3. **Published source packages** — `SourceTemplateDefinition` serializes to existing publish compiler.
4. **VPI signals** — rule `FLAG` actions and validation severities feed performance read layer.
5. **ClinIQ** — domain tables / billing hooks use `sourcePath` from field catalog.

## Example template

`GENERIC_PHASE3_IMMUNOLOGY_TEMPLATE` in `definitions/template.examples.ts` — generic endocrine/immunology pilot.

## Validation

```bash
npm run validate:source-engine:phase1
npm run validate:source-engine   # legacy examples
npx tsc --noEmit
```

## API entry points

```ts
import {
  GENERIC_PHASE3_IMMUNOLOGY_TEMPLATE,
  CLINICAL_RULES_EXAMPLES,
  DERIVED_METRICS_CATALOG,
  resolveSourceRuntime,
  validateForSignature,
} from '@/lib/source-engine'
```

Legacy exports (`config.library`, `engine.canonical`, `VILO_FIELD_CATALOG`) remain available for existing capture paths.

**Naming compliance:** `docs/SOURCE-ENGINE-NAMING-COMPLIANCE.md`
