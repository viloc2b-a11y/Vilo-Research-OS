import type { SupabaseClient } from '@supabase/supabase-js'
import type { StudySystemEntry } from './study-systems'
import { loadStudySystems } from './load-study-systems'

// ── Types ────────────────────────────────────────────────────────────────────

export type UsageEventType = 'launch' | 'view'

export type UsageEventRow = {
  usage_event_id: string
  study_system_id: string
  study_id: string
  user_id: string | null
  event_type: UsageEventType
  created_at: string
}

export type SystemWithUsage = StudySystemEntry & {
  last_used: string | null
  usage_count: number
}

// ── Record usage events ──────────────────────────────────────────────────────

export async function recordSystemUsage(
  supabase: SupabaseClient,
  studySystemId: string,
  studyId: string,
  userId: string | null,
  eventType: UsageEventType,
): Promise<void> {
  try {
    await supabase.from('study_system_usage_events').insert({
      study_system_id: studySystemId,
      study_id: studyId,
      user_id: userId,
      event_type: eventType,
    })
  } catch {
    // Usage events are best-effort; failure never blocks the user
  }
}

// ── Load recently used systems ────────────────────────────────────────────────

/**
 * Load recently used systems for a user in a study.
 * Returns systems ordered by most recent usage, limited to `maxCount`.
 */
export async function loadRecentlyUsedSystems(
  supabase: SupabaseClient,
  studyId: string,
  userId: string,
  maxCount = 5,
): Promise<SystemWithUsage[]> {
  try {
    // Get the most recent usage events for this user + study, one per system
    const { data: events, error } = await supabase
      .from('study_system_usage_events')
      .select('study_system_id, created_at')
      .eq('study_id', studyId)
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(100) // fetch enough to deduplicate

    if (error || !events) return []

    // Deduplicate: keep only the most recent event per system
    const seen = new Set<string>()
    const recentSystemIds: string[] = []
    for (const e of events) {
      if (!seen.has(e.study_system_id)) {
        seen.add(e.study_system_id)
        recentSystemIds.push(e.study_system_id)
        if (recentSystemIds.length >= maxCount) break
      }
    }

    if (recentSystemIds.length === 0) return []

    // Build a map of system_id → last_used timestamp
    const lastUsedMap = new Map<string, string>()
    for (const e of events) {
      if (!lastUsedMap.has(e.study_system_id)) {
        lastUsedMap.set(e.study_system_id, e.created_at)
      }
    }

    // Fetch the system records
    const allSystems = await loadStudySystems(supabase, studyId)
    const systemMap = new Map(allSystems.map((s) => [s.study_system_id, s]))

    return recentSystemIds
      .map((id) => {
        const system = systemMap.get(id)
        if (!system) return null
        return {
          ...system,
          last_used: lastUsedMap.get(id) ?? null,
          usage_count: 0,
        }
      })
      .filter((s): s is SystemWithUsage => s !== null)
  } catch {
    return []
  }
}

// ── Load most used systems ────────────────────────────────────────────────────

/**
 * Load the most frequently used systems for a study.
 * Returns systems ordered by usage count descending.
 */
export async function loadMostUsedSystems(
  supabase: SupabaseClient,
  studyId: string,
  maxCount = 5,
): Promise<SystemWithUsage[]> {
  try {
    // Count usage events per system
    const { data: counts, error } = await supabase
      .from('study_system_usage_events')
      .select('study_system_id')
      .eq('study_id', studyId)

    if (error || !counts) return []

    const countMap = new Map<string, number>()
    for (const e of counts) {
      countMap.set(e.study_system_id, (countMap.get(e.study_system_id) ?? 0) + 1)
    }

    if (countMap.size === 0) return []

    // Sort by count descending
    const sortedIds = [...countMap.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, maxCount)
      .map(([id]) => id)

    // Fetch the latest usage timestamp per system
    const latestUsageMap = new Map<string, string>()
    const { data: latestEvents } = await supabase
      .from('study_system_usage_events')
      .select('study_system_id, created_at')
      .eq('study_id', studyId)
      .in('study_system_id', sortedIds)
      .order('created_at', { ascending: false })

    if (latestEvents) {
      for (const e of latestEvents) {
        if (!latestUsageMap.has(e.study_system_id)) {
          latestUsageMap.set(e.study_system_id, e.created_at)
        }
      }
    }

    // Fetch system records
    const allSystems = await loadStudySystems(supabase, studyId)
    const systemMap = new Map(allSystems.map((s) => [s.study_system_id, s]))

    return sortedIds
      .map((id) => {
        const system = systemMap.get(id)
        if (!system) return null
        return {
          ...system,
          last_used: latestUsageMap.get(id) ?? null,
          usage_count: countMap.get(id) ?? 0,
        }
      })
      .filter((s): s is SystemWithUsage => s !== null)
  } catch {
    return []
  }
}

