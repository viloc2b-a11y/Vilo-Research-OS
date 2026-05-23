# Vilo OS Hardening H1 - Action Inventory

Scope: runtime integrity and operational hardening inventory only. This document does not approve feature expansion, new modules, UI redesign, or architecture rewrites.

Checkpoint context:
- Operational Spine is closed.
- Phase 12E-C controlled source snapshot is committed separately.
- This H1 inventory identifies mutation paths and hardening needs before H2 implementation.

Classification vocabulary:
- `read_only`
- `clinical_mutation`
- `source_mutation`
- `signature_mutation`
- `subject_status_mutation`
- `study_setup_mutation`
- `publish_candidate_artifact`
- `unblinded_sensitive`

Risk levels:
- `P0`: data integrity, compliance, or runtime corruption risk.
- `P1`: operational risk, concurrency risk, or coordinator friction.
- `P2`: future hardening or low-impact cleanup.

## Executive Findings

- The most sensitive runtime paths are mostly server-side and permission-checked, but several multi-step workflows still rely on compensating rollback rather than one database transaction.
- The strongest existing protections are the computed runtime readiness gate, source save/submit RPC path, signature guards, closeout guard RPCs, and append-only operational events.
- The biggest remaining hardening risks are stale concurrent writes, non-atomic status plus schedule transitions, audit event gaps after successful data mutation, and legacy/runtime divergence after later binding or source package changes.
- The 12C/12D/12E artifact pipeline is correctly separated from runtime mutation. It should remain artifact-only until an explicitly approved publish step.

## Action Inventory

### H1-001 - Study Creation

- Classification: `study_setup_mutation`
- UI path: `/studies/new`
- File/component: `app/(ops)/studies/new/page.tsx`, `lib/studies/actions.ts`
- Server action/API/RPC: `createStudy`
- DB tables or artifact path touched: `studies`, `study_versions`, `study_members`
- Permission assumptions: signed-in user; active organization access; organization owner/admin via `isOrgAdminForOrganization`
- Audit event emitted: none observed in action
- Rollback/idempotency expectation: no transaction wrapper observed; if study insert succeeds and version/member insert fails, action returns partial creation message
- Risk level: `P1`
- Existing protections: duplicate study code handling; org access checks; admin-only creation
- Missing protections: atomic create-study transaction and explicit audit event
- Hardening recommendation: move study, initial version, and initial member creation into a single RPC transaction; emit one attributable study-created audit event

### H1-002 - Protocol Setup Edits

- Classification: `study_setup_mutation`
- UI path: study workspace protocol setup panels
- File/component: `components/studies/ProtocolSetupPanel.tsx`, `lib/studies/protocol-setup-actions.ts`
- Server action/API/RPC: `updateVisitDefinitionProtocolAction`, `updateProcedureMapProtocolAction`
- DB tables or artifact path touched: `visit_definitions`, `visit_def_procedure_map`
- Permission assumptions: signed-in user; active organization membership; `canMutateOrganizationData`
- Audit event emitted: none observed in action
- Rollback/idempotency expectation: single-row update; no expected-version stale write guard
- Risk level: `P1`
- Existing protections: org/study scoping and mutation permission
- Missing protections: audit event, expected `updated_at`, and runtime drift warning if visit schedule/procedure executions already exist
- Hardening recommendation: add expected-version concurrency guard and append protocol setup mutation events; warn or block edits that would diverge generated runtime without an approved amendment path

### H1-003 - Procedure Source Binding Create/Retarget

- Classification: `study_setup_mutation`, `source_mutation`
- UI path: `/studies/[studyId]#source-bindings`
- File/component: `app/(ops)/studies/[studyId]/page.tsx`
- Server action/API/RPC: inline server action `saveProcedureSourceBinding`
- DB tables or artifact path touched: `procedure_source_bindings`; reads `procedure_definitions`, `source_definition_versions`
- Permission assumptions: active organization access via `requireActiveOrganizationAccess`; current action verifies access but does not explicitly require source-management role in this action body
- Audit event emitted: none observed
- Rollback/idempotency expectation: upsert on `study_id,procedure_definition_id`; DB constraints/triggers expected to enforce one active binding
- Risk level: `P0`
- Existing protections: same study/org checks; published SDV check; deterministic explicit selection
- Missing protections: explicit source-management permission check, audit event, expected binding version on retarget, and warning when procedure executions already exist with stale SDV
- Hardening recommendation: require source setup permission, emit binding-created/binding-retargeted event, and require explicit acknowledgement if retargeting after runtime execution exists

### H1-004 - Source Package Publish From Artifacts

- Classification: `source_mutation`, `study_setup_mutation`, `unblinded_sensitive`
- UI path: `/studies/[studyId]#source-publish`
- File/component: `lib/source-publish/actions.ts`
- Server action/API/RPC: `publishSourcePackageFromArtifacts`, RPC `publish_source_package`
- DB tables or artifact path touched: `source_publish_packages`, `source_definition_versions`, publish metadata persisted by RPC
- Permission assumptions: active organization access; action validates study version belongs to org/study; no explicit source-manager role observed in wrapper
- Audit event emitted: expected inside RPC or downstream publish tables; no explicit `operational_events` insert in wrapper
- Rollback/idempotency expectation: RPC expected to persist atomically; wrapper verifies persisted package row and published SDVs after RPC
- Risk level: `P0`
- Existing protections: artifact validation blockers, approval checks, hash consistency checks, persisted package verification, published SDV verification
- Missing protections: explicit source publish permission in wrapper and visible audit lineage from app actor to persisted package
- Hardening recommendation: enforce `canManageSourceDocuments` or equivalent before RPC; require RPC to return or persist actor/audit evidence; keep no optimistic success rule

