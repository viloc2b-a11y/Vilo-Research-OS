import Link from 'next/link'
import { redirect } from 'next/navigation'
import { ShieldCheck, ShieldAlert, ShieldX } from 'lucide-react'
import { getSessionUser, getOrganizationMemberships } from '@/lib/auth/session'
import { activeMemberships } from '@/lib/auth/membership-access'
import { organizationIdsFromMemberships } from '@/lib/rbac/org-scope'
import { createServerClient } from '@/lib/supabase/server'
import { computeRegulatorySnapshot } from '@/lib/regulatory-intelligence/compute-regulatory-snapshot'
import type { RegulatoryRisk, StudyRegulatorySnapshot } from '@/lib/regulatory-intelligence/regulatory-types'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type StudyWithSnapshot = {
  id: string
  name: string
  snapshot: StudyRegulatorySnapshot | null
  error: string | null
}

// ---------------------------------------------------------------------------
// Risk helpers
// ---------------------------------------------------------------------------

const RISK_CONFIG: Record<RegulatoryRisk, { badge: string; icon: React.ElementType; label: string }> = {
  ok:       { badge: 'bg-green-50 text-green-700 border-green-200',   icon: ShieldCheck, label: 'OK' },
  warning:  { badge: 'bg-yellow-50 text-yellow-700 border-yellow-200', icon: ShieldAlert, label: 'Warning' },
  critical: { badge: 'bg-red-50 text-red-700 border-red-200',          icon: ShieldX,     label: 'Critical' },
}

