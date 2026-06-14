import { createServerClient } from '@/lib/supabase/server'
import { getOrganizationMemberships, getSessionUser } from '@/lib/auth/session'
import { activeMemberships } from '@/lib/auth/membership-access'
import { computeCoordinatorWorkload } from '@/lib/performance/portfolio/compute-coordinator-workload'
import type { CoordinatorWorkload } from '@/lib/performance/portfolio/compute-coordinator-workload'
import { CoordinatorWorkloadTable } from '@/app/(ops)/performance/coordinators/_components/CoordinatorWorkloadTable'

type CoordinatorWithProfile = CoordinatorWorkload & {
  displayName: string | null
  email: string | null
}

async function loadCoordinatorWorkloads(): Promise<{
  organizationId: string | null
  rows: CoordinatorWithProfile[]
  error: string | null
}> {
  const user = await getSessionUser()
  if (!user) return { organizationId: null, rows: [], error: 'Unauthorized' }

  const memberships = activeMemberships(await getOrganizationMemberships(user.id))
  if (memberships.length === 0) return { organizationId: null, rows: [], error: 'No active organization access.' }

  const organizationId = memberships[0].organization_id
  const supabase = await createServerClient()

  const { data: members, error: membersError } = await supabase
    .from('organization_members')
    .select('user_id, role, roles, status')
    .eq('organization_id', organizationId)

  if (membersError) {
    return { organizationId, rows: [], error: membersError.message }
  }

  const coordinatorUserIds = (members ?? [])
    .map((m: Record<string, unknown>) => m.user_id as string)
    .filter(Boolean)

  if (coordinatorUserIds.length === 0) {
    return { organizationId, rows: [], error: null }
  }

  const { data: profiles } = await supabase
    .from('profiles')
    .select('id, display_name')
    .in('id', coordinatorUserIds)

  const displayByUserId = new Map<string, string>()
  for (const p of profiles ?? []) {
    if (p.display_name) displayByUserId.set(p.id as string, p.display_name as string)
  }

  const workloads = await Promise.all(
    coordinatorUserIds.map((coordinatorId) =>
      computeCoordinatorWorkload({ supabase, organizationId, coordinatorId }),
    ),
  )

  const rows: CoordinatorWithProfile[] = workloads
    .map((w) => ({
      ...w,
      displayName: displayByUserId.get(w.coordinatorId) ?? null,
      email: null,
    }))
    .sort((a, b) => b.workloadScore - a.workloadScore)

  return { organizationId, rows, error: null }
}

export default async function CoordinatorsPage() {
  const { rows, error } = await loadCoordinatorWorkloads()

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold text-foreground">Coordinator Workload</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Workload score per coordinator based on open actions, active visits, findings, and queries.
          Sorted by score descending.
        </p>
      </div>

      {error ? (
        <p className="text-sm text-destructive">{error}</p>
      ) : (
        <CoordinatorWorkloadTable rows={rows} />
      )}
    </div>
  )
}
