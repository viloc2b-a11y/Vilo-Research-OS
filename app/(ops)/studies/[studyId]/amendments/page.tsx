import { notFound } from 'next/navigation'
import Link from 'next/link'
import { ChevronLeft, AlertTriangle, CheckCircle, BookOpen, Plus, Minus, RefreshCw } from 'lucide-react'
import { createServerClient } from '@/lib/supabase/server'
import { hasActiveOrganizationMembership } from '@/lib/auth/membership-access'
import { getOrganizationMemberships, getSessionUser } from '@/lib/auth/session'
import { computeAmendmentDiff } from '@/lib/financial-runtime/compute/amendment-diff'
import type { AmendmentDiff } from '@/lib/financial-runtime/types'
import { AmendmentActionPanel } from '@/components/amendments/amendment-action-panel'

type SubjectImpact = {
  id: string
  protocol_version_id: string
  subject_id: string
  requires_reconsent: boolean
  reconsent_completed_at: string | null
  requires_training_review: boolean
  training_review_completed_at: string | null
  impact_reason: string | null
}

type AmendmentsPageProps = {
  params: Promise<{ studyId: string }>
}

function impactScoreBadge(score: number): { label: string; classes: string } {
  if (score <= 30) return { label: `Score ${score}`, classes: 'bg-green-50 text-green-800 border-green-200' }
  if (score <= 60) return { label: `Score ${score}`, classes: 'bg-yellow-50 text-yellow-800 border-yellow-200' }
  return { label: `Score ${score}`, classes: 'bg-red-50 text-red-800 border-red-200' }
}

