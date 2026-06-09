# Atlas Context Package
_Generated: 2026-06-08T22:43:18.089Z_
## Project
- **Name:** Vilo Research
- **ID:** vilo-research
- **Working dir:** `C:\dev\vilo-os`
## Agent Route
- **Agent:** Cursor
- **LLM:** Claude Sonnet
- **Mode:** Code
## Task
hay acceso al dashboard?
## Relevant Memory
- [decision] [atlas-memory] Document Center v1 scope: intake → parser → reconciliation loop only. No eSource generation in v1.
- [architecture] [atlas-memory] Parser output writes to canonical_reader_result table. UI reads reconciliation_pending view only.
- [operating_rule] [static] ShoreIQ should validate revenue through professional risk reports before building complex dashboards, APIs, simulators, or advanced automation.
- [positioning] [static] Vilo OS is a site-first Clinical Research Execution Operating System, not a generic CTMS, sponsor-first dashboard, CRO portal, or enterprise BI product.
- [architecture] [static] VITALIS core funnel is Capture → Pre-screen → Match → Book → Show → Enroll.

## Governance Rules
- Do not create a parallel CTMS, secondary runtime, or independent governance layer.
- AI must operate as runtime intelligence — not as a decorative chatbot.
- Protocol de-identification: real sponsor names, compound IDs, and protocol numbers must never appear in runtime objects, UI, logs, or AI contexts.
- No new biospecimen catalogs without a matching revenue contract.
- Reader output is candidate truth — human reconciliation mandatory before runtime activation.

## Domain Vocabulary
coordinator, protocol, subject, site, randomization, canonical reader, reconciliation, runtime objects, source generation, visit runtime, governance, VPI, eSource, protocol de-identification, biospecimen, IRB, CRO, SMO, site activation