### H1-005 - Subject Creation

- Classification: `clinical_mutation`
- UI path: `/studies/[studyId]#add-subject`
- File/component: `app/(ops)/studies/[studyId]/page.tsx`
- Server action/API/RPC: inline server action `createStudySubject`
- DB tables or artifact path touched: `study_subjects`
- Permission assumptions: signed-in user; active organization membership; `canMutateOrganizationData`
- Audit event emitted: none observed
- Rollback/idempotency expectation: single insert; duplicate subject identifier handled with friendly message
- Risk level: `P1`
- Existing protections: study/org scoping; duplicate handling; default `enrollment_status = screening`
- Missing protections: audit event, explicit study existence check before insert, optional idempotency key for repeated form posts
- Hardening recommendation: insert attributable subject-created event in same transaction/RPC or with compensating failure behavior; add idempotency token for form retry protection

### H1-006 - Subject General Update and Enrollment Transition

- Classification: `clinical_mutation`, `subject_status_mutation`, `unblinded_sensitive`
- UI path: `/subjects/[subjectId]`
- File/component: `components/subject/subject-general-form.tsx`, `lib/subject/subject-chart/actions.ts`
- Server action/API/RPC: `updateSubjectGeneralAction`; calls `generateSubjectVisitSchedule` for enrolled/randomized transitions
- DB tables or artifact path touched: `study_subjects`; may generate `visits` and `procedure_executions`
- Permission assumptions: signed-in user; org access; `canMutateOrganizationData`; unblinded fields only if `canManageUnblindedData`
- Audit event emitted: none observed for profile/enrollment update in this action
- Rollback/idempotency expectation: enrollment status update is followed by schedule generation; if schedule fails, status rollback is attempted
- Risk level: `P0`
- Existing protections: READY_FOR_EXECUTION gate before enrolled/randomized; blocks generic randomized transition; lifecycle transition guard; duplicate subject identifier handling
- Missing protections: atomic status plus schedule generation; audit event for enrollment; expected `updated_at` guard on general update
- Hardening recommendation: move enrollment transition and schedule generation into a single transaction/RPC; emit enrollment event; require expected subject version for concurrent edits

### H1-007 - External Randomization Record

- Classification: `subject_status_mutation`, `clinical_mutation`, `unblinded_sensitive`
- UI path: `/subjects/[subjectId]`, "Record External Randomization"
- File/component: `components/subject/subject-general-form.tsx`, `lib/subject/subject-chart/actions.ts`
- Server action/API/RPC: `recordExternalRandomizationAction`; calls `generateSubjectVisitSchedule`
- DB tables or artifact path touched: `study_subjects`, `operational_events`, generated `visits`, `procedure_executions`
- Permission assumptions: signed-in user; org access; `canMutateOrganizationData`; `canManageUnblindedData`
- Audit event emitted: `external_randomization_recorded`; compensating `external_randomization_voided` if schedule generation fails after event
- Rollback/idempotency expectation: rejects if already randomized or randomization fields exist; rollback attempts for event and schedule failures
- Risk level: `P0`
- Existing protections: external-only product boundary; readiness gate; one-time record guard; event traceability; compensating event on schedule failure
- Missing protections: single DB transaction for status, event, and schedule generation; expected subject version check
- Hardening recommendation: convert randomization record plus schedule generation to transactional RPC; preserve append-only event and compensating event semantics for exceptional failures

### H1-008 - Subject Closeout Status Actions

- Classification: `subject_status_mutation`, `clinical_mutation`
- UI path: `/subjects/[subjectId]`
- File/component: closeout action forms in subject chart, `lib/subject/subject-chart/actions.ts`
- Server action/API/RPC: `completeSubjectAction`, `withdrawSubjectAction`, `screenFailSubjectAction`, `lostToFollowUpSubjectAction`
- DB tables or artifact path touched: `study_subjects`, `operational_events`
- Permission assumptions: signed-in user; org access; `canMutateOrganizationData`; closeout guard via `assertSubjectCloseoutAllowed`
- Audit event emitted: `SUBJECT_COMPLETED`, `SUBJECT_WITHDRAWN`, `SUBJECT_SCREEN_FAILED`, `SUBJECT_LOST_TO_FOLLOW_UP`
- Rollback/idempotency expectation: uses expected `updated_at` if provided; event insert accepts duplicate 23505 as success; status update and event insert are separate
- Risk level: `P0`
- Existing protections: stale write message support; lifecycle closeout separated from general form; closeout eligibility guard
- Missing protections: transaction around status update and event insert; consistent event idempotency key visibility
- Hardening recommendation: wrap status transition and operational event in RPC transaction; require expected `updated_at` from UI for all closeout submissions

### H1-009 - Schedule Generation