function AmendmentCard({ diff, studyId, impacts }: { diff: AmendmentDiff; studyId: string; impacts: SubjectImpact[] }) {
  const badge = impactScoreBadge(diff.operationalImpactScore)
  const totalChanges =
    diff.addedVisits.length +
    diff.removedVisits.length +
    diff.modifiedVisits.length +
    diff.addedProcedures.length +
    diff.removedProcedures.length

  const hasDetail = totalChanges > 0

  const revisionLabel = diff.graphRevision
    ? `Rev ${diff.graphRevision}`
    : diff.versionId.slice(0, 8)
  const prevRevLabel = diff.previousGraphRevision
    ? `Rev ${diff.previousGraphRevision}`
    : diff.previousVersionId.slice(0, 8)

  return (
    <div className="rounded-lg border border-slate-200 bg-white overflow-hidden">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-3 px-5 py-4 bg-slate-50 border-b border-slate-200">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-sm font-semibold text-slate-900">
              {revisionLabel}
            </span>
            <span className="text-xs text-slate-400">←</span>
            <span className="text-xs text-slate-500">{prevRevLabel}</span>
            {diff.amendmentType && (
              <span className="rounded-full border border-slate-200 bg-white px-2 py-0.5 text-xs text-slate-600">
                {diff.amendmentType.replace(/_/g, ' ')}
              </span>
            )}
          </div>
          {diff.publishedAt && (
            <p className="text-xs text-slate-400">
              Published {new Date(diff.publishedAt).toLocaleDateString(undefined, { dateStyle: 'medium' })}
            </p>
          )}
        </div>
        <div className="flex items-center gap-2">
          <span className={`rounded-full border px-2.5 py-0.5 text-xs font-semibold ${badge.classes}`}>
            {badge.label}
          </span>
          {diff.requiresTrainingReview && (
            <span className="flex items-center gap-1 rounded-full border border-amber-200 bg-amber-50 px-2.5 py-0.5 text-xs font-semibold text-amber-800">
              <AlertTriangle className="h-3 w-3" />
              Training Review Required
            </span>
          )}
        </div>
      </div>

      {/* Summary counts */}
      <div className="flex flex-wrap gap-4 px-5 py-3 border-b border-slate-100 text-xs text-slate-500">
        {diff.addedVisits.length > 0 && (
          <span className="flex items-center gap-1 text-green-700">
            <Plus className="h-3 w-3" />
            {diff.addedVisits.length} visit{diff.addedVisits.length > 1 ? 's' : ''} added
          </span>
        )}
        {diff.removedVisits.length > 0 && (
          <span className="flex items-center gap-1 text-red-700">
            <Minus className="h-3 w-3" />
            {diff.removedVisits.length} visit{diff.removedVisits.length > 1 ? 's' : ''} removed
          </span>
        )}
        {diff.modifiedVisits.length > 0 && (
          <span className="flex items-center gap-1 text-blue-700">
            <RefreshCw className="h-3 w-3" />
            {diff.modifiedVisits.length} visit{diff.modifiedVisits.length > 1 ? 's' : ''} modified
          </span>
        )}
        {diff.addedProcedures.length > 0 && (
          <span className="flex items-center gap-1 text-green-700">
            <Plus className="h-3 w-3" />
            {diff.addedProcedures.length} procedure{diff.addedProcedures.length > 1 ? 's' : ''} added
          </span>
        )}
        {diff.removedProcedures.length > 0 && (
          <span className="flex items-center gap-1 text-red-700">
            <Minus className="h-3 w-3" />
            {diff.removedProcedures.length} procedure{diff.removedProcedures.length > 1 ? 's' : ''} removed
          </span>
        )}
        {!hasDetail && (
          <span className="text-slate-400 italic">No visit or procedure changes detected in graph document.</span>
        )}
      </div>

      {/* Detail */}
      {hasDetail && (
        <div className="grid gap-4 px-5 py-4 sm:grid-cols-2">
          {/* Added visits */}
          {diff.addedVisits.length > 0 && (
            <section>
              <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-green-700">
                Added Visits
              </h3>
              <ul className="space-y-1">
                {diff.addedVisits.map((v) => (
                  <li key={v.visitCode} className="flex items-center gap-2 text-xs text-slate-700">
                    <Plus className="h-3 w-3 shrink-0 text-green-500" />
                    <span className="font-medium">{v.visitCode}</span>
                    {v.visitName !== v.visitCode && (
                      <span className="text-slate-400">{v.visitName}</span>
                    )}
                  </li>
                ))}
              </ul>
            </section>
          )}

          {/* Removed visits */}
          {diff.removedVisits.length > 0 && (
            <section>
              <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-red-700">
                Removed Visits
              </h3>
              <ul className="space-y-1">
                {diff.removedVisits.map((v) => (
                  <li key={v.visitCode} className="flex items-center gap-2 text-xs text-slate-700">
                    <Minus className="h-3 w-3 shrink-0 text-red-500" />
                    <span className="font-medium">{v.visitCode}</span>
                    {v.visitName !== v.visitCode && (
                      <span className="text-slate-400">{v.visitName}</span>
                    )}
                  </li>
                ))}
              </ul>
            </section>
          )}

          {/* Modified visits */}
          {diff.modifiedVisits.length > 0 && (
            <section className="sm:col-span-2">
              <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-blue-700">
                Modified Visits
              </h3>
              <ul className="space-y-1.5">
                {diff.modifiedVisits.map((v) => (
                  <li key={v.visitCode} className="text-xs text-slate-700">
                    <span className="font-medium">{v.visitCode}</span>
                    <span className="ml-2 text-slate-400">{v.changes.join(', ')}</span>
                  </li>
                ))}
              </ul>
            </section>
          )}

          {/* Added procedures */}
          {diff.addedProcedures.length > 0 && (
            <section>
              <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-green-700">
                Added Procedures
              </h3>
              <ul className="space-y-1">
                {diff.addedProcedures.map((p) => (
                  <li key={`${p.visitCode}:${p.procedureCode}`} className="flex items-start gap-2 text-xs text-slate-700">
                    <Plus className="mt-0.5 h-3 w-3 shrink-0 text-green-500" />
                    <span>
                      <span className="font-medium">{p.procedureCode}</span>
                      {p.procedureName !== p.procedureCode && (
                        <span className="ml-1 text-slate-400">{p.procedureName}</span>
                      )}
                      <span className="ml-1 text-slate-400">@ {p.visitCode}</span>
                    </span>
                  </li>
                ))}
              </ul>
            </section>
          )}

          {/* Removed procedures */}
          {diff.removedProcedures.length > 0 && (
            <section>
              <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-red-700">
                Removed Procedures
              </h3>
              <ul className="space-y-1">
                {diff.removedProcedures.map((p) => (
                  <li key={`${p.visitCode}:${p.procedureCode}`} className="flex items-start gap-2 text-xs text-slate-700">
                    <Minus className="mt-0.5 h-3 w-3 shrink-0 text-red-500" />
                    <span>
                      <span className="font-medium">{p.procedureCode}</span>
                      {p.procedureName !== p.procedureCode && (
                        <span className="ml-1 text-slate-400">{p.procedureName}</span>
                      )}
                      <span className="ml-1 text-slate-400">@ {p.visitCode}</span>
                    </span>
                  </li>
                ))}
              </ul>
            </section>
          )}
        </div>
      )}

      {/* Subject Impact Panel */}
      {impacts.length > 0 && (() => {
        const count = impacts.length
        const pendingReconsent = impacts.filter(
          (i) => i.requires_reconsent && !i.reconsent_completed_at
        ).length
        return (
          <div className="border-t border-slate-100 px-5 py-4">
            <h3 className="mb-3 text-xs font-semibold uppercase tracking-wide text-slate-600">
              Subject Impact ({count} subject{count > 1 ? 's' : ''})
            </h3>
            <div className="space-y-2">
              {impacts.map((impact) => (
                <div key={impact.id} className="flex items-start justify-between gap-3 text-xs">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-slate-500">{impact.subject_id.slice(0, 8)}…</span>
                    {impact.impact_reason && (
                      <span className="text-slate-400">{impact.impact_reason}</span>
                    )}
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    {impact.requires_reconsent && (
                      <span className={`rounded-full border px-2 py-0.5 text-xs font-medium ${
                        impact.reconsent_completed_at
                          ? 'bg-green-50 border-green-200 text-green-700'
                          : 'bg-red-50 border-red-200 text-red-700'
                      }`}>
                        {impact.reconsent_completed_at ? 'Reconsented' : 'Reconsent Required'}
                      </span>
                    )}
                    {impact.requires_training_review && (
                      <span className={`rounded-full border px-2 py-0.5 text-xs font-medium ${
                        impact.training_review_completed_at
                          ? 'bg-green-50 border-green-200 text-green-700'
                          : 'bg-amber-50 border-amber-200 text-amber-700'
                      }`}>
                        {impact.training_review_completed_at ? 'Training Done' : 'Training Required'}
                      </span>
                    )}
                    {!impact.requires_reconsent && !impact.requires_training_review && (
                      <span className="text-slate-400">No action required</span>
                    )}
                  </div>
                </div>
              ))}
            </div>
            {pendingReconsent > 0 && (
              <p className="mt-3 text-xs text-red-600 font-medium">
                {pendingReconsent} subject{pendingReconsent > 1 ? 's' : ''} still need reconsent
              </p>
            )}
          </div>
        )
      })()}
    </div>
  )
}

