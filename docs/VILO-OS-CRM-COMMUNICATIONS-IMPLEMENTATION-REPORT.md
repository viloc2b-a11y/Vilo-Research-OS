# Vilo OS CRM + Communications Implementation Report

Date: 2026-06-03

## Summary

I reviewed the existing VILO-CRM GitHub repository before editing Vilo OS. That repo established the key pattern we wanted to preserve:

- two separated CRM surfaces: patient and business development
- organization-centric business development data
- patient recruitment data kept separate from BD pipeline data
- timeline-style communication logging
- role-based access and RLS-oriented segregation
- task/follow-up oriented operational CRM behavior

Using that as reference, I implemented a Vilo OS-native v0 CRM and Communications surface inside the existing runtime spine. The result is a usable, coordinator-friendly cockpit with separate Patient CRM and Business Development CRM areas, plus a Communications shell for corporate email workflows.

## What already existed in Vilo OS

Before this work, Vilo OS already had:

- `subject_workflow_actions` for subject-scoped operational actions
- study-level recruitment hints via `study_subjects.recruitment_source`
- RBAC helpers and permission resolution in `lib/rbac/*`
- the existing ops shell/sidebar/navigation framework
- VIP adapter surfaces for derived intelligence
- document intelligence, study workspace, financial runtime, and performance/VPI surfaces

What it did not have yet:

- a dedicated CRM module
- patient CRM / business development CRM separation
- communications mailbox/thread workflow
- IMAP/SMTP provider abstraction

## What was created

### 1. CRM

Two separate CRM areas were added:

- **Patient CRM**
  - patient leads
  - contact permissions
  - conditions / interests
  - study matches
  - follow-ups
  - navigation notes

- **Business Development CRM**
  - companies
  - contacts
  - opportunities
  - interactions
  - tasks

The CRM is intentionally v0:

- short forms
- server-side search/filter
- detail views in the same area
- follow-up task view
- no overbuilt pipeline logic

### 2. Communications

A Communications shell was added for corporate email workflows.

Important constraints:

- Vilo OS auth remains separate from mailbox auth
- email is treated as a work surface, not a second product
- human review is required before sending
- provider abstraction supports mock-safe operation and an iPage/IMAP-SMTP path when configured
- VIP-style local summarization/follow-up suggestions are derived from the thread, but not sent automatically

## Tables / migration added

Added migration:

- `supabase/migrations/0164_crm_and_communications.sql`

It introduces:

- enums for patient CRM, BD CRM, and communications states
- patient CRM tables:
  - `patient_leads`
  - `patient_contact_permissions`
  - `patient_conditions`
  - `patient_study_matches`
  - `patient_followups`
  - `patient_navigation_notes`
- BD CRM tables:
  - `bd_companies`
  - `bd_contacts`
  - `bd_opportunities`
  - `bd_interactions`
  - `bd_tasks`
- communications tables:
  - `communications_mailboxes`
  - `communications_threads`
  - `communications_messages`
- CRM/communications RLS helper functions and policies

## Routes added

Added routes:

- `/crm`
- `/crm/patients`
- `/crm/business-development`
- `/communications`

## Permission model implemented

RBAC was extended so the CRM and Communications surfaces can be independently controlled.

New access checks were added for:

- Patient CRM access/manage
- Business Development CRM access/manage
- Communications access/manage

These are resolved through the existing role/permission system, not a parallel authorization layer.

## What is live vs mocked

### Live

- CRM landing page
- Patient CRM list/detail/create/edit flows
- Business Development CRM list/detail/create/edit flows
- role-based access gating
- Supabase-backed read models and server actions
- document-style operational navigation in the existing shell

### Mocked or provider-abstracted

- Communications sending/receipt behavior
- IMAP/SMTP provider behavior for iPage/Roundcube

The Communications module is safe-by-default:

- if provider env vars are missing, it falls back to a blocked/mock state
- no external mailbox actions are forced
- no auto-send behavior

## Files modified

Principal files added or updated in this pass:

- `supabase/migrations/0164_crm_and_communications.sql`
- `lib/rbac/permissions.ts`
- `lib/rbac/index.ts`
- `components/shell/ops-shell.tsx`
- `components/shell/sidebar.tsx`
- `components/shell/sidebar-nav.tsx`
- `app/(ops)/layout.tsx`
- `lib/crm/forms.ts`
- `lib/crm/patient-crm.ts`
- `lib/crm/business-development-crm.ts`
- `lib/communications/communications.ts`
- `app/(ops)/crm/page.tsx`
- `app/(ops)/crm/patients/page.tsx`
- `app/(ops)/crm/business-development/page.tsx`
- `app/(ops)/communications/page.tsx`

## Build / test results

Validated successfully:

- `npx tsc --noEmit`
- `npx eslint 'app/(ops)/crm' 'app/(ops)/communications' 'lib/crm' 'lib/communications' 'components/shell' --no-warn-ignored`
- `npm run build`

The build completed successfully and included the new routes.

## Remaining gaps

This is a usable v0, not a full CRM suite.

Remaining work if we continue:

- dedicated smoke tests for CRM and Communications
- live IMAP/SMTP integration wiring for the configured provider
- richer dedupe and import handling for leads/companies/contacts
- tighter task/follow-up surfacing in the existing coordinator queue
- email sync and thread refresh workflows
- more granular PHI safeguards for patient communication scenarios
- deeper VIP hooks for summarize/draft/follow-up intelligence

## Final note

The key design constraint was preserved:

- patient recruitment data stays separate from business development pipeline data
- communications is a work cockpit, not a cloned mail client
- Vilo OS auth and mailbox auth remain separate
- no new product boundary was introduced

