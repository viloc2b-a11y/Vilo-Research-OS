# Phase 1b — Infrastructure validation results

**Run at:** 2026-05-16T00:45:46.350Z

## Summary

| Result | Count |
|--------|-------|
| PASS | 13 |
| FAIL | 0 |
| BLOCKED | 0 |

## Checks

| Check | Status | Detail |
|-------|--------|--------|
| service_role_not_in_client_bundle | PASS | No SERVICE_ROLE references under app/components/lib |
| anon_cannot_read_organizations | PASS | rows=0 |
| sign_in_user_a | PASS | synthetic.staff.a@vilo-os.staging |
| sign_in_user_b | PASS | synthetic.staff.b@vilo-os.staging |
| user_a_sees_only_own_orgs | PASS | count=1 names=Synthetic Site Alpha (Staging) |
| user_b_sees_only_own_orgs | PASS | count=1 names=Synthetic Site Beta (Staging) |
| cross_org_b_cannot_read_org_a | PASS | rows=0 |
| cross_org_membership_isolation | PASS | rows=0 |
| audit_insert_service_role | PASS | inserted |
| audit_insert_blocked_for_anon | PASS | new row violates row-level security policy for table "audit_events" |
| user_a_admin_can_read_audit | PASS | rows=2 |
| user_b_cannot_read_org_a_audit | PASS | rows=0 |
| middleware_public_paths | PASS | Documented: /login, /auth/callback only (see middleware.ts) |

## Security grep (service role in client paths)

- None under app/components/lib

## Manual follow-ups

- Confirm unauthenticated `/` redirects to `/login` in browser
- Confirm authenticated `/login` redirects to `/`
- Re-run after migrations + provision: `npm run db:migrate && npm run db:provision && npm run db:validate`