- Classification: `clinical_mutation`
- UI path: subject visits page, enrollment/randomization flows, schedule generation actions
- File/component: `lib/visits/actions.ts`, `lib/visits/generateSubjectVisitSchedule.ts`
- Server action/API/RPC: `generateSubjectVisitScheduleAction`, `generateSubjectVisitSchedule`, RPC `generate_subject_visit_schedule`; legacy fallback exists
- DB tables or artifact path touched: `study_subjects`, `visit_definitions`, `visit_def_procedure_map`, `procedure_source_bindings`, `visits`, `procedure_executions`
- Permission assumptions: signed-in user; active org membership in action path; runtime readiness gate inside generator
- Audit event emitted: RPC may emit database events; legacy fallback has no explicit operational event observed
- Rollback/idempotency expectation: RPC preferred; fallback detects existing visit definitions and handles duplicate 23505; best-effort deletes created visits if later procedure/anchor update fails
- Risk level: `P0`
- Existing protections: READY_FOR_EXECUTION gate; same-study published SDV requirement; duplicate visit definition detection; no required procedure execution without SDV
- Missing protections: legacy fallback is non-transactional and has weaker audit lineage
- Hardening recommendation: require RPC path for production; disable or restrict legacy fallback outside dev/test; add schedule-generation event with created visit/procedure counts

### H1-010 - Visit Check-In

- Classification: `clinical_mutation`
- UI path: visit workspace lifecycle actions
- File/component: `components/clinical/visit-lifecycle-actions.tsx`, `lib/actions/check-in-visit.ts`
- Server action/API/RPC: `checkInVisit`
- DB tables or artifact path touched: `visits`; audit log via `logAuditEvent`
- Permission assumptions: authenticated Supabase user; current action reads visit but does not visibly enforce organization role membership in wrapper
- Audit event emitted: `VISIT_CHECKED_IN` through audit log, fire-and-forget
- Rollback/idempotency expectation: idempotent for active/terminal statuses; guarded update from `scheduled` only
- Risk level: `P1`
- Existing protections: status transition guard; idempotency for already active visits; stale status changed message
- Missing protections: explicit org permission check and guaranteed audit write before success
- Hardening recommendation: require org membership/mutation permission before status update; make audit write awaited or record failure in response telemetry

### H1-011 - Visit Reschedule and Reminders

- Classification: `clinical_mutation`
- UI path: subject visits page and operational calendar
- File/component: `lib/visits/actions.ts`, `lib/visits/rescheduleVisit.ts`, `app/(ops)/operational-calendar/actions.ts`
- Server action/API/RPC: `rescheduleVisitAction`, `sendVisitReminderAction`, `rescheduleProtocolVisit`, `cancelProtocolVisitReschedule`
- DB tables or artifact path touched: `visits`, `visit_reminders`, `operational_events`
- Permission assumptions: active org membership for visits action; calendar actions validate mutation permission and organization access
- Audit event emitted: calendar reschedule actions append `operational_events`; reminder action inserts `visit_reminders` but no operational event observed
- Rollback/idempotency expectation: reminder insert and visit update are separate; calendar events are append-only chains
- Risk level: `P1`
- Existing protections: visit/org scoping; schedule date validation; append-only calendar event chains
- Missing protections: atomic reminder insert plus visit state update; standardized operational event for reminders
- Hardening recommendation: make reminder logging transactional or idempotent; align reminder events with operational event lineage

### H1-012 - Procedure Completion

- Classification: `clinical_mutation`
- UI path: visit workspace procedure actions
- File/component: `components/clinical/procedure-complete-button.tsx`, `lib/actions/complete-procedure-execution.ts`
- Server action/API/RPC: `completeProcedureExecution`, RPC `complete_procedure_execution`
- DB tables or artifact path touched: `procedure_executions`, operational/audit records from RPC or `logAuditEvent`
- Permission assumptions: authenticated Supabase user; action reads org but does not visibly enforce role permission in wrapper
- Audit event emitted: `PROCEDURE_EXECUTION_COMPLETED` audit log, fire-and-forget; RPC may also emit an operational event id
- Rollback/idempotency expectation: validates before RPC; RPC expected to be transactional and idempotent
- Risk level: `P0`
- Existing protections: UUID validation; section-disabled guard; source validation blockers; RPC completion transaction; idempotent response
- Missing protections: explicit role permission in wrapper; validation status update before blocked return is separate and can drift if later RPC fails
- Hardening recommendation: enforce procedure execution permission and role guard; keep all validation status and completion mutation in one RPC

### H1-013 - Source Capture Open, Save Draft, Submit

- Classification: `source_mutation`, `clinical_mutation`, `unblinded_sensitive`
- UI path: `/source/capture/[procedureExecutionId]`
- File/component: `components/source/capture-form.tsx`, `lib/source/capture/actions.ts`, `app/api/source/response-set/open/route.ts`, `app/api/source/response-set/save-draft/route.ts`, `app/api/source/response-set/submit/route.ts`
- Server action/API/RPC: `saveCaptureDraftAction`, `submitCaptureAction`, API write client, RPCs `open_source_response_set`, `save_source_draft`, `submit_source_response_set`
- DB tables or artifact path touched: `source_response_sets`, `source_responses`, validation findings/source engine artifacts as RPC side effects
- Permission assumptions: signed-in user; org membership; `canManageSourceDocuments` or `canEditClinicalSource`; unblinded fields require `canManageUnblindedData`
- Audit event emitted: expected through source RPCs and Source Engine telemetry; action-level operational event not directly observed
- Rollback/idempotency expectation: stale write protection via expected `updated_at`; submit saves latest draft then validates and submits; no success is reported if submit fails
- Risk level: `P0`
- Existing protections: editable-state guard, signed/locked guard, blinding enforcement, source engine validation, stale response-set guard
- Missing protections: full all-or-error guarantee across save-then-submit boundary should remain a hardening focus; double-submit and submit-after-sign tests should be formalized
- Hardening recommendation: enforce transactional save plus submit when submit includes changed values; add explicit idempotency for double-submit and a standard audit event assertion in smoke tests

