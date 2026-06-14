import { Suspense } from 'react'
import { redirect, notFound } from 'next/navigation'
import Link from 'next/link'
import { getSessionUser, getPrimaryOrganizationId } from '@/lib/auth/session'
import { createServerClient } from '@/lib/supabase/server'
import { loadCapaAction } from '@/lib/capa-runtime/load-capa-actions'
import { mapCapaAuditEventRow } from '@/lib/capa-runtime/capa-audit-types'
import { CoordinatorPageScroll } from '@/components/runtime-ui/CoordinatorPageScroll'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { CapaTransitionPanel } from './_components/CapaTransitionPanel'

type Props = { params: Promise<{ capaId: string }> }

export default async function CapaDetailPage({ params }: Props) {
  const { capaId } = await params
  const user = await getSessionUser()
  if (!user) redirect('/login')

  const organizationId = await getPrimaryOrganizationId(user.id)
  if (!organizationId) redirect('/login')

  const supabase = await createServerClient()

  const action = await loadCapaAction(supabase, capaId, organizationId)
  if (!action) notFound()

  const [deviationResult, studyResult, auditResult] = await Promise.all([
    supabase
      .from('protocol_deviations')
      .select('id, deviation_type, description, study_id')
      .eq('id', action.deviationId)
      .maybeSingle(),
    supabase
      .from('studies')
      .select('id, name')
      .eq('id', action.studyId)
      .maybeSingle(),
    (async () => {
      try {
        return await supabase
          .from('capa_audit_events')
          .select('*')
          .eq('capa_id', capaId)
          .order('changed_at', { ascending: false })
      } catch {
        return { data: null as Record<string, unknown>[] | null, error: null }
      }
    })(),
  ])

  const deviation = deviationResult.data
  const study = studyResult.data
  const auditHistory = ((auditResult as { data: Record<string, unknown>[] | null }).data ?? []).map(mapCapaAuditEventRow)

  return (
    <CoordinatorPageScroll contentClassName="p-6">
      <div className="max-w-4xl space-y-6">
        <div>
          <Link href="/capa" className="text-sm text-muted-foreground hover:text-foreground">
            ← All CAPAs
          </Link>
          <h1 className="text-2xl font-semibold mt-1">CAPA Action</h1>
          <p className="text-sm text-muted-foreground">
            {study?.name ?? '—'} · {deviation?.deviation_type?.replace(/_/g, ' ') ?? '—'}
          </p>
        </div>

        <CapaTransitionPanel action={action} organizationId={organizationId} />

        <Card>
          <CardHeader>
            <CardTitle>Action Details</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 text-sm">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-muted-foreground font-medium">Root Cause Analysis</p>
                <p className="mt-1">{action.rootCauseAnalysis ?? '—'}</p>
              </div>
              <div>
                <p className="text-muted-foreground font-medium">Owner</p>
                <p className="mt-1">{action.ownerId ?? '—'}</p>
              </div>
              <div>
                <p className="text-muted-foreground font-medium">Corrective Action</p>
                <p className="mt-1">{action.correctiveAction}</p>
              </div>
              <div>
                <p className="text-muted-foreground font-medium">Preventive Action</p>
                <p className="mt-1">{action.preventiveAction ?? '—'}</p>
              </div>
              {action.dueDate && (
                <div>
                  <p className="text-muted-foreground font-medium">Due Date</p>
                  <p className="mt-1">{new Date(action.dueDate).toLocaleDateString()}</p>
                </div>
              )}
              {action.effectivenessNotes && (
                <div>
                  <p className="text-muted-foreground font-medium">Effectiveness Notes</p>
                  <p className="mt-1">{action.effectivenessNotes}</p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Transition History</CardTitle>
          </CardHeader>
          <CardContent>
            {auditHistory.length === 0 ? (
              <p className="text-sm text-muted-foreground">No transitions recorded.</p>
            ) : (
              <ul className="space-y-3">
                {auditHistory.map((event) => (
                  <li key={event.id} className="text-sm border-l-2 border-border pl-3">
                    <span className="font-medium">{event.fromStatus}</span>
                    {' → '}
                    <span className="font-medium">{event.toStatus}</span>
                    <span className="text-muted-foreground ml-2">
                      {new Date(event.changedAt).toLocaleString()}
                    </span>
                    {event.note && (
                      <p className="text-muted-foreground mt-0.5">{event.note}</p>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>
    </CoordinatorPageScroll>
  )
}
