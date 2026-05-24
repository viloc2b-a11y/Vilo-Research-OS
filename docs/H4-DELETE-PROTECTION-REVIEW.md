# H4 Phase 3: Delete Protection Review

## Overview
This document evaluates the database-level `DELETE` protections for critical runtime tables within the Vilo OS Clinical Execution Engine. It classifies each table's mutability requirements, identifies existing protections, and proposes native Postgres `BEFORE DELETE` triggers where necessary to prevent accidental or malicious destruction of clinical data beyond the application layer.

## Inventory & Assessment

### 1. `visits`
*   **Classification:** `delete_blocked_after_runtime_creation`
*   **Current Protection:** RLS allows `DELETE` by `org_admin` or `study_admin`. No DB trigger blocks deletion.
*   **Delete Risk:** **CRITICAL**. Deleting a visit relies on `ON DELETE CASCADE` down to `procedure_executions`, `source_response_sets`, `visit_progress_notes`, and `source_responses`. A direct SQL delete would destroy an entire clinical interaction.
*   **Recommended Policy:** Block `DELETE` unconditionally if `visit_status != 'scheduled'`. Once a visit enters `checked_in` or `in_progress`, it must be transitioned to `cancelled` or `no_show` rather than deleted.
*   **Migration Required:** **Yes** (Severity: P0)

### 2. `procedure_executions`
*   **Classification:** `delete_blocked_after_runtime_creation`
*   **Current Protection:** RLS allows `DELETE` by `org_admin` or `study_admin`.
*   **Delete Risk:** **HIGH**. Application layer currently relies on `cancelled` or `not_applicable` statuses for logical deletion. However, direct DB/Supabase Studio access could permanently drop executions and their linked source data.
*   **Recommended Policy:** Block `DELETE` unconditionally if `execution_status != 'pending'`. 
*   **Migration Required:** **Yes** (Severity: P1)

### 3. `source_response_sets`
*   **Classification:** `delete_allowed_only_for_draft_cleanup`
*   **Current Protection:** **Strong.** RLS has no `DELETE` policy, meaning authenticated JWT roles cannot delete rows.
*   **Delete Risk:** **MEDIUM.** While the app is protected, service roles or cascading deletes from parent tables could remove sets.
*   **Recommended Policy:** Block `DELETE` if `status` is not `'draft'` or `'archived'`. 
*   **Migration Required:** **Yes** (Severity: P2)

### 4. `source_responses`
*   **Classification:** `must_be_append_only`
*   **Current Protection:** **Strong.** RLS has no `DELETE` policy.
*   **Delete Risk:** **LOW/MEDIUM.** Only vulnerable to service roles or cascade.
*   **Recommended Policy:** Block `DELETE` unconditionally if `is_submitted = true`. Regulatory compliance requires correction chains (append-only), not destructive deletes.
*   **Migration Required:** **Yes** (Severity: P1)

### 5. `visit_progress_notes`
*   **Classification:** `must_be_append_only` (after signature)
*   **Current Protection:** RLS has no `DELETE` policy.
*   **Delete Risk:** **LOW.** Only vulnerable to service roles or cascade.
*   **Recommended Policy:** Block `DELETE` if `coordinator_signature_status = 'signed'` or `investigator_review_status = 'signed'`.
*   **Migration Required:** **Yes** (Severity: P2)

### 6. `operational_events`
*   **Classification:** `must_be_append_only`
*   **Current Protection:** **Absolute.** RLS has no `DELETE` policy. `operational_events_immutability_guard` DB trigger blocks `DELETE` unconditionally at the engine level.
*   **Delete Risk:** **NONE.**
*   **Migration Required:** **No** (Completed in H4 Phase 2)

---

## Proposed Migration Strategy (DO NOT APPLY YET)

If approved, H4 Phase 4 will introduce `0074_h4_phase3_delete_protections.sql` containing the following architecture:

```sql
-- 1. Visits Delete Guard
CREATE OR REPLACE FUNCTION public.enforce_visit_delete_protection()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  IF OLD.visit_status != 'scheduled' THEN
    RAISE EXCEPTION 'Cannot delete visit with status %; use cancellation instead.', OLD.visit_status;
  END IF;
  RETURN OLD;
END;
$$;
CREATE TRIGGER visits_delete_guard BEFORE DELETE ON public.visits FOR EACH ROW EXECUTE FUNCTION public.enforce_visit_delete_protection();

-- 2. Procedure Executions Delete Guard
CREATE OR REPLACE FUNCTION public.enforce_procedure_execution_delete_protection()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  IF OLD.execution_status != 'pending' THEN
    RAISE EXCEPTION 'Cannot delete procedure_execution with status %; use cancellation instead.', OLD.execution_status;
  END IF;
  RETURN OLD;
END;
$$;
CREATE TRIGGER procedure_executions_delete_guard BEFORE DELETE ON public.procedure_executions FOR EACH ROW EXECUTE FUNCTION public.enforce_procedure_execution_delete_protection();

-- 3. Source Responses Delete Guard
CREATE OR REPLACE FUNCTION public.enforce_source_responses_delete_protection()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  IF OLD.is_submitted = true THEN
    RAISE EXCEPTION 'Cannot delete submitted source responses; must use correction chain.';
  END IF;
  RETURN OLD;
END;
$$;
CREATE TRIGGER source_responses_delete_guard BEFORE DELETE ON public.source_responses FOR EACH ROW EXECUTE FUNCTION public.enforce_source_responses_delete_protection();
```