### H1-014 - Source Corrections and Addenda

- Classification: `source_mutation`, `clinical_mutation`
- UI path: `/source/response-set/[id]`
- File/component: `components/source/field-correction-panel.tsx`, `components/source/response-set-addendum-panel.tsx`, `lib/source/correction/actions.ts`, `lib/source/addendum/actions.ts`, `app/api/source/response/correct/route.ts`, `app/api/source/response-set/addendum/route.ts`
- Server action/API/RPC: `submitFieldCorrectionAction`, `submitResponseSetAddendumAction`, correction/addendum API routes and RPCs
- DB tables or artifact path touched: `source_responses`, correction/addendum tables, response-set history tables or events depending on RPC
- Permission assumptions: source API auth context; org membership and source write permission expected in API validation layer
- Audit event emitted: expected via RPC/history tables
- Rollback/idempotency expectation: append-only correction/addendum semantics; reason required
- Risk level: `P0`
- Existing protections: reason capture; server/API validation path; append-only intent
- Missing protections: formal concurrency expectations for correcting a response-set after signature or lock must be proven in H2
- Hardening recommendation: assert correction/addendum blocked after final investigator signature unless an approved reopen/addendum pathway exists; add idempotency key for repeated submissions

### H1-015 - Source Validation Findings

- Classification: `source_mutation`, `clinical_mutation`
- UI path: source response-set review and finding row actions
- File/component: `components/source/finding-row-actions.tsx`, `lib/source/findings/actions.ts`, `app/api/source/findings/create/route.ts`, `app/api/source/findings/acknowledge/route.ts`, `app/api/source/findings/resolve/route.ts`, `app/api/source/findings/waive/route.ts`
- Server action/API/RPC: finding create/acknowledge/resolve/waive API routes; write client helpers
- DB tables or artifact path touched: source finding tables; source response-set chronology; operational event side effects depending on RPC
- Permission assumptions: source API auth context; org membership; source write/review permission expected
- Audit event emitted: expected via API/RPC lineage
- Rollback/idempotency expectation: finding state transitions should be append-only or guarded; exact idempotency must be verified
- Risk level: `P1`
- Existing protections: server-side API path; structured finding action forms
- Missing protections: documented state machine and duplicate/late action handling
- Hardening recommendation: define allowed finding transitions and assert stale action rejection in smoke tests

### H1-016 - Procedure Signature

- Classification: `signature_mutation`, `clinical_mutation`, `source_mutation`, `unblinded_sensitive`
- UI path: visit workspace procedure toolbar
- File/component: `components/subjects/visits/VisitActionToolbar.tsx`, `lib/subject/visit-runtime/actions.ts`, `lib/visit-runtime/signProcedure.ts`
- Server action/API/RPC: `signProcedureAction`, `signProcedure`
- DB tables or artifact path touched: `procedure_executions`, `operational_events`
- Permission assumptions: signed-in user; `canSignClinicalSource`; unblinded procedure requires `canViewUnblindedData`
- Audit event emitted: `PROCEDURE_SIGNED` through `logProcedureOperationalEvent`
- Rollback/idempotency expectation: guarded update `.eq('is_signed', false)`; idempotent return if already signed
- Risk level: `P0`
- Existing protections: submitted response-set required; source engine signature readiness; completed/signed state persisted; procedure locked on sign
- Missing protections: signature update and operational event insert are not visibly one transaction
- Hardening recommendation: transactionally bind signature persistence and event emission; prove investigator/coordinator chronology constraints where applicable

### H1-017 - Procedure Runtime Notes, Validation, Field/Section Disable

- Classification: `clinical_mutation`, `source_mutation`
- UI path: visit runtime toolbar/actions
- File/component: `lib/subject/visit-runtime/actions.ts`, `lib/visit-runtime/createVisitNote.ts`, `lib/visit-runtime/validateProcedure.ts`, `lib/visit-runtime/toggleFieldState.ts`
- Server action/API/RPC: `addVisitRuntimeNoteAction`, `validateProcedureAction`, `disablePendingFieldsAction`, `enableFieldsAction`, `disableSectionAction`
- DB tables or artifact path touched: `procedure_executions`, `operational_events`, validation status fields
- Permission assumptions: signed-in actor; organization access; permission checks depend on each action path and need confirmation in H2
- Audit event emitted: `NOTE_ADDED`, `VALIDATION_EXECUTED`, `FIELD_LOCKED`, `FIELD_UNLOCKED`, `SECTION_DISABLED`, `SECTION_ENABLED`, `PROCEDURE_REOPENED`
- Rollback/idempotency expectation: event logging expected for state changes; concurrency behavior needs proof
- Risk level: `P1`
- Existing protections: operational event types exist; procedures can be disabled/reopened with reason
- Missing protections: expected state/version guard for simultaneous field toggles; role-specific permission proof
- Hardening recommendation: add stale-write guard and smoke tests for two-user field disable/enable collisions

### H1-018 - Visit Progress Note and Closeout Signatures

