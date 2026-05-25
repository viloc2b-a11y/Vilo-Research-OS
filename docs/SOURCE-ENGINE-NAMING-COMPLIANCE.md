# Source Engine — Naming Compliance

## Policy

The Vilo OS **source engine** (`lib/source-engine/`) implements **generalized clinical patterns** derived from common CRF/eCRF practice. It does **not** embed:

- Sponsor-specific protocol identifiers
- Copyrighted or confidential protocol titles
- Exact study acronyms tied to a single trial
- Identifiable trial labels in code, docs, or examples

All examples, templates, and rule sets use **abstract, reusable identifiers** (e.g. `GENERIC_PHASE3_IMMUNOLOGY`, `GENERIC_PHASE3_OA`).

## Naming standard

| Use | Avoid |
|-----|--------|
| `GENERIC_*` | Sponsor names |
| `PHASE2_*`, `PHASE3_*` | Exact protocol numbers (e.g. `STUDY-KOA-001`) |
| `OA_*`, `RESP_*`, `GI_*`, `METABOLIC_*`, `IMMUNOLOGY_*` | Study-specific acronyms |
| `pharmacokinetic_substudy_participant` | Trial-specific field tokens tied to one protocol |

## What is preserved

Clinical **logic** is unchanged: adrenal testing, HIT monitoring, pharmacokinetic sampling, pregnancy/WOCBP, off-site visit rules, repeatable sections, signatures, and audit policy remain fully functional.

## Maintenance

Before Phase 2+ releases, run:

```bash
rg -i "PARA_|MV406|sponsor" lib/source-engine docs --glob "*.{ts,md}"
```

Matches should be zero in `lib/source-engine/` or documented as historical external references only.

## Related docs

- `docs/SOURCE-ENGINE-PHASE1-FOUNDATION.md` — architecture
- `docs/PHASE9A-GENERIC-PHASE3-PILOT-RUNBOOK.md` — validation pilot (generic)
