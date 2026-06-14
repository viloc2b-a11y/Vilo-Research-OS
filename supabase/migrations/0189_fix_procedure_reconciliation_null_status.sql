-- Migration 0189: Fix procedure reconciliation NULL status
--
-- Procedure reconciliation rows initialized before the explicit status
-- assignment in initialize-reconciliation-from-candidates.ts had NULL
-- reconciliation_status. runSuggestProcedureMatches queries IN ('needs_review',
-- 'manual_mapping_required') and NULL rows were invisible to it, blocking
-- the full reconciliation workflow.

UPDATE protocol_procedure_reconciliations
SET reconciliation_status = 'needs_review'
WHERE reconciliation_status IS NULL;
