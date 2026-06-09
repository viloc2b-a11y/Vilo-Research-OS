# Atlas Context Package
_Generated: 2026-06-08T22:40:06.802Z_

## Project
- **Name:** Vilo Research
- **ID:** vilo-research
- **Type:** business-operations
- **Priority:** high
- **Status:** active
- **Memory:** active

## Agent Route
- **Agent:** Cursor (coding-agent)
- **Best for:** code, debug, review
- **LLM:** Claude Sonnet — Long-context implementation and code review
- **Mode:** Code — Implement, refactor, or ship code changes.
- **Routing:** Use Cursor with Claude Sonnet in Code mode for this project.

## Task
IDENTIFY CRM and Communication module

## Relevant Memory
- [decision] [atlas-memory] [SDD cycle archived — part 2/3]
## Files changed (git)
- .env.example
- .gitignore
- .runtime-validation/phase11-report.json
- .runtime-validation/phase11-report.md
- app/(ops)/admin/page.tsx
- app/(ops)/admin/protocol-engineering/document-intelligence/page.tsx
- app/(ops)/document-center/page.tsx
-
- [operating_rule] [static] Reduce UI and module sprawl where runtime state already exists.
- [pattern] [static] Not by features: define each product by the operational job it performs, not by its module list.
- [architecture] [static] Vilo OS core runtime chain is Protocol → Canonical Reader → Parser Extraction Result → Reconciliation → Runtime Objects → Source Generation → Visit Runtime → Operational Events → Governance, Financial, and VPI Intelligence.
## Governance Rules
- Do not create a parallel CTMS, secondary runtime, or independent governance layer.
- AI must operate as runtime intelligence — not as a decorative chatbot.
- Protocol de-identification: real sponsor names, compound IDs, and protocol numbers must never appear in runtime objects, UI, logs, or AI contexts.
- No new biospecimen catalogs without a matching revenue contract.
- Reader output is candidate truth — human reconciliation mandatory before runtime activation.

## Domain Vocabulary
coordinator, protocol, subject, site, randomization, canonical reader, reconciliation, runtime objects, source generation, visit runtime, governance, VPI, eSource, protocol de-identification, biospecimen, IRB, CRO, SMO, site activation

## Execution Instructions (Code mode)
1. Implement the task following the project's existing architecture.
2. Write production-ready code. No placeholders, no stubs.
3. Respect governance rules. Use domain vocabulary when naming things.
4. Return the code diff or new file content only — no commentary.