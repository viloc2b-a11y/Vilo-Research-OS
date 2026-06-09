# Patient Acquisition Runtime G1

Status: native Vilo OS extension, not a separate recruitment platform

## Principle

Patient Acquisition must extend Study Runtime and Subject Runtime.

Vilo OS should not create a parallel CRM, recruitment portal, or vendor platform. External sources can be integrated later, but their output must become runtime events that feed the existing enrollment pipeline.

## Current Native Support

The repository already has early acquisition attribution on `study_subjects`:

- `recruitment_source`
- `screening_number`
- `screening_date`
- contact preferences
- assigned coordinator
- enrollment status

Study setup also has `study_enrollment_configs`:

- `enrollment_target`
- `site_enrollment_cap`
- `enrollment_start_date`
- `enrollment_end_date`
- screening and subject number formats
- screen failure handling

## G1 Implementation

VPI now reads acquisition-adjacent data from native runtime tables:

- subject count
- screening count
- enrolled count
- randomized count
- screen failed count
- source attributed subject count
- source missing subject count
- enrollment target
- enrollment end date

This makes acquisition visible without creating a separate recruitment module.

## UX Presence

VPI Study Health now exposes:

- Screening
- Randomized
- Source attributed
- Source missing
- Enrollment target
- Enrollment closes

These metrics support coordinator-first decisions:

- Is enrollment behind?
- Are we missing attribution?
- Does the study need immediate enrollment protection?
- Are randomized subjects tracking toward target?

Study Workspace now exposes a Patient Acquisition card in the Study Command Center:

- total subjects
- source attributed
- source missing
- screening
- randomized
- screen failed
- top recruitment sources from native subject attribution

This keeps acquisition inside the study workspace and avoids a separate recruitment platform.

## What G1 Does Not Do

G1 does not add:

- lead vendor connectors
- cost per lead
- cost per randomized
- lead pipeline tables
- external ad attribution
- vendor reconciliation

Those require a future schema phase.

## Future Native Schema Direction

When migrations are approved, the next structure should be a native lead intake extension:

- `patient_acquisition_leads`
- `patient_acquisition_events`
- `patient_acquisition_costs`
- `patient_acquisition_vendor_payloads`

These should attach to:

- `organization_id`
- `study_id`
- optional `study_subject_id`
- optional `created_operational_event_id`

The lifecycle should remain:

Lead
PreScreen
Qualified
Scheduled
Consented
Screened
Randomized

Conversion to a subject should create or update `study_subjects`, not duplicate subject truth.

## VPI Role

VPI observes acquisition performance. It does not capture leads.

VPI should eventually surface:

- enrollment target at risk
- low conversion from qualified to screened
- low randomized yield
- high unattributed subjects
- high cost per randomized
- vendor underperformance

The first safe step is complete: VPI now observes native attribution and enrollment target risk.

The second safe step is complete: Study Workspace now shows native acquisition attribution and top source mix using `study_subjects.recruitment_source`.
