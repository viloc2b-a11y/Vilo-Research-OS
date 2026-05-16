# Phase 2 — Schema validation results

**Run at:** 2026-05-16T00:56:41.765Z

## Summary

| Result | Count |
|--------|-------|
| PASS | 18 |
| FAIL | 0 |
| BLOCKED | 0 |
| SKIP | 1 |

**Phase 2 status:** GREEN — all required checks executed (skipped rows optional).

## Checks

| Check | Status | Detail |
|-------|--------|--------|
| catalog_postgres_connection | SKIP | No DATABASE_URL_DIRECT or DATABASE_URL — skipped catalog/policy introspection (Supabase MCP or SQL Editor can still confirm). |
| seed_study_member | PASS | coordinator for synthetic.staff.a |
| seed_visit_def_procedure_map | PASS | reused |
| seed_operational_event | PASS | reused VISIT_SCHEDULED |
| provision_user_c_reused | PASS | synthetic.staff.c.orga.only@vilo-os.staging |
| provision_user_c_study_members_cleared | PASS | study_id=6bae715a-8536-4000-8d24-22b6a3dbb8c9 |
| seed_attachment_service_role | PASS | reused id=7e121a09-384b-4708-926e-6941484fbca7 |
| isolation_user_a_reads_own_study | PASS | rows=1 |
| isolation_user_a_reads_operational_events | PASS | rows=1 |
| attachments_user_a_reads_visit_linked_row | PASS | {"id":"7e121a09-384b-4708-926e-6941484fbca7","file_name":"demo-visit-attachment.txt"} |
| append_only_operational_events_update_blocked | PASS | (rows_returned=0) JWT update must touch 0 rows |
| append_only_operational_events_delete_blocked | PASS | (rows_returned=0) JWT delete must touch 0 rows |
| isolation_user_b_org_boundary_study_hidden | PASS | rows=0 |
| attachments_user_b_org_beta_cannot_read_org_a_attachment | PASS | rows=0 |
| same_org_user_c_reads_own_organization | PASS | {"id":"f7cf7d2b-49cd-4bcd-9e15-2675966c3e1e"} |
| same_org_user_c_cannot_read_phase2_validation_study | PASS | rows=0 |
| same_org_user_c_cannot_read_study_versions | PASS | rows=0 |
| same_org_user_c_cannot_read_operational_events | PASS | rows=0 |
| same_org_user_c_cannot_read_org_a_attachment_on_study | PASS | rows=0 |

## Catalog excerpt (tables + RLS)

```json
[]
```

## Synthetic seed (service role)

```json
{
  "seedSteps": {
    "study": "reused",
    "study_version": "reused",
    "visit_definition": "reused",
    "procedure_definition": "reused",
    "subject": "reused",
    "visit": "reused",
    "procedure_execution": "reused",
    "attachment": "reused"
  },
  "ids": {
    "study_id": "6bae715a-8536-4000-8d24-22b6a3dbb8c9",
    "study_version_id": "a6ef7089-1415-45d0-b435-4b5ca2b38328",
    "visit_definition_id": "43b1295e-42f1-4f7a-9c80-24c03db320db",
    "procedure_definition_id": "17059af6-37fa-48a5-9bef-e82b7e2606b1",
    "study_subject_id": "3bae1645-b94b-441c-b081-916a03896b0e",
    "visit_id": "f3f5949b-624a-47b8-8ab8-9ef919d9a5bc",
    "procedure_execution_id": "d0598454-eac9-4fb9-8793-36c15a3f36bc",
    "operational_event_id": "1c68794c-db91-4c8b-8702-5faae05d9622",
    "user_c_id": "ca4be5ed-35c1-45ff-a26f-ba22a8ead22b",
    "attachment_id": "7e121a09-384b-4708-926e-6941484fbca7"
  }
}
```

## Commands

`npm run db:validate-phase2`

---

### A. Attachments isolation

See checks: `seed_attachment_service_role`, `attachments_user_a_reads_visit_linked_row`, `attachments_user_b_org_beta_cannot_read_org_a_attachment`.
- User A (**study coordinator**) reads visit-linked attachment row.
- User B (**Org Beta**) returns **zero** rows for Org A attachment id (cross-org).

### B. Same-org, non–`study_members` principal (User C)

See checks: `same_org_user_c_reads_own_organization`, `same_org_user_c_cannot_*`.
- **synthetic.staff.c.orga.only@vilo-os.staging** keeps `organization_members.role = member` only; **`study_members` row removed** for the Phase 2 validation study.
- User C still reads **`organizations`** for Org Alpha (org-level baseline visibility).
- User C **cannot read** Phase 2 study, study_versions, operational_events on that study, or the attachment seeded for coordinators.

### C. Validation summary

Latest counts: PASS 18, FAIL 0, BLOCKED 0, SKIP 1.

### D. Remaining risks

- **Storage buckets:** Attachment row is metadata-only (`storage_bucket=phase2-validation`); aligned Storage RLS is **Phase 2b**.
- **`DATABASE_URL_DIRECT` / `DATABASE_URL` omitted:** Postgres catalog/policy introspection still **SKIP** until configured.
- **Synthetic-only:** User C credential lives in validator script (`SyntheticViloOs!2026C`) — staging only.

### E. Fully green?

Yes — GREEN for JWT + seeded clinical slice + attachments + Org A lateral isolation (SKIP catalog optional).