- Classification: `signature_mutation`, `clinical_mutation`
- UI path: visit closeout/progress note panels
- File/component: `components/subjects/visits/ProgressNoteEditor.tsx`, `components/subjects/visits/CoordinatorSignatureCard.tsx`, `components/subjects/visits/InvestigatorSignatureCard.tsx`, `lib/subject/visits/progress-note/actions.ts`
- Server action/API/RPC: `saveVisitProgressNoteAction`, `signCoordinatorProgressNoteAction`, `reopenCoordinatorProgressNoteAction`, `signInvestigatorReviewAction`, `reopenInvestigatorReviewAction`; RPCs `sign_visit_coordinator_closeout`, `reopen_visit_coordinator_closeout`, `sign_visit_investigator_closeout`, `reopen_visit_investigator_closeout`
- DB tables or artifact path touched: `visit_progress_notes`, `visits`, `operational_events`
- Permission assumptions: org write access for notes; investigator signature role via `canSignClinicalSourceForRole`; coordinator/investigator ordering guards
- Audit event emitted: `NOTE_ADDED`, `COORDINATOR_SIGNED`, `INVESTIGATOR_SIGNED`, `CLOSEOUT_REOPENED`
- Rollback/idempotency expectation: closeout RPCs expected to guard chronology; `applyVisitCompletionCoupling` runs after investigator signature and may update visit completion separately
- Risk level: `P0`
- Existing protections: closeout guards, coordinator before investigator ordering, edit-after-sign blocking, reopen actions
- Missing protections: post-sign visit completion coupling is separate from signature RPC; note save event is separate from note update
- Hardening recommendation: combine investigator signature and visit completion coupling transactionally, or add compensating event/state if completion coupling fails

### H1-019 - Visit Complete and Lock

- Classification: `clinical_mutation`, `signature_mutation`
- UI path: visit lifecycle actions
- File/component: `components/clinical/visit-lifecycle-actions.tsx`, `lib/actions/complete-visit.ts`, `lib/actions/lock-visit.ts`
- Server action/API/RPC: `completeVisit`, `lockVisit`, RPCs `complete_visit`, `lock_visit`
- DB tables or artifact path touched: `visits`, `operational_events` or audit metadata from RPC
- Permission assumptions: authenticated Supabase user; explicit organization role check not visible in wrappers
- Audit event emitted: `VISIT_COMPLETED`, `VISIT_LOCKED` audit log; RPC may return `operational_event_id`
- Rollback/idempotency expectation: RPC returns idempotent flag; wrappers do not mutate on failed RPC
- Risk level: `P0`
- Existing protections: RPC lifecycle gates; idempotency response; no wrapper-level optimistic success
- Missing protections: explicit role permission in wrappers and guaranteed audit write
- Hardening recommendation: assert role permission before RPC and require RPC to persist authoritative operational event as part of transaction

### H1-020 - Visit Documents

- Classification: `clinical_mutation`
- UI path: `/studies/[studyId]/subjects/[subjectId]/visits/[visitId]/documents`
- File/component: `app/(ops)/studies/[studyId]/subjects/[subjectId]/visits/[visitId]/documents/page.tsx`, `lib/subject/visit-documents/actions.ts`
- Server action/API/RPC: visit document actions
- DB tables or artifact path touched: visit document metadata and storage paths depending on action implementation
- Permission assumptions: org/study/visit access; source/document management permission should be confirmed
- Audit event emitted: must be verified in H2
- Rollback/idempotency expectation: file storage plus metadata mutation can be non-atomic unless explicitly handled
- Risk level: `P1`
- Existing protections: dedicated visit document surface exists
- Missing protections: storage/object metadata atomicity and audit event proof
- Hardening recommendation: verify upload/delete paths; require metadata insert before success and compensating storage cleanup on metadata failure

### H1-021 - Conditional Procedure Instantiation

- Classification: `clinical_mutation`
- UI path: visit workspace conditional procedures panel
- File/component: `components/subjects/visits/ConditionalProceduresPanel.tsx`, `lib/visits/conditional-procedures.ts`
- Server action/API/RPC: `instantiateConditionalProcedureAction`, RPC `instantiate_conditional_procedure_execution`
- DB tables or artifact path touched: `procedure_executions`, possibly operational events from RPC
- Permission assumptions: org/visit access expected; exact role guard must be verified
- Audit event emitted: not confirmed in action wrapper
- Rollback/idempotency expectation: RPC expected to prevent duplicate conditional execution rows
- Risk level: `P1`
- Existing protections: database RPC path exists; conditional procedure model separates required from conditional
- Missing protections: explicit audit event and duplicate proof in smoke tests
- Hardening recommendation: require unique conditional execution constraint and append event on instantiation

### H1-022 - Clinical Profile, ConMeds, Allergies, Medical History, AEs

- Classification: `clinical_mutation`
- UI path: subject clinical profile and safety sections
- File/component: `components/subject/conmed-section.tsx`, `components/subject/medical-history-section.tsx`, `lib/subject/clinical-profile/actions.ts`, `lib/subject/adverse-events/actions.ts`
- Server action/API/RPC: profile add/update/resolve/verify/discontinue actions, AE add/update actions
- DB tables or artifact path touched: subject clinical profile tables, adverse event tables, profile audit tables/events
- Permission assumptions: signed-in actor and org/subject access in action resolver
- Audit event emitted: profile audit via `writeProfileEvent`; AE audit behavior must be verified
- Rollback/idempotency expectation: mostly row-level mutations; stale write protection must be verified per action
- Risk level: `P1`
- Existing protections: action-layer subject/org resolution and audit helper for profile records
- Missing protections: consistent expected-version guards and finalization lock checks after subject/visit closeout
- Hardening recommendation: add or prove stale write guards and block mutation after subject terminal/finalized state unless a correction path is used

### H1-023 - Subject Workflow Actions

