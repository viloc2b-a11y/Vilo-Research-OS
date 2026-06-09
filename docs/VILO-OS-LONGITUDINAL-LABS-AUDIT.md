# VILO OS Longitudinal Labs Audit

## Scope

Pre-implementation audit of longitudinal lab capabilities inside the existing Vilo OS runtime spine.

Constraint: no new lab platform, no second source of truth, no diagnosis, no automation beyond operational intelligence.

## Classification

| Capability | Status | Evidence | Notes |
|---|---|---|---|
| Lab domain / field definitions in source runtime | Existing | `lib/source-engine/definitions/field.catalog.ts`, `lib/source-engine/definitions/section.catalog.ts`, `lib/source-engine/config.library.ts`, `lib/source-engine/canonical-clinical-library.ts` | Lab fields already exist as first-class source/runtime fields (`collection_date`, `result_value`, `reference_low`, `reference_high`, `abnormal_flag`, etc.). |
| Source response storage for atomic facts | Existing | `supabase/migrations/0021_source_responses.sql`, `supabase/migrations/0015_source_definition_versions.sql`, `supabase/migrations/0027_published_source_definitions.sql` | Existing storage can hold typed lab facts and current history without new tables. |
| Visit-linked lab document chronology | Existing | `lib/subject/lab-timeline/load-subject-lab-timeline.ts`, `components/subject/labs/SubjectLabTimelinePanel.tsx`, `app/(ops)/subjects/[subjectId]/page.tsx` | A chronology of lab documents already existed, but it was document-level only. |
| Published source field metadata for section classification | Existing | `published_source_fields`, `published_source_sections` | Useful for identifying lab sections and normalizing source fields. |
| Longitudinal runtime derivation | Missing | N/A | No subject-level runtime that computes baseline / previous / current / deltas / percent changes from existing lab observations. |
| Trend engine | Missing | N/A | No explainable improving/stable/worsening/fluctuating state derived from lab series. |
| Operational longitudinal lab signals | Missing | N/A | No derived signals such as worsening trends, repeated abnormal values, overdue follow-up, or missing repeat labs. |
| VPI / coordinator queue integration for labs | Missing | Existing VPI scoring spine, but no lab signal source | VPI already had the scoring pipeline, but labs were not yet consumed as signals. |
| Governance linkage for lab signals | Partial | Existing governance/runtime states | Governance states existed, but there was no lab-derived signal feeding review / signoff attention. |
| Subject chart surface for longitudinal labs | Partial | `app/(ops)/subjects/[subjectId]/page.tsx` | The subject chart had a documents tab and lab chronology, but no structured runtime facts or signals. |

## Summary

The audit found that Vilo OS already had the right storage and source-runtime primitives for labs, but it did not yet have a dedicated longitudinal runtime that could turn those facts into operational intelligence.

The safest path was to reuse existing source responses and published source metadata, derive lab runtime facts on read, and surface only operational signals to the coordinator and VPI.

No new source-of-truth layer was introduced.

