# VILO OS — STUDY CREATION AUDIT (POST SUBJECT RUNTIME)

## FINAL ANSWER REQUIRED
Can a coordinator create, configure, activate, and begin enrolling subjects into a study using only the Vilo OS UI today?
**NO.**

### Remaining P0 Blockers
1. **Study Activation UI:** There is no UI to change the study status from `draft` to `active`. Currently requires manual SQL (`update public.studies set status = 'active'`).
2. **Visit/Procedure Blueprint Binding:** While drafts and packages exist, the actual binding of published source definitions into executable visit schedules for a subject relies on manual scripting or `seed-protocol-runtime-smoke.ts` and `apply-migrations` workflows.
3. **Enrollment Readiness Setup:** Complete setup of randomization rules, subject numbering formats, and site enrollment caps are missing from the UI and require direct inserts or are hardcoded defaults.

---

## 1. Study Creation Architecture Map

- **Protocol Intake:** `DocumentUploadRuntimeShell` -> `/api/document-intake/upload`
- **Drafting & Reconciliation:** `SourceBuilderDraftList` -> `source-builder` components.
- **Source Publish:** `RuntimeSourcePublicationClient` -> `publish_source_package_rpc`.
- **Study Record Creation:** `CreateStudyForm` -> `lib/studies/actions.ts` -> `insert into studies (status = 'draft')`.
- **Activation:** Missing UI Layer.
- **Enrollment:** `subject-runtime` / `SubjectVisitScheduleAction.tsx` (Blocks if study not active or missing blueprints).

## 2. Current End-to-End Flow

| Step | Current Method | UI Available? | SQL Required? | Blocking? |
|---|---|---|---|---|
| **1. Create Study Record** | `CreateStudyForm` in `/studies/new` | Yes | No | No |
| **2. Document Intake** | `DocumentUploadRuntimeShell` | Yes | No | No |
| **3. Source Generation** | `source-builder` | Yes (Drafts) | No | No |
| **4. Source Publish** | `runtime-source-publication` | Yes | No | No |
| **5. Configure Setup** | Missing comprehensive setup UI | No | Yes | Yes |
| **6. Activate Study** | SQL Update `status = 'active'` | No | Yes | Yes (P0) |
| **7. Subject Enrollment** | `SubjectRuntimeWorkspace` | Partial | No | Yes (needs active study) |

## 3. Document Intake Status

| Input | Output | Persistence | Status |
|---|---|---|---|
| Protocol, Schedule of Events, Manuals | `attachments`, document intelligence drafts | `public.attachments`, `/api/document-intake` | Implemented |

## 4. Source Generation Status

| Asset | Generated? | Manual? | Missing? |
|---|---|---|---|
| Visit structure | Yes | Yes (Source Builder) | No |
| Procedure structure | Yes | Yes | No |
| Source forms | Yes | Yes | No |
| Source blueprints | Yes | Yes | No |

## 5. Study Configuration

| Object | Current Creation Method | UI Available? | Manual SQL? | Missing? |
|---|---|---|---|---|
| Study record | UI (`/studies/new`) | Yes | No | No |
| Study version | UI (created with study) | Yes | No | No |
| Visit schedule | Source Builder Drafts | Partial | Yes (binding) | Yes |
| Procedure library | Source Builder Drafts | Partial | Yes (binding) | Yes |
| Enrollment settings | Seed Scripts | No | Yes | Yes |
| Role assignments | UI (created with study) | Partial | Yes (other roles)| Yes |
| Study status | Manual SQL / DB Default | No | Yes | Yes (Activation) |

## 6. Study Activation
| Activation Requirement | Implemented? | Missing? |
|---|---|---|
| Source approved | Yes (Publish Package) | No |
| Visits available | Yes (Drafts) | No |
| Procedures available | Yes | No |
| Activation Trigger | No | Yes (UI for Status Change) |

## 7. SQL Dependency Inventory
| Dependency | Reason | Required? | Can Be Removed? |
|---|---|---|---|
| `UPDATE studies SET status='active'` | No UI toggle exists | Yes | Yes, build activation UI |
| Seed Subject Blueprints / Schedules | Source publishing doesn't auto-bind to enrollment | Yes | Yes, build binding UI |
| Org Member Role Assignment | Study admin is set, but adding Monitors/CRAs needs SQL | Yes | Yes, expand RBAC UI |

## 8. Minimal Study Setup Wizard Specification (Expected Steps)
- **Step 1: Study Information:** Title, Sponsor, Phase (Exists partially)
- **Step 2: Document Intake:** Upload Protocol, SoE, Manuals (Exists)
- **Step 3: Source Generation:** Map protocol to draft (Exists)
- **Step 4: Visit Review:** Approve drafts and publish source (Exists)
- **Step 5: Study Configuration:** Set enrollment targets, assign team roles (Missing)
- **Step 6: Activation:** Final preflight checks and toggle to `active` (Missing)

## 9. Estimated Study Creation Completion %
**75% Complete.** The heavy lifting of document intake, evidence lineage, and source drafting is built. The "last mile" of binding these artifacts to an active runtime and toggling the study state is missing.
