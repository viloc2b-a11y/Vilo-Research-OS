import { notFound } from 'next/navigation'
import Link from 'next/link'
import { ChevronLeft, FileCheck, CheckCircle, AlertTriangle } from 'lucide-react'
import { createServerClient } from '@/lib/supabase/server'
import { getOrganizationMemberships, getSessionUser } from '@/lib/auth/session'
import { hasActiveOrganizationMembership } from '@/lib/auth/membership-access'
import { loadConsentDocumentVersions } from '@/lib/consent-runtime/load-consent-document-versions'
import type { ConsentDocumentVersionRow } from '@/lib/consent-runtime/consent-types'

type ConsentPageProps = {
  params: Promise<{ studyId: string }>
}

const STATUS_BADGE: Record<string, { label: string; classes: string }> = {
  active: { label: 'Active', classes: 'bg-green-50 text-green-800 border-green-200' },
  draft: { label: 'Draft', classes: 'bg-slate-100 text-slate-600 border-slate-200' },
  irb_approved: { label: 'IRB Approved', classes: 'bg-blue-50 text-blue-800 border-blue-200' },
  superseded: { label: 'Superseded', classes: 'bg-slate-50 text-slate-400 border-slate-200' },
  review_needed: { label: 'Review Needed', classes: 'bg-yellow-50 text-yellow-800 border-yellow-200' },
  retired: { label: 'Retired', classes: 'bg-slate-50 text-slate-400 border-slate-200' },
}

function StatusBadge({ status }: { status: ConsentDocumentVersionRow['status'] }) {
  const cfg = STATUS_BADGE[status] ?? { label: status, classes: 'bg-slate-100 text-slate-600 border-slate-200' }
  return (
    <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-semibold ${cfg.classes}`}>
      {cfg.label}
    </span>
  )
}

function formatDate(date: string | null): string {
  if (!date) return '—'
  return new Date(date).toLocaleDateString(undefined, { dateStyle: 'medium' })
}

function formatConsentType(t: string): string {
  return t.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())
}

export default async function ConsentManagementPage({ params }: ConsentPageProps) {
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

  const versions = await loadConsentDocumentVersions({ supabase, organizationId, studyId })

  const activeVersion = versions.find((v) => v.status === 'active')
  const reconsentRequired = versions.some((v) => v.status === 'active' && v.reconsentRequired)

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
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
            <FileCheck className="h-4 w-4 text-slate-400" />
            <h1 className="text-sm font-semibold text-slate-900">Consent Management</h1>
          </div>
          <span className="rounded-full border border-slate-200 bg-slate-100 px-2 py-0.5 text-xs text-slate-500">
            {study.name as string}
          </span>
        </div>
      </header>

      {/* Content */}
      <main className="mx-auto max-w-4xl px-6 py-8 space-y-6">
        {/* Summary */}
        <div className="grid gap-4 sm:grid-cols-3">
          <div className="rounded-lg border border-slate-200 bg-white px-5 py-4">
            <p className="text-xs text-slate-500">Total ICF Versions</p>
            <p className="mt-1 text-2xl font-semibold text-slate-900">{versions.length}</p>
          </div>
          <div className="rounded-lg border border-slate-200 bg-white px-5 py-4">
            <p className="text-xs text-slate-500">Active Version</p>
            <p className="mt-1 text-base font-semibold text-slate-900">
              {activeVersion?.versionLabel ?? activeVersion ? `v${activeVersion.versionNumber}` : '—'}
            </p>
          </div>
          <div className="rounded-lg border border-slate-200 bg-white px-5 py-4">
            <p className="text-xs text-slate-500">Reconsent Required</p>
            <div className="mt-1 flex items-center gap-1.5">
              {reconsentRequired ? (
                <>
                  <AlertTriangle className="h-4 w-4 text-orange-500" />
                  <span className="text-sm font-semibold text-orange-700">Yes</span>
                </>
              ) : (
                <>
                  <CheckCircle className="h-4 w-4 text-green-500" />
                  <span className="text-sm font-semibold text-green-700">No</span>
                </>
              )}
            </div>
          </div>
        </div>

        {/* ICF Versions table */}
        <section>
          <h2 className="mb-3 text-sm font-semibold text-slate-700">ICF Versions</h2>
          {versions.length === 0 ? (
            <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-slate-200 bg-white py-16 text-center">
              <FileCheck className="h-8 w-8 text-slate-300 mb-3" />
              <p className="text-sm font-medium text-slate-600">No ICF versions on record for this study.</p>
            </div>
          ) : (
            <div className="overflow-hidden rounded-lg border border-slate-200 bg-white">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-100 bg-slate-50 text-left">
                    <th className="px-4 py-3 text-xs font-semibold text-slate-600">Version</th>
                    <th className="px-4 py-3 text-xs font-semibold text-slate-600">Consent Type</th>
                    <th className="px-4 py-3 text-xs font-semibold text-slate-600">IRB Approved</th>
                    <th className="px-4 py-3 text-xs font-semibold text-slate-600">Effective</th>
                    <th className="px-4 py-3 text-xs font-semibold text-slate-600">Expires</th>
                    <th className="px-4 py-3 text-xs font-semibold text-slate-600">Status</th>
                    <th className="px-4 py-3 text-xs font-semibold text-slate-600">Reconsent</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {versions.map((v) => (
                    <tr key={v.id} className="hover:bg-slate-50 transition-colors">
                      <td className="px-4 py-3 font-medium text-slate-900">
                        {v.versionLabel ?? `v${v.versionNumber}`}
                      </td>
                      <td className="px-4 py-3 text-slate-600">{formatConsentType(v.consentType)}</td>
                      <td className="px-4 py-3 text-slate-500">{formatDate(v.irbApprovalDate)}</td>
                      <td className="px-4 py-3 text-slate-500">{formatDate(v.effectiveDate)}</td>
                      <td className="px-4 py-3 text-slate-500">{formatDate(v.expirationDate)}</td>
                      <td className="px-4 py-3"><StatusBadge status={v.status} /></td>
                      <td className="px-4 py-3">
                        {v.reconsentRequired ? (
                          <span className="inline-flex items-center gap-1 text-xs font-medium text-orange-700">
                            <AlertTriangle className="h-3 w-3" />
                            Required
                          </span>
                        ) : (
                          <span className="text-xs text-slate-400">—</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </main>
    </div>
  )
}
