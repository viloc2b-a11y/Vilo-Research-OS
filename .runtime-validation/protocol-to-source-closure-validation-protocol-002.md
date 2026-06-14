# protocol-to-source-closure-validation-protocol-002

```json
{
  "protocol": "VALIDATION_PROTOCOL_002",
  "input": {
    "pdf": "VALIDATION_PROTOCOL_002",
    "version_id": "51949742-fc90-4c57-acc6-450762a8b51e",
    "study_id": "bd94a99a-ac0e-4d0f-b1e5-777066190441",
    "organization_id": "f7cf7d2b-49cd-4bcd-9e15-2675966c3e1e",
    "extraction_status": "ready",
    "extracted_visit_count": 6,
    "extracted_procedure_count": 131,
    "section_count": 23
  },
  "reconciliation": {
    "session_status": "approved",
    "visits_reconciled": 6,
    "procedures_reconciled": 131,
    "visit_approvals": 6,
    "procedure_approvals": 131,
    "conflicts": [],
    "unresolved_items": []
  },
  "runtime": {
    "generation_run_id": "246fdfb8-fbfd-4aa5-9d76-093833d43e3d",
    "generation_status": "generated",
    "runtime_snapshot_id": "7f850177-375f-4283-85cd-a48b01ee989a",
    "runtime_visits_generated": 6,
    "runtime_procedures_generated": 4,
    "study_blueprints_generated": 1
  },
  "source": {
    "source_package_id": "5ac71e71-47ce-4c60-b8a0-7fd0e045b537",
    "source_package_version": 1,
    "source_visit_shells": 6,
    "source_procedure_shells": 4
  },
  "fidelity": {
    "extracted_visits": 6,
    "reconciled_visits": 6,
    "runtime_visits": 6,
    "source_visit_shells": 6,
    "extracted_procedures": 131,
    "reconciled_procedures": 131,
    "runtime_procedures": 4,
    "source_procedure_shells": 4
  },
  "passes": {
    "extraction_persisted": true,
    "reconciliation_pass": true,
    "runtime_pass": true,
    "source_pass": true
  },
  "ids": {
    "generation_run_id": "246fdfb8-fbfd-4aa5-9d76-093833d43e3d",
    "runtime_snapshot_id": "7f850177-375f-4283-85cd-a48b01ee989a",
    "source_package_id": "5ac71e71-47ce-4c60-b8a0-7fd0e045b537"
  },
  "remaining_blockers": [
    "Procedure reconciled→runtime 3.1% (4/131) — extraction row count; runtime dedupes by visit+blueprint",
    "Manifest runtime coverage 17.4% (4/23 bindings)",
    "Closure passes.* true but truth parity fails — report overstates pipeline fidelity"
  ],
  "truth": {
    "truth_pass": false,
    "truth_visits_pass": true,
    "truth_procedures_pass": false,
    "procedure_reconciled_to_runtime": 0.030534351145038167,
    "manifest_runtime_coverage": 0.17391304347826086,
    "visit_parity": true
  }
}
```
