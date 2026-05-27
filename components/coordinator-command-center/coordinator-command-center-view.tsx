import Link from 'next/link'
import type { CoordinatorCommandCenterModel } from '@/lib/coordinator-command-center'
import {
  CommandCenterAlertSection,
  CommandCenterSection,
} from './command-center-section'
import { formatDateTime } from './command-center-utils'

export function CoordinatorCommandCenterView({
  model,
}: {
  model: CoordinatorCommandCenterModel
}) {
  const totalReview =
    model.pendingEvidenceReviews.length + model.pendingDraftSuggestions.length
  const totalSignatures = model.pendingSignatures.length
  const totalAlerts = model.runtimeAlerts.length + model.versionDriftAlerts.length

  return (
    <div className="space-y-5 p-6">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div className="max-w-3xl">
          <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
            Coordinator Command Center
          </p>
          <h1 className="text-2xl font-semibold tracking-tight text-slate-900">
            Coordinator Action Needed
          </h1>
          <p className="mt-2 text-sm text-slate-600">
            One read-only view for review work, signatures, runtime alerts, pending workflow, and
            version changes across the coordinator workflow.
          </p>
        </div>
        <div className="rounded-md border border-slate-200 bg-slate-50 p-3 text-xs text-slate-600">
          Updated {formatDateTime(model.generatedAt)}
        </div>
      </header>

      <section className="rounded-md border border-slate-200 bg-slate-50 p-4">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-sm font-medium text-slate-700">Study scope</span>
          <Link
            href="/coordinator-command-center"
            className={`rounded border px-3 py-1.5 text-xs font-medium ${
              model.selectedStudyId
                ? 'border-slate-300 bg-white text-slate-700'
                : 'border-teal-700 bg-teal-700 text-white'
            }`}
          >
            All studies
          </Link>
          {model.studies.map((study) => (
            <Link
              key={study.id}
              href={`/coordinator-command-center?study_id=${study.id}`}
              className={`rounded border px-3 py-1.5 text-xs font-medium ${
                model.selectedStudyId === study.id
                  ? 'border-teal-700 bg-teal-700 text-white'
                  : 'border-slate-300 bg-white text-slate-700 hover:bg-slate-50'
              }`}
            >
              {study.name}
            </Link>
          ))}
        </div>
      </section>

      <div className="grid gap-3 md:grid-cols-3">
        <div className="rounded-md border border-slate-200 bg-white p-4">
          <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
            Pending Review
          </p>
          <p className="mt-2 text-3xl font-semibold text-slate-900">{totalReview}</p>
        </div>
        <div className="rounded-md border border-slate-200 bg-white p-4">
          <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
            Requires Signature
          </p>
          <p className="mt-2 text-3xl font-semibold text-slate-900">{totalSignatures}</p>
        </div>
        <div className="rounded-md border border-slate-200 bg-white p-4">
          <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
            Runtime Alert
          </p>
          <p className="mt-2 text-3xl font-semibold text-slate-900">{totalAlerts}</p>
        </div>
      </div>

      {model.unavailable.length > 0 ? (
        <section className="rounded-md border border-amber-200 bg-amber-50 p-3">
          <h2 className="text-sm font-semibold text-amber-900">Review Required</h2>
          <ul className="mt-2 space-y-1 text-xs text-amber-800">
            {model.unavailable.map((message) => (
              <li key={message}>{message}</li>
            ))}
          </ul>
        </section>
      ) : null}

      <div className="grid gap-4 xl:grid-cols-2">
        <CommandCenterSection
          title="Pending Evidence Reviews"
          label="Pending Review"
          empty="No pending evidence reviews or superseded candidates."
          items={model.pendingEvidenceReviews}
        />
        <CommandCenterSection
          title="Pending Draft Suggestions"
          label="Review Required"
          empty="No draft suggestions awaiting review."
          items={model.pendingDraftSuggestions}
        />
        <CommandCenterSection
          title="Pending Signatures"
          label="Requires Signature"
          empty="No pending operational signatures."
          items={model.pendingSignatures}
        />
        <CommandCenterAlertSection
          title="Runtime/Publication Alerts"
          label="Runtime Alert"
          empty="No runtime or publication alerts."
          items={model.runtimeAlerts}
        />
        <CommandCenterAlertSection
          title="Protocol Change / Version Drift Alerts"
          label="Version Change"
          empty="No protocol version drift alerts."
          items={model.versionDriftAlerts}
        />
      </div>

      <p className="text-xs text-slate-500">
        This command center is read-only. It does not review evidence, approve suggestions, sign
        artifacts, publish source, mutate reconciliation, or change visit execution.
      </p>
    </div>
  )
}