- Classification: `clinical_mutation`
- UI path: subject workflow list and operational command center
- File/component: `components/subjects/workflow/SubjectWorkflowList.tsx`, `lib/subject/workflow/actions.ts`, `lib/operations/workflow-events.ts`
- Server action/API/RPC: `createSubjectWorkflowAction`, `resolveSubjectWorkflowAction`
- DB tables or artifact path touched: subject workflow action tables and `operational_events`
- Permission assumptions: org access through `assertOrg`; mutation role should be confirmed
- Audit event emitted: workflow events map to `QUERY_CREATED`, `SIGNATURE_REQUESTED`, `FOLLOW_UP_CREATED`, `QUERY_RESOLVED`
- Rollback/idempotency expectation: action plus event consistency needs proof
- Risk level: `P1`
- Existing protections: workflow event type mapping exists
- Missing protections: duplicate action prevention and stale resolution guard
- Hardening recommendation: enforce workflow state machine and unique open-action identity where clinically relevant

### H1-024 - Operational Calendar Manual Events and Availability

- Classification: `clinical_mutation`, `study_setup_mutation`
- UI path: `/operational-calendar`
- File/component: `app/(ops)/operational-calendar/actions.ts`
- Server action/API/RPC: `createManualCalendarEvent`, `updateManualCalendarEvent`, `completeManualCalendarEvent`, `cancelManualCalendarEvent`, `createAvailabilityBlock`, `updateAvailabilityBlock`, `cancelAvailabilityBlock`
- DB tables or artifact path touched: `operational_events`
- Permission assumptions: signed-in user; accessible organization ids; mutation permission validation
- Audit event emitted: manual calendar and availability actions write append-only `operational_events`
- Rollback/idempotency expectation: event-chain model; update/cancel/complete append new events rather than rewriting original event
- Risk level: `P1`
- Existing protections: availability conflict checks, event-chain resolution, actor attribution
- Missing protections: deduplication/idempotency on repeated submit and strict chronology validation
- Hardening recommendation: add client/server idempotency key and reject update/cancel against stale chain head

### H1-025 - Operational Calendar Protocol Visit Reschedule

- Classification: `clinical_mutation`
- UI path: `/operational-calendar`
- File/component: `app/(ops)/operational-calendar/actions.ts`, `lib/calendar/get-active-visit-reschedule.ts`
- Server action/API/RPC: `rescheduleProtocolVisit`, `cancelProtocolVisitReschedule`
- DB tables or artifact path touched: `operational_events`; linked `visits` read model
- Permission assumptions: signed-in user; mutation permission; scheduled visit lookup
- Audit event emitted: protocol visit reschedule/cancel events in `operational_events`
- Rollback/idempotency expectation: append-only chain; active reschedule resolution derives effective state
- Risk level: `P1`
- Existing protections: linked visit validation and chain model
- Missing protections: collision handling for two users rescheduling same visit simultaneously
- Hardening recommendation: require current chain head or visit `updated_at` in mutation request

### H1-026 - Protocol Intake Review Artifact Edits

- Classification: `publish_candidate_artifact`
- UI path: `/source-builder/intake/review/[draftKey]`
- File/component: `app/(ops)/source-builder/intake/review/[draftKey]/page.tsx`, `lib/protocol-intake-review/actions.ts`
- Server action/API/RPC: `updateReviewItemAction`, `acceptHighConfidenceInSectionAction`, `approveSectionAction`, `generateApprovedDraftAction`
- DB tables or artifact path touched: file artifacts under protocol intake review workspace and approved draft paths
- Permission assumptions: signed-in user; primary organization; `canPrepareSourceDrafts` or `canManageSourceDocuments`
- Audit event emitted: workspace audit array for edited extracted fields; approved artifacts include reviewer metadata
- Rollback/idempotency expectation: file writes are not DB transactions; repeated approval/generation should be deterministic but file concurrency needs proof
- Risk level: `P1`
- Existing protections: edit reason required for changed extracted content; section approval gates; operational sections must be approved before draft generation
- Missing protections: file-write concurrency lock and checksum-based stale write guard
- Hardening recommendation: add draft workspace checksum/version to review mutations before multi-reviewer use

### H1-027 - Phase 12E Publish Candidate Artifacts

- Classification: `publish_candidate_artifact`
- UI path: `/source-builder/intake/publish-prep/[draftKey]`, `/source-builder/intake/publish-prep/[draftKey]/review`, `/source-builder/intake/publish-prep/[draftKey]/snapshot`
- File/component: `lib/protocol-intake-publish-prep/actions.ts`, `components/source-builder/publish-prep/*`
- Server action/API/RPC: `createPublishCandidateAction`, `approvePublishCandidateAction`, `createSourcePackageSnapshotAction`
- DB tables or artifact path touched: file artifacts under `data/source-publish-candidates/[draftKey]`
- Permission assumptions: signed-in user; `canPrepareSourceDrafts` or `canManageSourceDocuments`
- Audit event emitted: artifact audit events `publish_candidate_created`, `publish_candidate_approved`, `source_package_snapshot_created`
- Rollback/idempotency expectation: create candidate overwrites or writes deterministic artifacts; approval blocks duplicate approval; snapshot blocks duplicate snapshot
- Risk level: `P1`
- Existing protections: approved draft detection, preflight blockers, final review blockers, snapshot readiness, checksum/hash evidence, no runtime mutation
- Missing protections: cross-process file lock and explicit artifact version check on approval/snapshot
- Hardening recommendation: preserve artifact-only boundary; add checksum stale-write guard before approval and snapshot creation

### H1-028 - Source Builder Manual/Draft Workspace