function RiskBadge({ risk }: { risk: RegulatoryRisk }) {
  const { badge, icon: Icon, label } = RISK_CONFIG[risk]
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs font-semibold ${badge}`}
    >
      <Icon className="w-3 h-3" />
      {label}
    </span>
  )
}

// ---------------------------------------------------------------------------
// Portfolio table
// ---------------------------------------------------------------------------

function PortfolioTable({ rows }: { rows: StudyWithSnapshot[] }) {
  if (rows.length === 0) {
    return (
      <div className="rounded-xl border border-border bg-card px-4 py-8 text-center">
        <p className="text-sm text-muted-foreground">No active studies found for this organization.</p>
      </div>
    )
  }

  return (
    <div className="overflow-x-auto rounded-xl border border-border">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-border bg-muted/40">
            <th className="px-4 py-2.5 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Study
            </th>
            <th className="px-4 py-2.5 text-center text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              IRB Status
            </th>
            <th className="px-4 py-2.5 text-center text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Staff Credentials
            </th>
            <th className="px-4 py-2.5 text-center text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Subject Consent
            </th>
            <th className="px-4 py-2.5 text-center text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Overall Risk
            </th>
            <th className="px-4 py-2.5 text-right text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Active IRBs
            </th>
            <th className="px-4 py-2.5 text-right text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Expiring Creds
            </th>
            <th className="px-4 py-2.5 text-right text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Needs Re-consent
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {rows.map(({ id, name, snapshot, error }) => {
            if (error || !snapshot) {
              return (
                <tr key={id} className="bg-card">
                  <td className="px-4 py-2.5 font-medium text-foreground">{name}</td>
                  <td colSpan={7} className="px-4 py-2.5 text-xs text-red-600">
                    {error ?? 'Failed to load snapshot'}
                  </td>
                </tr>
              )
            }

            return (
              <tr key={id} className="bg-card hover:bg-muted/30 transition-colors">
                <td className="px-4 py-2.5 font-medium text-foreground">{name}</td>
                <td className="px-4 py-2.5 text-center">
                  <RiskBadge risk={snapshot.irbStatus} />
                </td>
                <td className="px-4 py-2.5 text-center">
                  <RiskBadge risk={snapshot.staffCredentialRisk} />
                </td>
                <td className="px-4 py-2.5 text-center">
                  <RiskBadge risk={snapshot.subjectConsentRisk} />
                </td>
                <td className="px-4 py-2.5 text-center">
                  <RiskBadge risk={snapshot.overallRisk} />
                </td>
                <td className="px-4 py-2.5 text-right tabular-nums text-foreground">
                  {snapshot.activeIRBApprovals.length}
                </td>
                <td className={`px-4 py-2.5 text-right tabular-nums font-medium ${snapshot.expiringCredentials.length > 0 ? 'text-yellow-700' : 'text-muted-foreground'}`}>
                  {snapshot.expiringCredentials.length + snapshot.expiredCredentials.length}
                </td>
                <td className={`px-4 py-2.5 text-right tabular-nums font-medium ${snapshot.subjectsNeedingReconsent > 0 ? 'text-yellow-700' : 'text-muted-foreground'}`}>
                  {snapshot.subjectsNeedingReconsent}
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default async function RegulatoryIntelligencePage() {
  const user = await getSessionUser()
  if (!user) redirect('/login')

  const memberships = activeMemberships(await getOrganizationMemberships(user.id))
  if (memberships.length === 0) redirect('/login')

  const organizationIds = organizationIdsFromMemberships(memberships)
  const organizationId = organizationIds[0] ?? null

  if (!organizationId) {
    return (
      <div className="flex flex-col h-full bg-accent">
        <div className="px-6 py-5 bg-card border-b border-border">
          <h1 className="heading-serif text-xl text-foreground">Regulatory Intelligence</h1>
          <p className="text-sm text-muted-foreground">No organization access found.</p>
        </div>
      </div>
    )
  }

  const supabase = await createServerClient()

  const { data: studyRows } = await supabase
    .from('studies')
    .select('id, name')
    .eq('organization_id', organizationId)
    .neq('status', 'archived')
    .order('name', { ascending: true })

  const studies = (studyRows ?? []).map((s) => ({
    id: s.id as string,
    name: s.name as string,
  }))

  const rows: StudyWithSnapshot[] = await Promise.all(
    studies.map(async ({ id, name }) => {
      try {
        const snapshot = await computeRegulatorySnapshot({
          supabase,
          organizationId,
          studyId: id,
        })
        return { id, name, snapshot, error: null }
      } catch (err) {
        return {
          id,
          name,
          snapshot: null,
          error: err instanceof Error ? err.message : 'Unknown error',
        }
      }
    }),
  )

  const criticalCount = rows.filter((r) => r.snapshot?.overallRisk === 'critical').length
  const warningCount = rows.filter((r) => r.snapshot?.overallRisk === 'warning').length

  return (
    <div className="flex flex-col h-full bg-accent">
      {/* Header */}
      <div className="px-6 py-5 bg-card border-b border-border">
        <h1 className="heading-serif text-xl text-foreground flex items-center gap-2">
          <ShieldCheck className="w-5 h-5 text-blue-500" />
          Regulatory Intelligence
        </h1>
        <p className="text-sm text-muted-foreground">
          IRB approvals, investigator credentials, and subject consent risk.
        </p>
        <div className="flex gap-3 mt-2">
          <Link href="/regulatory-intelligence/irb" className="text-sm text-primary hover:underline font-medium">
            View IRB Details →
          </Link>
          <Link href="/regulatory-intelligence/credentials" className="text-sm text-primary hover:underline font-medium">
            View Credentials →
          </Link>
        </div>
      </div>

      <div className="vilo-ops-scroll min-h-0 flex-1 overflow-y-auto p-6 scrollbar-thin space-y-6">
        {/* Summary bar */}
        <div className="flex flex-wrap items-center gap-4 rounded-lg border border-border bg-card px-4 py-3">
          <span className="text-sm text-muted-foreground">
            <span className="font-semibold text-foreground">{studies.length}</span> active{' '}
            {studies.length === 1 ? 'study' : 'studies'}
          </span>
          {criticalCount > 0 && (
            <span className="inline-flex items-center gap-1.5 rounded-full border border-red-200 bg-red-50 px-3 py-1 text-xs font-semibold text-red-700">
              <ShieldX className="w-3 h-3" />
              {criticalCount} critical
            </span>
          )}
          {warningCount > 0 && (
            <span className="inline-flex items-center gap-1.5 rounded-full border border-yellow-200 bg-yellow-50 px-3 py-1 text-xs font-semibold text-yellow-700">
              <ShieldAlert className="w-3 h-3" />
              {warningCount} warning
            </span>
          )}
          {criticalCount === 0 && warningCount === 0 && studies.length > 0 && (
            <span className="inline-flex items-center gap-1.5 rounded-full border border-green-200 bg-green-50 px-3 py-1 text-xs font-semibold text-green-700">
              <ShieldCheck className="w-3 h-3" />
              All studies OK
            </span>
          )}
        </div>

        <PortfolioTable rows={rows} />
      </div>
    </div>
  )
}