// ── Load pinned systems ───────────────────────────────────────────────────────

/**
 * Load pinned systems for a study. These are always shown first.
 */
export async function loadPinnedSystems(
  supabase: SupabaseClient,
  studyId: string,
  userId: string,
): Promise<SystemWithUsage[]> {
  try {
    const allSystems = await loadStudySystems(supabase, studyId)

    // Check if user has recent usage for any pinned system
    const pinnedIds = allSystems.filter((s) => s.pinned).map((s) => s.study_system_id)

    if (pinnedIds.length === 0) return []

    // Get latest usage timestamps for pinned systems
    const latestUsageMap = new Map<string, string>()
    const { data: latestEvents } = await supabase
      .from('study_system_usage_events')
      .select('study_system_id, created_at')
      .eq('study_id', studyId)
      .eq('user_id', userId)
      .in('study_system_id', pinnedIds)
      .order('created_at', { ascending: false })

    if (latestEvents) {
      for (const e of latestEvents) {
        if (!latestUsageMap.has(e.study_system_id)) {
          latestUsageMap.set(e.study_system_id, e.created_at)
        }
      }
    }

    return allSystems
      .filter((s) => s.pinned && s.active)
      .map((s) => ({
        ...s,
        last_used: latestUsageMap.get(s.study_system_id) ?? null,
        usage_count: 0,
      }))
      .sort((a, b) => {
        // Maintain pinned ordering: if both have last_used, most recent first
        if (a.last_used && b.last_used) return b.last_used.localeCompare(a.last_used)
        if (a.last_used) return -1
        if (b.last_used) return 1
        return a.system_name.localeCompare(b.system_name)
      })
  } catch {
    return []
  }
}

// ── Enrich all systems with usage data ────────────────────────────────────────

/**
 * Enrich all study systems with their last_used and usage_count.
 */
export async function enrichSystemsWithUsage(
  supabase: SupabaseClient,
  studyId: string,
  userId: string | null,
  systems: StudySystemEntry[],
): Promise<SystemWithUsage[]> {
  if (systems.length === 0) return []

  const systemIds = systems.map((s) => s.study_system_id)

  // Get usage counts per system
  const countMap = new Map<string, number>()
  const { data: countEvents } = await supabase
    .from('study_system_usage_events')
    .select('study_system_id')
    .eq('study_id', studyId)

  if (countEvents) {
    for (const e of countEvents) {
      countMap.set(e.study_system_id, (countMap.get(e.study_system_id) ?? 0) + 1)
    }
  }

  // Get latest usage per system for this user
  const latestUsageMap = new Map<string, string>()
  if (userId) {
    const { data: latestEvents } = await supabase
      .from('study_system_usage_events')
      .select('study_system_id, created_at')
      .eq('study_id', studyId)
      .eq('user_id', userId)
      .in('study_system_id', systemIds)
      .order('created_at', { ascending: false })

    if (latestEvents) {
      for (const e of latestEvents) {
        if (!latestUsageMap.has(e.study_system_id)) {
          latestUsageMap.set(e.study_system_id, e.created_at)
        }
      }
    }
  }

  return systems.map((s) => ({
    ...s,
    last_used: latestUsageMap.get(s.study_system_id) ?? null,
    usage_count: countMap.get(s.study_system_id) ?? 0,
  }))
}