- Classification: `source_mutation`, `study_setup_mutation`
- UI path: `/source-builder`, `/source-builder/manual`, `/source-builder/composition`
- File/component: `components/source-builder/source-builder-workspace.tsx`, `components/source-builder/source-builder-draft-list.tsx`, source builder pages
- Server action/API/RPC: client-side save/delete handlers and any backing draft APIs or storage actions should be enumerated in H2
- DB tables or artifact path touched: source builder draft storage or artifact paths depending on implementation
- Permission assumptions: source prep/source management role expected
- Audit event emitted: not confirmed
- Rollback/idempotency expectation: unknown from H1 read
- Risk level: `P1`
- Existing protections: separated builder workspace and publish prep pipeline
- Missing protections: complete mutation path map for draft save/delete, permissions, and audit
- Hardening recommendation: H2 should trace all draft save/delete calls and require role, version, and audit evidence before production use

### H1-029 - Source Engine Telemetry

- Classification: `source_mutation`, `read_only`
- UI path: source capture/review runtime
- File/component: `lib/source-engine/telemetry/log-source-engine-event.ts`
- Server action/API/RPC: Source Engine telemetry helper
- DB tables or artifact path touched: `operational_events`
- Permission assumptions: called from trusted server runtime context
- Audit event emitted: source engine event types; helper is documented as never throwing
- Rollback/idempotency expectation: non-blocking telemetry by design
- Risk level: `P2`
- Existing protections: append-only operational event stream; non-blocking behavior avoids clinical workflow failure
- Missing protections: non-throwing telemetry can hide evidence gaps
- Hardening recommendation: keep non-blocking for telemetry, but add periodic audit reconciliation that detects missing engine events for submitted/signed source sets

### H1-030 - Read-Only Operational Surfaces

- Classification: `read_only`
- UI path: command center, study workspace readiness, subject workspaces, performance read pages
- File/component: `lib/ops/command-center-read-model.ts`, `lib/ops/workspace-read-model.ts`, `lib/studies/runtime-readiness.ts`, performance read model files
- Server action/API/RPC: read model loaders and RPC `phase4c_publish_package_is_consistent`
- DB tables or artifact path touched: reads `operational_events`, study/subject/visit/procedure/source runtime tables
- Permission assumptions: org membership and page-level auth
- Audit event emitted: none required for read-only access unless regulated read audit is later required
- Rollback/idempotency expectation: not applicable
- Risk level: `P2`
- Existing protections: runtime readiness is computed and not stored as a fake flag
- Missing protections: read models can drift if mutation paths skip audit events
- Hardening recommendation: after H2 mutation hardening, add consistency probes that compare read model states against authoritative runtime tables

### H1-031 - Source Builder Draft Create/Save/Delete

- Classification: `source_mutation`, `study_setup_mutation`
- UI path: `/source-builder`
- Owner: Source Pipeline
- File/component: `lib/source-builder/draft-actions-server.ts`
- Server action/API/RPC: `createSourceBuilderDraftAction`, `saveSourceBuilderDraftAction`, `deleteSourceBuilderDraftAction`
- DB tables or artifact path touched: `source_builder_drafts`, `source_builder_draft_events`
- Permission assumptions: `canPrepareSourceDrafts` or `canManageSourceDocuments`
- Audit event emitted: Expected through draft events
- Rollback/idempotency expectation: Needs transactional proof for draft overwrite atomicity
- Risk level: `P1`
- Hardening recommendation: Assert RBAC guards; require expected version for draft saves; enforce explicit ownership boundary on deletion

### H1-032 - Admin User/RBAC Role Mutations

- Classification: `unblinded_sensitive`, `study_setup_mutation`
- UI path: `/admin/users`
- Owner: IAM/Admin
- File/component: `lib/admin/users/actions.ts`
- Server action/API/RPC: add member, update roles, deactivate/reactivate user
- DB tables or artifact path touched: `study_members`, `users`
- Permission assumptions: `isOrgAdminForOrganization`
- Audit event emitted: Expected for role changes and access removal
- Rollback/idempotency expectation: Atomic role assignment updates
- Risk level: `P0`
- Hardening recommendation: Audit permission impact on unblinded access and signature authority; ensure deactivated users cannot perform clinical mutation

### H1-033 - Development Migration API

- Classification: `study_setup_mutation`
- UI path: `/api/dev/migrate`
- Owner: DevOps
- File/component: `app/api/dev/migrate/route.ts`
- Server action/API/RPC: Database migration API
- DB tables or artifact path touched: Database schema
- Permission assumptions: Relies on `MIGRATION_ALLOWED` and `MIGRATION_SECRET` environment variables
- Audit event emitted: Database migration logs
- Rollback/idempotency expectation: Standard idempotency for migrations
- Risk level: `P0`
- Hardening recommendation: Address production exposure risk; apply strict deploy hardening recommendations to ensure this API cannot be executed in production

### H1-034 - Procedure PDF Export

- Classification: `read_only`, `unblinded_sensitive`
- UI path: `/api/procedure-executions/[id]/pdf`
- Owner: Clinical Ops
- File/component: `lib/visit-runtime/generateProcedurePdf.ts`, `app/api/procedure-executions/[id]/pdf/route.ts`
- Server action/API/RPC: PDF generation endpoints
- DB tables or artifact path touched: `procedure_executions`, `source_responses`
- Permission assumptions: View permissions for procedure and source data
- Audit event emitted: `PDF_GENERATED` audit event
- Rollback/idempotency expectation: Read-only, repeatable generation
- Risk level: `P1`
- Hardening recommendation: Define audit failure policy question (e.g., if audit event fails to write, does export fail?); secure export/read regulatory sensitivity

