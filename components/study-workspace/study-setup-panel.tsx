import Link from 'next/link'
import type { StudySetupDocument } from '@/lib/study-workspace/load-study-setup-documents'
import type { StudyWorkspaceRuntimeLinks } from '@/lib/study-workspace/study-workspace-links'

type StudySetupPanelProps = {
  documents: StudySetupDocument[]
  links: StudyWorkspaceRuntimeLinks
  studyId: string
  hasProtocolDraft: boolean
  hasPublishedSource: boolean
}

type ResolvedAction = { href: string; label: string }

function buildProtocolIntakeHref(studyId: string, documentId: string): string {
  const params = new URLSearchParams({ study_id: studyId, source_document_id: documentId })
  return `/protocol-intake-runtime?${params.toString()}`
}

function buildReviewDraftHref(studyId: string): string {
  const params = new URLSearchParams({ study_id: studyId })
  return `/protocol-reconciliation?${params.toString()}`
}

function buildWorkspaceSectionHref(studyId: string, section: string): string {
  const params = new URLSearchParams({ section })
  return `/studies/${studyId}/workspace?${params.toString()}`
}

/**
 * Resolve the single real next action for a document, using only existing
 * study-scoped routes. Returns null when no wired destination exists (queued /
 * needs classification), so the panel never renders a dead-end button.
 */
function resolveAction(
  document: StudySetupDocument,
  studyId: string,
  links: StudyWorkspaceRuntimeLinks,
  hasProtocolDraft: boolean,
  hasPublishedSource: boolean,
): ResolvedAction | null {
  if (document.routeStatus !== 'enabled') return null

  switch (document.destinationKind) {
    case 'protocol': {
      if (hasPublishedSource) {
        return {
          href: buildWorkspaceSectionHref(studyId, 'published-source'),
          label: 'Open Source Runtime / Published Source',
        }
      }
      if (hasProtocolDraft) {
        return { href: buildReviewDraftHref(studyId), label: 'Review Runtime Draft' }
      }
      return { href: buildProtocolIntakeHref(studyId, document.id), label: 'Continue Setup' }
    }
    case 'regulatory_binder':
      return {
        href: buildWorkspaceSectionHref(studyId, 'regulatory-binder'),
        label: document.actionLabel ?? 'Open Regulatory Binder',
      }
    case 'source_evidence':
      return {
        href: links.sourceBlueprintEvidence,
        label: document.actionLabel ?? 'Open Source Evidence / Builder',
      }
    case 'document_intelligence':
      return {
        href: links.documentIntelligence,
        label: document.actionLabel ?? 'Open Document Intelligence',
      }
    default:
      return null
  }
}

function formatDate(value: string): string {
  if (!value) return '—'
  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) return value
  return parsed.toLocaleDateString()
}

function StatusBadge({ status }: { status: string }) {
  return (
    <span className="inline-flex items-center rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-600">
      {status}
    </span>
  )
}

function ActionCell({ action, routeStatus }: { action: ResolvedAction | null; routeStatus: string }) {
  if (action) {
    return (
      <Link
        href={action.href}
        className="inline-flex rounded-md bg-slate-900 px-3 py-1.5 text-xs font-medium text-white hover:bg-slate-800"
      >
        {action.label}
      </Link>
    )
  }

  if (routeStatus === 'needs_classification') {
    return (
      <span className="inline-flex items-center rounded-md border border-amber-200 bg-amber-50 px-2.5 py-1 text-xs font-medium text-amber-700">
        Needs classification
      </span>
    )
  }

  return (
    <span className="inline-flex items-center rounded-md border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs font-medium text-slate-500">
      Queued / Not wired yet
    </span>
  )
}

export function StudySetupPanel({
  documents,
  links,
  studyId,
  hasProtocolDraft,
  hasPublishedSource,
}: StudySetupPanelProps) {
  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold text-slate-800">Study Setup — Document Routing</h2>
          <p className="mt-1 max-w-2xl text-sm text-slate-500">
            Uploaded study documents, where their result lives today, and the next available action —
            based on the classification recorded at intake. Only destinations backed by an existing
            surface expose an action; everything else is queued until its runtime is connected.
          </p>
        </div>
        <Link
          href={links.documentIntake}
          className="inline-flex shrink-0 rounded-md border border-slate-300 px-3 py-2 text-sm font-medium text-slate-800 hover:bg-slate-50"
        >
          Upload / manage documents
        </Link>
      </div>

      {documents.length === 0 ? (
        <div className="rounded-md border border-dashed border-slate-200 p-8 text-sm text-slate-500">
          No documents uploaded for this study yet. Upload the protocol and supporting documents in{' '}
          <Link href={links.documentIntake} className="font-medium text-teal-700 hover:underline">
            Document Intake
          </Link>{' '}
          to begin study setup.
        </div>
      ) : (
        <div className="overflow-x-auto rounded-md border border-slate-200">
          <table className="min-w-full divide-y divide-slate-200 text-sm">
            <thead className="bg-slate-50">
              <tr className="text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                <th className="px-4 py-2.5">Document</th>
                <th className="px-4 py-2.5">Classification</th>
                <th className="px-4 py-2.5">Destination</th>
                <th className="px-4 py-2.5">Status</th>
                <th className="px-4 py-2.5">Output / result</th>
                <th className="px-4 py-2.5">Uploaded</th>
                <th className="px-4 py-2.5">Open result</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {documents.map((document) => {
                const action = resolveAction(
                  document,
                  studyId,
                  links,
                  hasProtocolDraft,
                  hasPublishedSource,
                )
                return (
                  <tr key={document.id} className="align-top">
                    <td className="px-4 py-3">
                      <p className="font-medium text-slate-900">{document.name}</p>
                      {document.originalFilename && document.originalFilename !== document.name ? (
                        <p className="mt-0.5 text-xs text-slate-400">{document.originalFilename}</p>
                      ) : null}
                    </td>
                    <td className="px-4 py-3 text-slate-700">
                      {document.routeStatus === 'needs_classification' ? (
                        <span className="text-amber-700">Needs classification</span>
                      ) : (
                        document.classificationLabel
                      )}
                    </td>
                    <td className="px-4 py-3 text-slate-700">{document.destinationLabel}</td>
                    <td className="px-4 py-3">
                      <StatusBadge status={document.status} />
                    </td>
                    <td className="px-4 py-3 text-slate-600">{document.outputLabel}</td>
                    <td className="px-4 py-3 text-slate-500">{formatDate(document.createdAt)}</td>
                    <td className="px-4 py-3">
                      <ActionCell action={action} routeStatus={document.routeStatus} />
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