export default async function AmendmentsPage({ params }: AmendmentsPageProps) {
  const { studyId } = await params

  const supabase = await createServerClient()

  const { data: study } = await supabase
    .from('studies')
    .select('id, name, organization_id')
    .eq('id', studyId)
    .maybeSingle()

  if (!study) notFound()

  const user = await getSessionUser()
  if (!user) notFound()

  const organizationId = String(study.organization_id)
  const memberships = await getOrganizationMemberships(user.id)
  if (!hasActiveOrganizationMembership(memberships, organizationId)) notFound()

  const amendments = await computeAmendmentDiff({ supabase, studyId })

  const { data: subjectImpacts } = await supabase
    .from('amendment_subject_impacts')
    .select('id, protocol_version_id, subject_id, requires_reconsent, reconsent_completed_at, requires_training_review, training_review_completed_at, impact_reason')
    .eq('study_id', studyId)
    .order('created_at', { ascending: true })

  const { count: subjectCount } = await supabase
    .from('study_subjects')
    .select('id', { count: 'exact', head: true })
    .eq('study_id', studyId)
    .neq('status', 'withdrawn')

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Page header */}
      <header className="border-b border-slate-200 bg-white px-6 py-4">
        <div className="flex items-center gap-3">
          <Link
            href={`/studies/${studyId}/workspace`}
            className="flex items-center gap-1.5 text-xs font-medium text-slate-500 hover:text-slate-700 transition-colors"
          >
            <ChevronLeft className="h-3.5 w-3.5" />
            Workspace
          </Link>
          <span className="text-slate-300">/</span>
          <div className="flex items-center gap-2">
            <BookOpen className="h-4 w-4 text-slate-400" />
            <h1 className="text-sm font-semibold text-slate-900">Protocol Amendments</h1>
          </div>
          <span className="rounded-full border border-slate-200 bg-slate-100 px-2 py-0.5 text-xs text-slate-500">
            {study.name as string}
          </span>
        </div>
      </header>

      {/* Content */}
      <main className="mx-auto max-w-4xl px-6 py-8 space-y-5">
        {amendments.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-slate-200 bg-white py-16 text-center">
            <CheckCircle className="h-8 w-8 text-slate-300 mb-3" />
            <p className="text-sm font-medium text-slate-600">No amendments on record for this study.</p>
            <p className="mt-1 text-xs text-slate-400">
              Amendment diffs appear here when protocol graph publications supersede a prior revision.
            </p>
          </div>
        ) : (
          <>
            <div className="flex items-center justify-between">
              <p className="text-xs text-slate-500">
                {amendments.length} amendment{amendments.length > 1 ? 's' : ''} detected from protocol graph publications
              </p>
            </div>
            {amendments.map((diff) => (
              <div key={diff.versionId} className="space-y-3">
                <AmendmentCard
                  diff={diff}
                  studyId={studyId}
                  impacts={subjectImpacts?.filter((i) => i.protocol_version_id === diff.versionId) ?? []}
                />
                <AmendmentActionPanel
                  studyId={studyId}
                  protocolVersionId={diff.versionId}
                  organizationId={organizationId}
                  subjectCount={subjectCount ?? 0}
                  diff={{
                    requiresReconsent: diff.operationalImpactScore > 50,
                    requiresTrainingReview: diff.requiresTrainingReview,
                    operationalImpactScore: diff.operationalImpactScore,
                  }}
                />
              </div>
            ))}
          </>
        )}
      </main>
    </div>
  )
}