### H1-035 - Source Engine Task Materialization

- Classification: `source_mutation`, `clinical_mutation`
- UI path: Internal worker/engine flow
- Owner: Source Engine
- File/component: `lib/source-engine/workflow/task-materializer.ts`
- Server action/API/RPC: Internal materializer
- DB tables or artifact path touched: `subject_workflow_actions`
- Permission assumptions: Internal trusted runtime
- Audit event emitted: `ENGINE_TASKS_MATERIALIZED`, `ENGINE_TASK_MATERIALIZATION_SKIPPED`
- Rollback/idempotency expectation: Idempotency risk during task replay
- Risk level: `P1`
- Hardening recommendation: Address idempotency risk; ensure materializer does not create duplicate workflow actions on retry

### H1-036 - Patient Profile Server Actions

- Classification: `clinical_mutation`
- UI path: `/subjects/[subjectId]`
- Owner: Clinical
- File/component: `lib/subject/patient-profile/actions.ts`
- Server action/API/RPC: Clinical profile mutations
- DB tables or artifact path touched: Patient profile tables
- Permission assumptions: Organization access assumptions
- Audit event emitted: Relies on audit mapping
- Rollback/idempotency expectation: Row-level mutations
- Risk level: `P1`
- Hardening recommendation: Review and fix audit mapping gap if present; enforce strict tenancy and profile access boundary

### H1-037 - Source Response Read API Routes

- Classification: `read_only`, `unblinded_sensitive`
- UI path: `/api/source/response-set/[id]`
- Owner: Source API
- File/component: `app/api/source/response-set/[id]/route.ts`, manifest/history/findings routes if present
- Server action/API/RPC: Read source response API
- DB tables or artifact path touched: `source_response_sets`, `source_responses`
- Permission assumptions: Permission assumptions on blinding and organizational boundaries
- Audit event emitted: Read audit (if required)
- Rollback/idempotency expectation: Non-mutating
- Risk level: `P1`
- Hardening recommendation: Address read-only but audit-sensitive nature; harden regulatory review surface and assure blinding is respected in API outputs

## Top 10 H2/H3/H4 Risk Queue

1. **Source Capture Save/Submit Concurrency**: Prevent double-submit, submit-after-sign, and stale draft overwrites (H1-013).
2. **Atomic Subject Closeout & Eventing**: Bind subject status transitions to their operational events and schedule adjustments transactionally (H1-008).
3. **Atomic Enrollment & Schedule Generation**: Bind enrollment transition and subject schedule generation transactionally (H1-006).
4. **Procedure Signature & Completion Integrity**: Combine investigator signature and visit completion coupling transactionally (H1-018/H1-016).
5. **RBAC & Unblinded Access Mutation Risk**: Ensure admin role mutations safely affect unblinded and signature privileges without retroactive breakage (H1-032).
6. **Procedure Source Binding Retarget Risk**: Require expected binding version and handle existing procedure executions with stale SDVs (H1-003).
7. **Production Migration API Exposure**: Eliminate development migration routes in production to prevent catastrophic schema tampering (H1-033).
8. **Visit Check-In / Status Mutation Permissions**: Explicitly enforce organizational mutation permission before visit status changes (H1-010).
9. **Source Builder Draft Concurrency**: Implement strict draft versioning and concurrent edit protection (H1-031).
10. **Procedure PDF Export Audit Failure**: Define failure policy for PDF exports and enforce read auditing for regulatory review surfaces (H1-034).

## P0 Hardening Gates For H2

- Enrollment and schedule generation must become atomic or prove that compensating rollback leaves no duplicate visits/procedure executions.
- External randomization plus event plus schedule generation must become atomic or expose a deterministic compensating chronology.
- Source capture submit must prove no double-submit, submit-after-sign, stale overwrite, or partial save-success/submit-failure state can corrupt runtime.
- Procedure signature must persist signature and event atomically or expose failed-event reconciliation.
- Visit closeout investigator signature and visit completion coupling must not leave a signed visit in an incoherent lifecycle state.
- Procedure source binding retarget must not silently leave existing procedure executions with stale/unexecutable SDVs.

## H1 Pass/Fail Gates

- PASS: Clinical/runtime mutation paths are now inventoried at action level.
- PASS: 12C/12D/12E artifact pipeline is identified as `publish_candidate_artifact`, not runtime mutation.
- PASS: High-risk mutation boundaries are classified with concrete DB/artifact targets and hardening recommendations.
- FAIL: Production-safe integrity is not yet proven because P0 paths still need transactional or reconciled guarantees.
- FAIL: Some action wrappers rely on RPC/database enforcement without wrapper-level role proof in H1; H2 must verify or patch.
- FAIL: Several audit events are fire-and-forget or expected in RPCs; H2 must verify event persistence as part of the authoritative mutation.

## Minimal Next Hardening Phase

H2 should stay narrow:
- Add or prove transactionality for P0 status/schedule/signature/closeout flows.
- Add stale-write/idempotency guards where repeated submit or concurrent users can collide.
- Verify every P0 mutation emits an attributable event or has a documented compensating event.
- Add smoke tests for duplicate schedule generation, double-submit, sign-before-submit, submit-after-sign, and two-user stale overwrite.
- Do not add dashboards, AI, sponsor features, inventory, or new modules.
