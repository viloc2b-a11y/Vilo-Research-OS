import { z } from 'zod'
import type { SystemLibraryCategory } from './system-library'

// ── Types ────────────────────────────────────────────────────────────────────

export type StudySystemEntry = {
  study_system_id: string
  study_id: string
  system_library_id: string | null
  system_name: string
  vendor_name: string | null
  system_type: string
  system_category: string | null
  launch_url: string | null
  support_email: string | null
  support_url: string | null
  training_url: string | null
  login_notes: string | null
  owner_role: string | null
  active: boolean
  pinned: boolean
  is_custom: boolean
  created_by: string | null
  created_at: string
  updated_at: string
}

// ── Input types for server actions ────────────────────────────────────────────

export type AddFromLibraryInput = {
  studyId: string
  librarySystemId: string
  launchUrl?: string | null
  supportEmail?: string | null
  supportUrl?: string | null
  trainingUrl?: string | null
  loginNotes?: string | null
  ownerRole?: string | null
}

export type AddCustomSystemInput = {
  studyId: string
  systemName: string
  vendorName?: string | null
  systemType: string
  systemCategory?: string | null
  launchUrl?: string | null
  supportEmail?: string | null
  supportUrl?: string | null
  trainingUrl?: string | null
  loginNotes?: string | null
  ownerRole?: string | null
}

export type UpdateStudySystemInput = {
  studySystemId: string
  launchUrl?: string | null
  supportEmail?: string | null
  supportUrl?: string | null
  trainingUrl?: string | null
  loginNotes?: string | null
  ownerRole?: string | null
  active?: boolean
  pinned?: boolean
}

export type StudySystemActionResult = {
  ok: boolean
  error?: string
  data?: StudySystemEntry
}

// ── Zod schemas ───────────────────────────────────────────────────────────────

const toStringOrNull = (v: unknown): string | null =>
  v == null || v === '' ? null : String(v)

const toBoolean = (v: unknown): boolean => v === true || v === 'true'

export const studySystemRowSchema = z.object({
  study_system_id: z.preprocess(toStringOrNull, z.string()),
  study_id: z.preprocess(toStringOrNull, z.string()),
  system_library_id: z.string().nullable().catch(null),
  system_name: z.preprocess(toStringOrNull, z.string()).catch(''),
  vendor_name: z.string().nullable().catch(null),
  system_type: z.preprocess(toStringOrNull, z.string()),
  system_category: z.string().nullable().catch(null),
  launch_url: z.string().nullable().catch(null),
  support_email: z.string().nullable().catch(null),
  support_url: z.string().nullable().catch(null),
  training_url: z.string().nullable().catch(null),
  login_notes: z.string().nullable().catch(null),
  owner_role: z.string().nullable().catch(null),
  active: z.preprocess(toBoolean, z.boolean()),
  pinned: z.preprocess(toBoolean, z.boolean()),
  is_custom: z.preprocess(toBoolean, z.boolean()),
  created_by: z.string().nullable().catch(null),
  created_at: z.preprocess(toStringOrNull, z.string()),
  updated_at: z.preprocess(toStringOrNull, z.string()),
})

export function mapStudySystemRow(row: unknown): StudySystemEntry {
  return studySystemRowSchema.parse(row)
}
