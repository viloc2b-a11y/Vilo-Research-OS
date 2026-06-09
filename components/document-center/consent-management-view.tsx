import type { ReactNode } from 'react'
import Link from 'next/link'
import type {
  ConsentManagementOverview,
  ConsentManagementEvidenceRow,
  ConsentManagementLibraryRow,
  ConsentManagementReconsentRow,
  ConsentManagementSessionRow,
  ConsentManagementSubjectRow,
} from '@/lib/document-center/load-consent-management'

type ConsentManagementViewProps = {
  overview: ConsentManagementOverview
  studyId: string
}

function formatDate(value: string | null | undefined): string {
  if (!value) return '—'
  const parsed = new Date(value)
  return Number.isNaN(parsed.getTime()) ? value : parsed.toLocaleDateString()
}

function formatDateTime(value: string | null | undefined): string {
  if (!value) return '—'
  const parsed = new Date(value)
  return Number.isNaN(parsed.getTime()) ? value : parsed.toLocaleString()
}

function Badge({ children, tone = 'slate' }: { children: string; tone?: 'slate' | 'emerald' | 'amber' | 'red' | 'blue' }) {
  const toneClass = {
    slate: 'bg-slate-100 text-slate-700',
    emerald: 'bg-emerald-100 text-emerald-800',
    amber: 'bg-amber-100 text-amber-800',
    red: 'bg-red-100 text-red-800',
    blue: 'bg-blue-100 text-blue-800',
  }[tone]

  return <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${toneClass}`}>{children}</span>
}

function StatusPill({ complete }: { complete: boolean }) {
  return complete ? <Badge tone="emerald">Complete</Badge> : <Badge tone="amber">Needs attention</Badge>
}

function SectionShell({
  title,
  description,
  children,
}: {
  title: string
  description: string
  children: ReactNode
}) {
  return (
    <section className="rounded-md border border-slate-200 bg-white p-5">
      <div className="mb-4">
        <h2 className="text-sm font-semibold text-slate-900">{title}</h2>
        <p className="mt-1 text-sm text-slate-600">{description}</p>
      </div>
      {children}
    </section>
  )
}

function ConsentLibraryTable({ rows }: { rows: ConsentManagementLibraryRow[] }) {
  if (rows.length === 0) {
    return <p className="text-sm text-slate-500">No consent templates have been created for this study yet.</p>
  }

  return (
    <div className="overflow-x-auto">
      <table className="min-w-full divide-y divide-slate-200 text-sm">
        <thead className="bg-slate-50">
          <tr className="text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
            <th className="px-3 py-2">Consent</th>
            <th className="px-3 py-2">Version</th>
            <th className="px-3 py-2">Language</th>
            <th className="px-3 py-2">Status</th>
            <th className="px-3 py-2">Effective</th>
            <th className="px-3 py-2">Expires</th>
            <th className="px-3 py-2">Rules</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {rows.map((row) => (
            <tr key={row.id}>
              <td className="px-3 py-3">
                <div className="font-medium text-slate-900">{row.consentType}</div>
                {row.versionLabel ? <div className="mt-0.5 text-xs text-slate-500">{row.versionLabel}</div> : null}
              </td>
              <td className="px-3 py-3 text-slate-700">v{row.versionNumber}</td>
              <td className="px-3 py-3 text-slate-700">{row.language}</td>
              <td className="px-3 py-3">
                <div className="flex flex-wrap gap-2">
                  <Badge tone={row.status === 'active' ? 'emerald' : row.status === 'approved' ? 'blue' : 'slate'}>{row.status}</Badge>
                  <Badge tone="slate">{row.reviewStatus}</Badge>
                  {row.reconsentRequired ? <Badge tone="amber">Reconsent</Badge> : null}
                </div>
              </td>
              <td className="px-3 py-3 text-slate-600">{formatDate(row.effectiveDate)}</td>
              <td className="px-3 py-3 text-slate-600">{formatDate(row.expirationDate)}</td>
              <td className="px-3 py-3 text-slate-600">
                <div className="space-y-1">
                  <div>{row.requiresPiReview ? 'PI review required' : 'PI review optional'}</div>
                  <div>
                    Allowed: {row.allowedSigningMethods.length ? row.allowedSigningMethods.join(', ') : 'not specified'}
                  </div>
                  <div>
                    Required signatures: {row.requiredSignatures.length ? row.requiredSignatures.join(', ') : 'default signatures'}
                  </div>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function SubjectConsentTable({
  rows,
  studyId,
}: {
  rows: ConsentManagementSubjectRow[]
  studyId: string
}) {
  if (rows.length === 0) {
    return <p className="text-sm text-slate-500">No subject consent records have been recorded yet.</p>
  }

  return (
    <div className="overflow-x-auto">
      <table className="min-w-full divide-y divide-slate-200 text-sm">
        <thead className="bg-slate-50">
          <tr className="text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
            <th className="px-3 py-2">Subject</th>
            <th className="px-3 py-2">Consent</th>
            <th className="px-3 py-2">Version / Method</th>
            <th className="px-3 py-2">Status</th>
            <th className="px-3 py-2">Signature check</th>
            <th className="px-3 py-2">Evidence</th>
            <th className="px-3 py-2">Next step</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {rows.map((row) => (
            <tr key={row.id}>
              <td className="px-3 py-3">
                <div className="font-medium text-slate-900">{row.subjectIdentifier}</div>
                <div className="mt-0.5 text-xs text-slate-500">{row.subjectId}</div>
              </td>
              <td className="px-3 py-3 text-slate-700">
                <div>{row.consentType}</div>
                <div className="mt-0.5 text-xs text-slate-500">Language: {row.consentLanguage}</div>
              </td>
              <td className="px-3 py-3 text-slate-700">
                <div>{row.consentVersionLabel}</div>
                <div className="mt-0.5 text-xs text-slate-500">{row.completionMethod ?? '—'}</div>
              </td>
              <td className="px-3 py-3">
                <div className="flex flex-wrap gap-2">
                  <StatusPill complete={row.validation.is_complete} />
                  <Badge tone="slate">{row.consentStatus}</Badge>
                  {row.reconsentStatus ? <Badge tone={row.reconsentStatus === 'overdue' ? 'red' : 'amber'}>{row.reconsentStatus}</Badge> : null}
                </div>
                <div className="mt-2 text-xs text-slate-500">
                  Consented: {formatDateTime(row.consentDateTime)}
                </div>
              </td>
              <td className="px-3 py-3 text-slate-600">
                <div>Coordinator: {row.coordinatorSignedAt ? 'Signed' : 'Missing'}</div>
                <div>PI/Sub-I: {row.piSignedAt ? 'Signed' : 'Optional / missing'}</div>
                <div>Witness/LAR: {row.witnessSignedAt || row.larSignedAt ? 'Present' : 'Not required / not present'}</div>
              </td>
              <td className="px-3 py-3 text-slate-600">
                <div>{row.evidenceCount} file(s)</div>
                <div className="mt-0.5 text-xs">{row.participantCopyProvided ? 'Copy documented' : 'Copy not documented'}</div>
              </td>
              <td className="px-3 py-3">
                <div className="space-y-2">
                  <div className="text-xs text-slate-600">{row.validation.recommended_action}</div>
                  <div className="flex flex-wrap gap-2">
                    <Link
                      href={`/studies/${encodeURIComponent(studyId)}/subjects/${encodeURIComponent(row.subjectId)}?tab=consent`}
                      className="inline-flex rounded-md bg-slate-900 px-3 py-1.5 text-xs font-medium text-white hover:bg-slate-800"
                    >
                      Open Subject Consent
                    </Link>
                  </div>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function EvidenceTable({ rows }: { rows: ConsentManagementEvidenceRow[] }) {
  if (rows.length === 0) {
    return <p className="text-sm text-slate-500">No consent evidence uploads found for this study.</p>
  }

  return (
    <div className="overflow-x-auto">
      <table className="min-w-full divide-y divide-slate-200 text-sm">
        <thead className="bg-slate-50">
          <tr className="text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
            <th className="px-3 py-2">Subject</th>
            <th className="px-3 py-2">Evidence</th>
            <th className="px-3 py-2">Kind</th>
            <th className="px-3 py-2">Source</th>
            <th className="px-3 py-2">Linked</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {rows.map((row) => (
            <tr key={row.id}>
              <td className="px-3 py-3">
                <div className="font-medium text-slate-900">{row.subjectIdentifier}</div>
                <div className="mt-0.5 text-xs text-slate-500">{row.subjectId}</div>
              </td>
              <td className="px-3 py-3 text-slate-700">{row.fileName}</td>
              <td className="px-3 py-3 text-slate-700">{row.documentKind}</td>
              <td className="px-3 py-3 text-slate-600">{row.source ?? '—'}</td>
              <td className="px-3 py-3 text-slate-600">{formatDateTime(row.linkedAt)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function ReconsentTable({ rows }: { rows: ConsentManagementReconsentRow[] }) {
  if (rows.length === 0) {
    return <p className="text-sm text-slate-500">No pending reconsent items.</p>
  }

  return (
    <div className="overflow-x-auto">
      <table className="min-w-full divide-y divide-slate-200 text-sm">
        <thead className="bg-slate-50">
          <tr className="text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
            <th className="px-3 py-2">Subject</th>
            <th className="px-3 py-2">Current</th>
            <th className="px-3 py-2">Next</th>
            <th className="px-3 py-2">Reason</th>
            <th className="px-3 py-2">Due</th>
            <th className="px-3 py-2">Status</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {rows.map((row) => (
            <tr key={row.id}>
              <td className="px-3 py-3">
                <div className="font-medium text-slate-900">{row.subjectIdentifier}</div>
                <div className="mt-0.5 text-xs text-slate-500">{row.subjectId}</div>
              </td>
              <td className="px-3 py-3 text-slate-700">{row.currentVersionLabel ?? '—'}</td>
              <td className="px-3 py-3 text-slate-700">{row.nextVersionLabel ?? '—'}</td>
              <td className="px-3 py-3 text-slate-600">{row.reason}</td>
              <td className="px-3 py-3 text-slate-600">{formatDate(row.dueDate)}</td>
              <td className="px-3 py-3">
                <Badge tone={row.status === 'overdue' ? 'red' : 'amber'}>{row.status}</Badge>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function SessionTable({ rows }: { rows: ConsentManagementSessionRow[] }) {
  if (rows.length === 0) {
    return <p className="text-sm text-slate-500">No consent sessions have been created yet.</p>
  }

  return (
    <div className="overflow-x-auto">
      <table className="min-w-full divide-y divide-slate-200 text-sm">
        <thead className="bg-slate-50">
          <tr className="text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
            <th className="px-3 py-2">Subject</th>
            <th className="px-3 py-2">Session</th>
            <th className="px-3 py-2">Language</th>
            <th className="px-3 py-2">Status</th>
            <th className="px-3 py-2">Expires</th>
            <th className="px-3 py-2">Last viewed</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {rows.map((row) => (
            <tr key={row.id}>
              <td className="px-3 py-3">
                <div className="font-medium text-slate-900">{row.subjectIdentifier}</div>
                <div className="mt-0.5 text-xs text-slate-500">{row.subjectId}</div>
              </td>
              <td className="px-3 py-3 text-slate-700">{row.consentVersionLabel ?? '—'} · {row.tokenHint}…</td>
              <td className="px-3 py-3 text-slate-700">{row.language.toUpperCase()}</td>
              <td className="px-3 py-3">
                <Badge tone={['expired', 'revoked'].includes(row.status) ? 'red' : 'blue'}>{row.status}</Badge>
              </td>
              <td className="px-3 py-3 text-slate-600">{formatDateTime(row.expiresAt)}</td>
              <td className="px-3 py-3 text-slate-600">{formatDateTime(row.lastViewedAt)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

export function ConsentManagementView({ overview, studyId }: ConsentManagementViewProps) {
  return (
    <div className="space-y-6">
      <header className="max-w-3xl">
        <p className="text-xs font-semibold uppercase tracking-wide text-teal-700">Consent management</p>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight text-slate-900">Consent Management</h1>
        <p className="mt-2 text-sm text-slate-600">
          Controlled consent templates live at the study level. Signed subject consent records, evidence uploads,
          and reconsent evaluation stay visible and auditable without forcing every site into a single workflow.
        </p>
      </header>

      <section className="grid gap-3 md:grid-cols-5">
        <MetricCard label="Library versions" value={overview.dashboard.libraryVersions} detail="Approved and draft consent templates" />
        <MetricCard label="Active versions" value={overview.dashboard.activeLibraryVersions} detail="Available for new consent" />
        <MetricCard label="Subject records" value={overview.dashboard.subjectRecords} detail="Signed consent records" />
        <MetricCard label="Action needed" value={overview.dashboard.actionNeededRecords} detail="Missing signatures, evidence, or gate issues" />
        <MetricCard label="Reconsent queue" value={overview.dashboard.reconsentQueue} detail="New version or safety update follow-up" />
      </section>

      <SectionShell
        title="Consent Library"
        description="Approved study-level consent templates and versions. This is the controlled source for what can be used at the subject level."
      >
        <ConsentLibraryTable rows={overview.libraryVersions} />
      </SectionShell>

      <SectionShell
        title="Subject Consent Records"
        description="Signed consent records by subject. These drive visit/source/compliance gates and should always reference an approved library version."
      >
        <SubjectConsentTable rows={overview.subjectRecords} studyId={studyId} />
      </SectionShell>

      <div className="grid gap-6 xl:grid-cols-2">
        <SectionShell
          title="Consent Evidence Uploads"
          description="Paper scans, external platform PDFs, and other supporting evidence linked to subject consent records."
        >
          <EvidenceTable rows={overview.evidenceUploads} />
        </SectionShell>
        <SectionShell
          title="Consent Sessions"
          description="Temporary eConsent sessions and expiring access links for electronic workflows."
        >
          <SessionTable rows={overview.patientSessions} />
        </SectionShell>
      </div>

      <SectionShell
        title="Reconsent / Action Needed Queue"
        description="Subjects potentially impacted by a new version, addendum, safety update, or IRB action."
      >
        <ReconsentTable rows={overview.reconsentQueue} />
      </SectionShell>

      <section className="rounded-md border border-slate-200 bg-slate-50 p-5 text-sm text-slate-600">
        <p className="font-medium text-slate-900">Access and compliance notes</p>
        <p className="mt-1">
          Consent evidence is preserved as audit-ready documents, but operational truth comes from the Consent Record.
          For subject-level signing, attestation, or portal-based consent, open the Subject Profile consent tab.
        </p>
      </section>
    </div>
  )
}

function MetricCard({
  label,
  value,
  detail,
}: {
  label: string
  value: number
  detail: string
}) {
  return (
    <div className="rounded-md border border-slate-200 bg-white p-4">
      <p className="text-xs text-slate-500">{label}</p>
      <p className="mt-1 text-2xl font-semibold text-slate-900">{value}</p>
      <p className="mt-1 text-xs text-slate-500">{detail}</p>
    </div>
  )
}
