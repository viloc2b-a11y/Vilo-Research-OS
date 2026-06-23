import type { SupabaseClient } from '@supabase/supabase-js'

// ── Types ────────────────────────────────────────────────────────────────────

export const ACCESS_STATUSES = [
  'Not Requested',
  'Requested',
  'Active',
  'Issue',
  'Not Needed',
] as const

export type AccessStatus = (typeof ACCESS_STATUSES)[number]

export const ACCESS_ROLES = [
  'PI',
  'Sub Investigator',
  'Coordinator',
  'Regulatory',
  'Pharmacy',
  'Finance',
  'Recruitment',
  'Other',
] as const

export type AccessRole = (typeof ACCESS_ROLES)[number]

export type StudySystemAccessEntry = {
  access_id: string
  study_system_id: string
  study_id: string
  user_id: string | null
  role: string
  access_status: string
  requested_at: string | null
  granted_at: string | null
  notes: string | null
  created_at: string
  updated_at: string
}

export type StudySystemAccessWithSystem = StudySystemAccessEntry & {
  system_name: string
  vendor_name: string | null
  system_type: string
}

export type AccessReadinessSummary = {
  totalRequired: number
  completed: number
  blocked: number
  pending: number
  notNeeded: number
  score: number // 0–100 percentage
  blockers: { systemName: string; role: string; status: string; notes: string | null }[]
}

// ── Server action input types ────────────────────────────────────────────────

export type CreateAccessRecordInput = {
  studySystemId: string
  studyId: string
  role: AccessRole
  accessStatus?: AccessStatus
  notes?: string | null
}

export type UpdateAccessRecordInput = {
  accessId: string
  accessStatus: AccessStatus
  requestedAt?: string | null
  grantedAt?: string | null
  notes?: string | null
}

export type AccessActionResult = {
  ok: boolean
  error?: string
  data?: StudySystemAccessEntry
}

// ── Zod schemas (future: add Zod for runtime validation) ──

// ── Constants ────────────────────────────────────────────────────────────────

const ACCESS_STATUS_COLORS: Record<string, string> = {
  'Not Requested': 'bg-slate-100 text-slate-600',
  Requested: 'bg-amber-100 text-amber-800',
  Active: 'bg-green-100 text-green-800',
  Issue: 'bg-red-100 text-red-800',
  'Not Needed': 'bg-blue-100 text-blue-700',
}

export function getAccessStatusColor(status: string): string {
  return ACCESS_STATUS_COLORS[status] ?? 'bg-slate-100 text-slate-600'
}

// ── Loaders ──────────────────────────────────────────────────────────────────

/**
 * Load all access records for a study's systems.
 */
export async function loadStudySystemAccess(
  supabase: SupabaseClient,
  studyId: string,
  unavailable?: string[],
): Promise<StudySystemAccessEntry[]> {
  try {
    const { data, error } = await supabase
      .from('study_system_access')
      .select('*')
      .eq('study_id', studyId)
      .order('created_at', { ascending: true })

    if (error) {
      unavailable?.push(`System access: ${error.message}`)
      return []
    }

    return (data ?? []) as StudySystemAccessEntry[]
  } catch (err) {
    unavailable?.push(
      `System access: ${err instanceof Error ? err.message : 'unavailable'}`,
    )
    return []
  }
}

/**
 * Load access records enriched with system name/vendor/type.
 */
export async function loadStudySystemAccessWithSystems(
  supabase: SupabaseClient,
  studyId: string,
  unavailable?: string[],
): Promise<StudySystemAccessWithSystem[]> {
  try {
    const { data, error } = await supabase
      .from('study_system_access')
      .select(`
        *,
        study_systems!inner(
          system_name,
          vendor_name,
          system_type
        )
      `)
      .eq('study_id', studyId)
      .order('created_at', { ascending: true })

    if (error) {
      unavailable?.push(`System access: ${error.message}`)
      return []
    }

    return ((data ?? []) as unknown[]).map((row) => {
      const r = row as Record<string, unknown>
      const sys = r.study_systems as Record<string, unknown> || {}
      return {
        ...(r as unknown as StudySystemAccessEntry),
        system_name: String(sys.system_name ?? ''),
        vendor_name: sys.vendor_name != null ? String(sys.vendor_name) : null,
        system_type: String(sys.system_type ?? ''),
      }
      }) as StudySystemAccessWithSystem[]
  } catch (err) {
    unavailable?.push(
      `System access: ${err instanceof Error ? err.message : 'unavailable'}`,
    )
    return []
  }
}

/**
 * Calculate access readiness summary for a study.
 */
export async function calculateAccessReadiness(
  supabase: SupabaseClient,
  studyId: string,
): Promise<AccessReadinessSummary> {
  try {
    const records = await loadStudySystemAccess(supabase, studyId)

    const totalRequired = records.filter((r) => r.access_status !== 'Not Needed').length
    const completed = records.filter((r) => r.access_status === 'Active').length
    const blocked = records.filter((r) => r.access_status === 'Issue').length
    const pending = records.filter((r) => r.access_status === 'Requested' || r.access_status === 'Not Requested').length
    const notNeeded = records.filter((r) => r.access_status === 'Not Needed').length
    const score = totalRequired > 0 ? Math.round((completed / totalRequired) * 100) : 100

    // Get system names for blocker details
    const { data: accessWithSystems } = await supabase
      .from('study_system_access')
      .select(`
        access_status, notes, role,
        study_systems!inner(system_name)
      `)
      .eq('study_id', studyId)

    const blockers: { systemName: string; role: string; status: string; notes: string | null }[] = []
    if (accessWithSystems) {
      for (const row of accessWithSystems as Array<Record<string, unknown>>) {
        if (row.access_status === 'Issue') {
          const sys = row.study_systems as Record<string, unknown> || {}
          blockers.push({
            systemName: String(sys.system_name ?? 'Unknown'),
            role: String(row.role ?? ''),
            status: String(row.access_status ?? ''),
            notes: row.notes != null ? String(row.notes) : null,
          })
        }
      }
    }

    return { totalRequired, completed, blocked, pending, notNeeded, score, blockers }
  } catch {
    return { totalRequired: 0, completed: 0, blocked: 0, pending: 0, notNeeded: 0, score: 100, blockers: [] }
  }
}

/**
 * Check if a study has any access blockers that would prevent enrollment readiness.
 */
export async function hasStudyAccessBlockers(
  supabase: SupabaseClient,
  studyId: string,
): Promise<{ blocked: boolean; reasons: string[] }> {
  const summary = await calculateAccessReadiness(supabase, studyId)
  const reasons = summary.blockers.map(
    (b) => `${b.systemName} (${b.role}): ${b.notes ?? 'access issue'}`,
  )
  return { blocked: summary.blocked > 0, reasons }
}

/**
 * Activation gate: check if a study is ready for enrollment.
 * Returns false when required systems have unresolved access blockers.
 * Prevents marking a study as Ready For Enrollment with unresolved issues.
 */
export async function checkEnrollmentReadiness(
  supabase: SupabaseClient,
  studyId: string,
): Promise<{
  ready: boolean
  blockers: string[]
  accessSummary: AccessReadinessSummary
}> {
  const summary = await calculateAccessReadiness(supabase, studyId)

  const blockers: string[] = []

  // Any system with 'Issue' status blocks enrollment readiness
  for (const b of summary.blockers) {
    blockers.push(`${b.systemName} (${b.role}): ${b.notes ?? 'access issue'}`)
  }

  return {
    ready: blockers.length === 0,
    blockers,
    accessSummary: summary,
  }
}
