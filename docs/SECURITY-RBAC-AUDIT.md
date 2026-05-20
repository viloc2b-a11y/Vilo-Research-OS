# Security / RBAC Data Exposure Audit

Date: 2026-05-20  
Scope: Vilo OS ops shell — organization scoping, site roles, blinding conventions.

## Role / permission model

**Multi-role:** `organization_members.roles text[]` unions with legacy `role` column. Effective permissions = ANY role grants (see `lib/rbac/effective-roles.ts`). RLS helpers still use `role` as primary.

| Role | Admin | Coordinator workspace | Manage visits | Edit source | Sign source | View unblinded | Manage unblinded |
|------|-------|---------------------|---------------|-------------|-------------|----------------|------------------|
| owner | yes | yes | yes | yes | yes | yes | yes |
| admin | yes | yes | yes | yes | yes | no* | no* |
| site_staff | no | yes | no | no | no | no | no |
| research_coordinator | no | yes | yes | yes | no | no | no |
| data_coordinator | no | yes | no‡ | yes | no | no | no |
| pi_sub_i | no | no | no | yes | yes | no | no |
| read_only | no | no | no | no | no | no | no |
| unblinded_coordinator | no | yes | yes | yes | no | yes | yes |
| unblinded_cra | no | no | no | no | no | yes | no (monitor) |
| member (legacy) | no | yes† | yes† | yes† | no | no | no |

‡ `data_coordinator` may open visit/source capture (`canAccessSubjectVisitWorkspace`) but not schedule/reschedule visits (`canManageSubjectVisits`).

\* Site admin does not receive automatic unblinded access per product policy.  
† Legacy `member` normalizes to `research_coordinator`.

Helpers: `lib/rbac/permissions.ts`, `lib/rbac/effective-roles.ts`, `lib/rbac/blinding.ts`, `lib/rbac/org-scope.ts`.

### Blinding convention

Payloads may set:

- `blinding_scope`: `"blinded"` | `"unblinded"` | `"public_to_site"` (default when unset)
- `is_unblinded`: `true` (shorthand for unblinded)

Users without `canViewUnblindedData` do not receive rows with `blinding_scope: "unblinded"` in calendar/command-center read models; sensitive payload keys are redacted in event detail strings.

---

## Findings table

| Area | Route / file | Risk | Finding | Fix applied | Remaining risk |
|------|----------------|------|---------|-------------|----------------|
| Studies portfolio | `app/(ops)/studies/page.tsx` | **High** | `studies` query had no `.in('organization_id', …)` | Added explicit org filter from memberships | RLS still required as backup |
| Command center | `app/(ops)/page.tsx` | **High** | Studies snippet unscoped | Added `.in('organization_id', orgIds)` | Partial — other widgets rely on RLS |
| Subject visits loader | `lib/subject/visits/load-subject-visits.ts` | **High** | No membership check before load | `hasOrganizationMembership` + `notFound` via null | — |
| Subject chart header | `components/subjects/subject-chart-header.tsx` | **Critical** | `randomization_arm` / rand # shown to all | `showUnblindedFields` server gate | Pages must pass flag (wired on visits + subject) |
| Subject general form | `components/subject/subject-general-form.tsx` | **Critical** | Unblinded fields editable by all | Hidden unless `showUnblindedFields` | — |
| Subject general action | `lib/subject/subject-chart/actions.ts` | **High** | Rand/arm updated without role check | `canMutateOrganizationData` + `canManageUnblindedData` on update | Other subject actions not yet gated |
| Operational calendar | `lib/calendar/operational-calendar-read-model.ts` | **Critical** | Unblinded manual/block events visible to blinded users | `filterRowsByBlindingScope` | New events must set `blinding_scope` when created |
| Calendar selectors | `lib/calendar/operational-calendar-selector-options.ts` | **Medium** | Rand # in subject dropdown | Omitted when `!canViewUnblinded` | — |
| Command center events | `lib/ops/command-center-read-model.ts` | **Critical** | Recent events could leak unblinded payloads | Filter + `redactOperationalEventPayloadForDisplay` | — |
| Admin hub | `app/(ops)/admin/page.tsx` | **Medium** | URL reachable by non-admin | Server denial message (no data load) | No redirect — acceptable |
| Sidebar Admin | `components/shell/sidebar-nav.tsx` | **Low** | Link hidden but URL exists | Shown only for owner/admin | — |
| Study detail | `app/(ops)/studies/[studyId]/page.tsx` | **Low** | Already checks org membership | No change | — |
| Source capture | `app/(ops)/source/capture/*` | **High** | No site-role gate on IP fields in engine | Not changed this pass | Audit source field catalog + capture shell |
| VPI / performance | `app/(ops)/performance/*` | **Medium** | Org-scoped via memberships; risk queue may aggregate cross-study | Not changed | Review risk reasons for arm/treatment text |
| Source builder | `app/(ops)/source-builder/*` | **Medium** | Templates not role-gated beyond auth | Not changed | Tie to `canManageTemplates` in future |
| Operational calendar actions | `app/(ops)/operational-calendar/actions.ts` | **High** | Mutations lack site-role checks | Not changed this pass | Add `canManageSubjectVisits` / unblinded on writes |
| `user_is_org_admin` RPC | `0001_auth_foundation.sql` | **Low** | DB helper still `owner`/`admin` only | Correct for site admin | New roles not in RPC (by design) |
| Regulatory / financial / reports | Sidebar “soon” | **Low** | Routes not implemented | N/A | — |

---

## Validation

- `npx tsc --noEmit`
- `npm run build`
- Apply migration `0057_unblinded_organization_roles.sql` before assigning new roles in DB.

## Manual QA checklist

- [ ] Owner/admin: Admin visible; `/admin` loads.
- [ ] research_coordinator: no Admin nav; `/admin` shows denial; no rand/arm in subject header.
- [ ] unblinded_coordinator: rand/arm visible when assigned; can edit unblinded subject fields.
- [ ] unblinded_cra: can view unblinded fields if granted role; cannot mutate general form (read-only role).
- [ ] read_only: general form mutation rejected.
- [ ] Org A user cannot load org B subject (`loadSubjectVisitsPage` returns null → 404).
- [ ] Calendar: create manual event with `payload.blinding_scope: "unblinded"` — blinded user must not see it.

## Unresolved risks (next phases)

1. Wire `canManageSubjectVisits` / `canEditClinicalSource` on all server actions (calendar, visits, source).
2. Source capture / response payloads — field-level blinding in read contract and PDF export.
3. `study_subjects.randomization_arm` still readable via direct API if RLS on column is not restricted — app-layer redaction only today.
4. Study assignment: unblinded roles should be limited to assigned studies (study_members) — not enforced at org role level yet.
5. No “hidden count” audit on list UIs — verify VPI/risk queues do not imply concealed rows.
