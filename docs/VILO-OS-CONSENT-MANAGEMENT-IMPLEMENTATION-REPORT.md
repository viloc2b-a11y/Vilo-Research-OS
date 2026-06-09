# Vilo OS Consent Management Implementation Report

Date: 2026-06-03

## Scope

Built Consent Management inside the existing Vilo OS runtime spine. The work follows the agreed architecture:

- Document Center as the entry point
- Study-level consent template library
- Subject-level signed consent record and evidence
- No duplicate source of truth
- No separate consent platform
- No forced electronic-only workflow

## What Was Added

### Document Center alignment

- Added explicit `ICF / Consent` and `Lab Manual` classification support.
- Added `Runtime Engine - Consent Management` as an explicit destination.
- Routed consent documents into the existing consent runtime and study workspace surfaces.
- Added a Consent Management hub card to Document Center.

### Consent Management hub

- Added a study-scoped page at `/document-center/consent-management`.
- Added a read-model loader that summarizes:
  - consent library versions
  - subject consent records
  - evidence uploads
  - reconsent queue
  - temporary consent sessions

### Consent validation helper

- Added a validation helper for subject consent records that checks:
  - active / approved library version
  - subject signature
  - coordinator signature
  - optional PI signature
  - witness / LAR requirements
  - evidence presence
  - participant copy documentation
  - reconsent warnings
  - training / delegation gates

## Existing Runtime Reused

The implementation reuses the consent runtime already present in the repo:

- `consent_document_versions`
- `subject_consent_versions`
- `subject_consent_documents`
- `subject_consent_reconsent_requirements`
- `subject_consent_patient_sessions`
- `subject_consent_patient_signatures`
- `subject_consent_events`
- `subject_consent_audit`

## Validation

### Checks run

- `npx tsc --noEmit`
- `npx eslint` on the touched consent and document-routing files
- `npx tsx scripts/consent-management-smoke.ts`

### Results

- TypeScript compile passed.
- ESLint passed.
- Consent management smoke passed.
- The smoke confirmed:
  - electronic consent validation
  - paper consent validation
  - missing-signature blocking behavior
  - inactive-version blocking behavior
  - optional PI-signature warning behavior
  - visit gate behavior with active vs missing consent

## What Remains Partial

- The consent hub is operational, but it intentionally stays inside the existing subject-level runtime rather than inventing a new consent platform.
- Some consent evidence and signature states still depend on existing source/runtime data quality in the underlying study.
- The hub is study-scoped and auditable, but it does not replace the subject consent runtime surface for signer-facing actions.

## Evidence No Parallel Source of Truth Was Introduced

- Consent templates are stored in `consent_document_versions`, the existing study-level consent library.
- Signed subject records remain in `subject_consent_versions`.
- Evidence stays linked as documents, not copied into a second consent repository.
- Document Center only routes to existing runtime surfaces.
- Compliance and consent truth remain derived from the existing Vilo OS runtime spine.
