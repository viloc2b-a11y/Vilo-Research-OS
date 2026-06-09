'use client'

import { useMemo, useState, useTransition } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import type { StudyWorkspaceRuntimeLinks } from '@/lib/study-workspace/study-workspace-links'
import type { StudyGovernanceSummary } from '@/lib/study-workspace/load-governance-summary'
import type { StudyCloseoutSummary } from '@/lib/study-workspace/load-study-closeout-summary'
import type { LoadedProtocolRuntimeStudy } from '@/lib/protocol-intake-runtime/protocol-intake-types'
import {
  generateGovernanceRetrainingAction,
  requestProtocolAcceptanceAction,
} from '@/lib/studies/governance-runtime-actions'

type StudyGovernancePanelProps = {
  studyId: string
  links: StudyWorkspaceRuntimeLinks
  governanceSummary: StudyGovernanceSummary
  closeoutSummary: StudyCloseoutSummary
  protocolRuntimeStudy: LoadedProtocolRuntimeStudy | null
}

function formatDate(value: string | null | undefined) {
  if (!value) return '—'
  const parsed = new Date(value)
  return Number.isNaN(parsed.getTime()) ? value : parsed.toLocaleString()
}

function StatusPill({
  tone,
  children,
}: {
  tone: 'slate' | 'emerald' | 'amber' | 'red' | 'blue'
  children: string
}) {
  const classes = {
    slate: 'bg-slate-100 text-slate-700',
    emerald: 'bg-emerald-100 text-emerald-800',
    amber: 'bg-amber-100 text-amber-800',
    red: 'bg-red-100 text-red-800',
    blue: 'bg-blue-100 text-blue-800',
  }[tone]
  return <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${classes}`}>{children}</span>
}

export function StudyGovernancePanel({
  studyId,
  links,
  governanceSummary,
  closeoutSummary,
  protocolRuntimeStudy,
}: StudyGovernancePanelProps) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const latestVersion = protocolRuntimeStudy?.latestVersion ?? null
  const protocolStatus = protocolRuntimeStudy?.study.protocolStatus ?? 'draft'
  const acceptanceStatus = latestVersion?.piAcceptanceStatus ?? 'not_requested'
  const acceptanceTone =
    acceptanceStatus === 'signed'
      ? 'emerald'
      : acceptanceStatus === 'pending'
        ? 'amber'
        : acceptanceStatus === 'superseded'
          ? 'red'
          : 'slate'

  const summaryTiles = useMemo(
    () => [
      { label: 'Open signals', value: governanceSummary.openGovernanceSignalCount ?? 0 },
      { label: 'Blockers', value: governanceSummary.blockerSignalCount ?? 0 },
      { label: 'Warnings', value: governanceSummary.warningSignalCount ?? 0 },
      { label: 'Open governance signatures', value: governanceSummary.openGovernanceSignatureCount ?? 0 },
      { label: 'Open deviations', value: governanceSummary.activeDeviationCount ?? 0 },
    ],
    [governanceSummary],
  )

  function requestAcceptance() {
    if (!latestVersion) return
    setError(null)
    setMessage(null)
    startTransition(async () => {
      try {
        const result = await requestProtocolAcceptanceAction({
          studyId,
          protocolRuntimeVersionId: latestVersion.id,
        })
        setMessage(
          result.alreadyRequested
            ? 'PI acceptance request already exists.'
            : 'PI protocol acceptance request created.',
        )
        router.refresh()
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to request PI protocol acceptance.')
      }
    })
  }

  function generateRetraining() {
    if (!latestVersion) return
    setError(null)
    setMessage(null)
    startTransition(async () => {
      try {
        const result = await generateGovernanceRetrainingAction({
          studyId,
          protocolRuntimeVersionId: latestVersion.id,
        })
        setMessage(`Generated ${result.generatedCount} governance retraining assignment(s).`)
        router.refresh()
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to generate governance retraining.')
      }
    })
  }

  return (
    <div className="space-y-5">
      <div className="rounded-md border border-slate-200 bg-white p-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-base font-semibold text-slate-900">Governance Runtime</h2>
            <p className="mt-1 text-sm text-slate-500">
              PI acceptance, delegation, training acknowledgements, and amendment retraining all live on the universal Signature Engine.
            </p>
          </div>
          <Link
            href={links.operationalSignatures}
            className="rounded-md border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
          >
            Open pending signatures
          </Link>
          <Link
            href={links.governance}
            className="rounded-md border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
          >
            Governance workspace link
          </Link>
        </div>

        <div className="mt-4 grid gap-3 md:grid-cols-5">
          {summaryTiles.map((tile) => (
            <div key={tile.label} className="rounded-md border bg-slate-50 p-3">
              <div className="text-xs uppercase tracking-wide text-slate-500">{tile.label}</div>
              <div className="mt-1 text-lg font-semibold text-slate-900">{tile.value}</div>
            </div>
          ))}
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <section className="rounded-md border border-slate-200 bg-white p-4">
          <h3 className="text-sm font-semibold text-slate-800">Protocol Acceptance</h3>
          {latestVersion ? (
            <div className="mt-3 space-y-3 text-sm text-slate-700">
              <div className="grid gap-2 sm:grid-cols-2">
                <Tile label="Protocol version" value={latestVersion.versionLabel} />
                <Tile label="Version date" value={formatDate(latestVersion.versionDate)} />
                <Tile label="Protocol status" value={protocolStatus} />
                <Tile
                  label="PI acceptance"
                  value={
                    latestVersion.piAcceptedAt
                      ? `Signed at ${formatDate(latestVersion.piAcceptedAt)}`
                      : latestVersion.piAcceptanceSignatureRequestId
                        ? 'Pending signature'
                        : 'Not requested'
                  }
                />
              </div>
              <div className="flex flex-wrap gap-2">
                <StatusPill tone={acceptanceTone}>{acceptanceStatus}</StatusPill>
                {latestVersion.piAcceptanceSignatureId ? (
                  <StatusPill tone="emerald">Signature recorded</StatusPill>
                ) : null}
                {latestVersion.piAcceptedBy ? (
                  <StatusPill tone="blue">{`Signed by ${latestVersion.piAcceptedBy.slice(0, 8)}`}</StatusPill>
                ) : null}
              </div>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  className="rounded-md bg-teal-700 px-3 py-2 text-sm font-medium text-white disabled:opacity-50"
                  onClick={requestAcceptance}
                  disabled={isPending || acceptanceStatus === 'pending' || acceptanceStatus === 'signed'}
                >
                  Request PI acceptance
                </button>
                <Link
                  href={`/protocol-intake-runtime?study_id=${encodeURIComponent(studyId)}`}
                  className="rounded-md border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
                >
                  Open protocol runtime
                </Link>
              </div>
            </div>
          ) : (
            <p className="mt-3 text-sm text-slate-500">
              No protocol runtime version is linked to this study yet.
            </p>
          )}
        </section>

        <section className="rounded-md border border-slate-200 bg-white p-4">
          <h3 className="text-sm font-semibold text-slate-800">Delegation & Training</h3>
          <div className="mt-3 space-y-3 text-sm text-slate-700">
            <p>
              Use Delegation Log for staff role assignment and Training for version-aware acknowledgements.
            </p>
            <div className="flex flex-wrap gap-2">
              <Link
                href={`/studies/${encodeURIComponent(studyId)}/workspace?section=delegation`}
                className="rounded-md border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
              >
                Open delegation log
              </Link>
              <Link
                href={`/studies/${encodeURIComponent(studyId)}/workspace?section=training`}
                className="rounded-md border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
              >
                Open training log
              </Link>
              {latestVersion ? (
                <button
                  type="button"
                  className="rounded-md bg-slate-900 px-3 py-2 text-sm font-medium text-white disabled:opacity-50"
                  onClick={generateRetraining}
                  disabled={isPending}
                >
                  Generate retraining
                </button>
              ) : null}
            </div>
            <p className="text-xs text-slate-500">
              Amendment retraining is version-aware and will create fresh acknowledgements for active delegated staff.
            </p>
          </div>
        </section>
      </div>

      <section className="rounded-md border border-slate-200 bg-white p-4">
        <h3 className="text-sm font-semibold text-slate-800">Governance Queue</h3>
        <div className="mt-3 grid gap-3 md:grid-cols-3">
          <QueueItem label="Protocol acceptance" value={latestVersion?.piAcceptanceStatus ?? 'not_requested'} />
          <QueueItem label="Pending governance signatures" value={String(governanceSummary.openGovernanceSignatureCount ?? 0)} />
          <QueueItem label="Open governance signals" value={String(governanceSummary.openGovernanceSignalCount ?? 0)} />
        </div>
      </section>

      <section className="rounded-md border border-slate-200 bg-white p-4">
        <h3 className="text-sm font-semibold text-slate-800">Closeout Coverage</h3>
        <p className="mt-1 text-sm text-slate-500">
          Final PI sign-off, source completion certification, and regulatory closeout all stay on existing runtime surfaces.
        </p>
        <div className="mt-3 grid gap-3 md:grid-cols-3">
          <QueueItem
            label="Final PI sign-off"
            value={
              closeoutSummary.finalPiSignedVisitCount === null
                ? '—'
                : `${closeoutSummary.finalPiSignedVisitCount} signed visit closeout(s)`
            }
          />
          <QueueItem
            label="Source completion certification"
            value={
              closeoutSummary.sourceCompletionSignoffCount === null
                ? '—'
                : `${closeoutSummary.sourceCompletionSignoffCount} source sign-off package(s)`
            }
          />
          <QueueItem
            label="Regulatory closeout"
            value={
              closeoutSummary.regulatoryCloseoutReady === null
                ? '—'
                : closeoutSummary.regulatoryCloseoutReady
                  ? 'Ready'
                  : `${closeoutSummary.regulatoryOpenHoldCount ?? 0} hold(s)`
            }
          />
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          <Link
            href={links.studySubjects}
            className="rounded-md border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
          >
            Open subject closeout
          </Link>
          <Link
            href={links.sourceBlueprintSignoff}
            className="rounded-md border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
          >
            Open source completion sign-off
          </Link>
          <Link
            href={links.documentIntake}
            className="rounded-md border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
          >
            Open regulatory binder
          </Link>
        </div>
      </section>

      {message ? <p className="text-sm text-emerald-700">{message}</p> : null}
      {error ? <p className="text-sm text-red-600">{error}</p> : null}
    </div>
  )
}

function Tile({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border bg-slate-50 p-3">
      <div className="text-xs uppercase tracking-wide text-slate-500">{label}</div>
      <div className="mt-1 text-sm font-medium text-slate-900">{value || '—'}</div>
    </div>
  )
}

function QueueItem({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border bg-slate-50 p-3">
      <div className="text-xs uppercase tracking-wide text-slate-500">{label}</div>
      <div className="mt-1 text-sm font-medium text-slate-900">{value}</div>
    </div>
  )
}
