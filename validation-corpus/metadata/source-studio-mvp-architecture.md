# Source Studio MVP - Architecture & Implementation Report

## 1. Architecture
Source Studio is the missing human-in-the-loop bridge between the VIP Document Intake parser (AI) and the Subject Visit Runtime (Execution). 
It is a React-based workspace that loads the latest `DRAFT` (or AI-generated) source blueprint, allowing the Clinical Research Coordinator (CRC) to mutate it, save it, and commit it as `PUBLISHED`.

**Flow:**
1. AI generates `SourceFormBlueprint` payload (JSON).
2. Studio loads payload into React state.
3. CRC mutates fields, instructions, and procedures.
4. CRC hits "Save Draft" -> Updates DB row.
5. CRC hits "Publish" -> Sets `status = 'PUBLISHED'` and locks the version.
6. Visit Runtime consumes the `PUBLISHED` version exclusively.

## 2. Routes
- **Route:** `/studies/[studyId]/source-studio`
- **Layout:** Inherits the standard Vilo OS OpsShell/Study Layout.
- **Server Component:** Fetches the active Draft blueprint for the study and passes it to the Client Component workspace.

## 3. Components
Implemented in `components/source-studio/`:
- **`SourceStudioWorkspace`**: The main orchestrator (Client Component) holding the form state.
- **`FormNavigator`**: Left sidebar listing available forms (Screening, Baseline, EOS).
- **`FormEditor`**: Center panel for adding/editing/removing data capture fields (Label, Type, Required, Instructions).
- **`ProcedureEditor`**: Right panel managing the procedures assigned to the active form, allowing reordering and removal.

## 4. Database Persistence Path
All state must persist to Supabase. We utilize a document-based NoSQL approach within a structured table to allow flexible form definitions without DB migrations for every new field type.

**Table:** `source_form_blueprints`
- `id` (uuid, PK)
- `study_id` (uuid, FK)
- `name` (text) - e.g., "Screening Visit"
- `status` (enum: 'DRAFT', 'PUBLISHED')
- `version` (int)
- `payload` (jsonb) - Contains the full array of `procedures` and `fields`.
- `created_by` (uuid)
- `published_at` (timestamp, nullable)

**Server Actions (`lib/source-studio/actions.ts`):**
- `saveDraftBlueprint(studyId, payload)`
- `publishBlueprint(studyId, blueprintId)`

## 5. State Model
The Studio uses a lifted state model in `SourceStudioWorkspace`.
- `activeFormId`: string
- `forms`: `SourceFormBlueprint[]`
- `isDirty`: boolean
- `isSaving`: boolean

Mutations (Add Field, Remove Procedure) update the `forms` array locally. `isDirty` triggers. "Save Draft" pushes the entire JSONB payload back to the server action.

## 6. User Workflow
1. CRC navigates to **Study > Source Studio**.
2. Selects "Screening Form" from the **Form Navigator**.
3. Notices the AI forgot to add a field for "Fasting Hours".
4. Clicks "Add Field" in the **Form Editor**, sets Label = "Fasting Hours", Type = "Number", Required = True.
5. Adjusts the **Procedure Editor** to move "Blood Draw" before "ECG".
6. Clicks **Save Draft**.
7. Clicks **Publish**. The form is now locked and instantly available to the Subject Visit Runtime.

## 7. Test Plan
- **Unit Tests (`tests/source-studio.test.tsx`):**
  - Verify `AddField` updates local state.
  - Verify `RemoveProcedure` removes the item.
  - Verify `Publish` action calls the mocked server action and disables further edits.
- **E2E Validation:** Verify the CRC can traverse the UI without triggering any Governance blocks, as this is a pre-execution setup task.

---

### Implementation Status
The MVP UI, Server Actions, and Types have been fully scaffolded and deployed to the Vilo OS codebase in this sprint.
