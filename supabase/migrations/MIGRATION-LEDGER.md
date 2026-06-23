# Supabase Migration Ledger

**Last updated:** 2026-06-22  
**Total migrations:** 226  
**Next safe prefix:** 0235

---

## Known Duplicate Prefixes

Three numeric prefix collisions exist in the migration history. These were applied to the Supabase instance in lexicographic order (alphabetical by full filename within the same prefix). **Do not rename them** — renaming would cause Supabase to treat them as unapplied migrations and attempt to re-apply them, which would fail on already-existing schema objects.

| Prefix | File A (applied first) | File B (applied second) |
|--------|------------------------|-------------------------|
| 0134 | `0134_operational_signature_runtime_hardening.sql` | `0134_study_budget_negotiation_events.sql` |
| 0162 | `0162_document_intelligence_rls_fix.sql` | `0162_signature_engine_unification.sql` |
| 0163 | `0163_governance_protocol_acceptance.sql` | `0163_study_status_archived.sql` |

**Application order rule:** Within a shared prefix, Supabase applies files in lexicographic order of the full filename. File A precedes File B in all three cases above. This order is stable.

---

## Convention for New Migrations

- Use the next safe prefix in sequence: currently **0235**
- Never reuse an existing prefix — always increment
- Use the format: `{prefix}_{short_snake_case_description}.sql`
- After each migration session, update "Next safe prefix" in this ledger

---

## Maturity Vocabulary

Migrations that create or extend tables should be consistent with the following module maturity levels used across Vilo OS:

| Label | Meaning |
|-------|---------|
| `prototype` | Schema exists, no UI, no validation evidence |
| `v0` | Schema + basic API, no coordinator visibility |
| `active` | Coordinator visible (Subject Workspace or VPI), no pilot validation |
| `validated` | Coordinator visible + smoke evidence in `.runtime-validation/` |
| `pilot-ready` | Validated + pilot subject walkthroughs completed |
| `prod-ready` | Pilot-ready + sponsor review + compliance sign-off |

---

## Migration History Summary

| Range | Description |
|-------|-------------|
| 0001–0050 | Foundation: orgs, staff, auth, RLS |
| 0051–0100 | Study + subject + visit runtime |
| 0101–0133 | Source capture, signing, operational events |
| 0134–0149 | Signature hardening, budget negotiation, consent runtime |
| 0150–0169 | Pharmacy, document intelligence, governance |
| 0170–0184 | CAPA, amendment runtime, regulatory binder, consent templates |
| 0185–0194 | Inspection readiness, financial intelligence, compliance |
| 0195–0222 | Activity code library, system library |
| 0223–0224 | System library expansion |
| 0225 | Study systems registry |
| 0226 | Study system usage events |
| 0227 | Study system access readiness |
| 0228 | Activity → system map |
| 0229 | Activity → system recommendations |
| 0230 | Regulatory personnel registry |
| 0231 | Regulatory master documents |
| 0232 | Study regulatory links |
| 0233 | Study-specific regulatory documents |
| 0234 | Regulatory — Document Center integration |
| 0235+ | Future |
