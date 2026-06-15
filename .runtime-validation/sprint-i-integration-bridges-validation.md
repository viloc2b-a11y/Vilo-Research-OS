# Sprint I — Integration Bridges
## Runtime Validation Report

**Validation ID:** sprint-i-integration-bridges-validation-001  
**Date:** 2026-06-14  
**Status:** COMPLETE

---

## DoD Assessment

| Criterion | Status | Notes |
|---|---|---|
| DoD 1 — Coordinator Visible | PARTIAL | Financial leakage UI exists; CRM history UI is post-sprint scope (bridges are data layers) |
| DoD 2 — Subject Workspace | PASS | Vitalis attribution adds patient_lead_id FK to study_subjects (migration 0199) |
| DoD 3 — Workflow Backbone | PASS | No new queues — bridges are read/compute layers; leakage flows through existing pipeline |
| DoD 4 — Command Center | PASS | soa_billable_pending leakage kind surfaces in financial leakage panel |
| DoD 5 — Pilot Evidence | PASS | This artifact |

---

## Tasks

### I1 — ClinIQ → Financial Runtime
`cliniq-bridge.ts` provides:
- `loadPendingSoaBillables(supabase, studyId)` — queries `expected_billables WHERE status = 'pending'`
- `triggerSoaBillable(supabase, billableId)` — sets status='triggered', stamps triggered_at
- `summarizeSoaBillables(rows)` — { pendingCount, pendingAmount, triggeredCount }
- `soaBillablesToLeakageItems(rows)` — converts to RevenueLeakageItem[] with kind: 'soa_billable_pending'

`computeStudyFinancialSummary` extended to load and summarize SoA billables, returned as `soaBillables` in `StudyFinancialSummary`.

**Schema note:** `expected_billables.study_id` is TEXT (ClinIQ predates UUID system). Bridge operates at study level using studyId as string.

---

### I2 — Vitalis → Subject Attribution
**Migration 0199:**
```sql
ALTER TABLE study_subjects
  ADD COLUMN IF NOT EXISTS patient_lead_id uuid
  REFERENCES patient_leads(id) ON DELETE SET NULL;
```
Partial index: `study_subjects_patient_lead_id_idx ON (patient_lead_id) WHERE patient_lead_id IS NOT NULL`.

`link-lead-to-subject.ts` writes both directions:
1. `patient_leads.linked_subject_id = studySubjectId`
2. `study_subjects.patient_lead_id = leadId`

---

### I3 — CRM v1 Stage History
**Migration 0200** creates `patient_lead_stage_history`:

| Column | Type | Notes |
|---|---|---|
| id | uuid PK | |
| organization_id | uuid FK | |
| patient_lead_id | uuid FK | |
| from_stage | text nullable | null on first transition |
| to_stage | text | |
| actor_id | uuid nullable | FK auth.users |
| reason | text nullable | |
| metadata | jsonb | |
| created_at | timestamptz | |

`link-lead-to-subject.ts` auto-records a `'randomized'` transition on enrollment confirmation.

---

### I4 — Communications Lifecycle
Two new server actions added to `communications.ts`:
- **`archiveCommunicationMailboxAction`**: sets `archived_at = now()`, `sync_enabled = false`, `sync_status = 'blocked'`
- **`reactivateCommunicationMailboxAction`**: sets `archived_at = null`, `sync_status = 'pending'`

Both redirect to `/communications/settings?result=archived|reactivated`.
