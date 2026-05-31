# Controlled Terminology Library Audit + Integration Report

## 1. Library Inventory
A comprehensive recursive search across the codebase for terminology dictionaries, CSV seeds, JSON lists, or TS registries related to:
- Medications
- Medical Conditions
- Surgical Procedures
- Allergies
- AE Controlled Terms (Severity, Outcome, Relatedness)
- Routes, Frequencies, Units

**Result:** 0 libraries found. There are no imported CSVs, no Supabase seed files (`seed.sql`), and no hardcoded TypeScript registries containing these controlled terms.

## 2. Current Code Status
Currently, the Subject Runtime entities (defined in `lib/subject-runtime/subject-runtime-types.ts`) type these fields as standard `string` primitives (e.g., `term: string`, `severity: string`). 
The UI currently assumes free-text input because there are no backing dictionaries to hydrate an autocomplete/dropdown component.

## 3. Missing Integrations
Because the source libraries are entirely missing from the repository, the following integrations are blocked:
- **Medical Conditions:** No dictionary available to map `{ code, label, sourceLibrary }`.
- **Concomitant Medications:** No medication list, route list, frequency list, or dose unit list available.
- **Surgical History:** No procedure list available.
- **Allergies:** No allergen or reaction list available.
- **Adverse Events:** No standard dictionaries for Severity (e.g., CTCAE), Outcome, or Relatedness.

## 4. Implemented UI Selectors
**Status:** Blocked.
We cannot build the `SearchableAutocomplete` components without knowing the schema and volume of the provided libraries (e.g., whether they require server-side pagination due to being 100,000+ rows like MedDRA/WHODrug, or if they are small enough to be bundled in client state).

## 5. Persistence Model
**Status:** Defined but not implemented.
The expectation is to transition the data model from:
`diagnosis: string`
To:
```typescript
diagnosis: {
  code: string;
  label: string;
  sourceLibrary: string;
  freeTextOverride?: boolean;
}
```
This requires a migration on the Subject Runtime types and the underlying database schema.

## 6. Tests
**Status:** Blocked.
Test cases 1 through 9 cannot be executed because the foundational library assets are missing from the codebase.

---

## Conclusion
The integration is currently blocked at the data availability layer.
