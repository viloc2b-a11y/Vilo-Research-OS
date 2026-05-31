'use client'

import { useEffect, useMemo, useState, useTransition } from 'react'
import type { StudyWorkspaceRuntimeLinks } from '@/lib/study-workspace/study-workspace-links'
import {
  DELEGATION_EXAMPLE_ROWS,
  DELEGATION_LOG_COLUMNS,
  DELEGATION_TASKS,
  DELEGATION_USAGE_INSTRUCTIONS,
} from '@/lib/studies/isf-log-templates'
import {
  createDelegationAssignment,
  finalizeDelegationIfFullySigned,
  listDelegationWorkspace,
  type DelegationWorkspace,
} from '@/lib/studies/training-delegation-actions'
import { ElectronicSignaturePanel } from '@/components/operations/ElectronicSignaturePanel'

type StudyDelegationPanelProps = {
  links: StudyWorkspaceRuntimeLinks
  studyId: string
}

function today() {
  return new Date().toISOString().slice(0, 10)
}

export function StudyDelegationPanel({ links, studyId }: StudyDelegationPanelProps) {
  const [workspace, setWorkspace] = useState<DelegationWorkspace | null>(null)
  const [selectedStaffId, setSelectedStaffId] = useState('')
  const [selectedPiId, setSelectedPiId] = useState('')
  const [selectedTasks, setSelectedTasks] = useState<string[]>([
    'Obtain Informed Consent',
    'Subject Screening and Enrollment',
  ])
  const [dateDelegated, setDateDelegated] = useState(today())
  const [dateStarted, setDateStarted] = useState(today())
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  useEffect(() => {
    let active = true
    startTransition(async () => {
      try {
        const data = await listDelegationWorkspace(studyId)
        if (!active) return
        setWorkspace(data)
        setSelectedStaffId((current) => current || data.staff[0]?.userId || '')
        setSelectedPiId((current) => current || data.piCandidates[0]?.userId || data.staff[0]?.userId || '')
      } catch (err) {
        if (active) setError(err instanceof Error ? err.message : 'Failed to load delegation workspace')
      }
    })
    return () => {
      active = false
    }
  }, [studyId])

  const selectedStaff = useMemo(
    () => workspace?.staff.find((staff) => staff.userId === selectedStaffId) ?? null,
    [selectedStaffId, workspace],
  )
  const selectedPi = useMemo(
    () => workspace?.piCandidates.find((staff) => staff.userId === selectedPiId)
      ?? workspace?.staff.find((staff) => staff.userId === selectedPiId)
      ?? null,
    [selectedPiId, workspace],
  )

  function toggleTask(task: string) {
    setSelectedTasks((current) =>
      current.includes(task) ? current.filter((item) => item !== task) : [...current, task],
    )
  }

  function submitDelegation() {
    if (!selectedStaff || !selectedPi) {
      setError('Select both a delegatee and a PI.')
      return
    }
    setError(null)
    setMessage(null)
    startTransition(async () => {
      try {
        const result = await createDelegationAssignment(studyId, {
          staffUserId: selectedStaff.userId,
          staffRole: selectedStaff.role,
          delegateeName: selectedStaff.displayName,
          staffInitials: selectedStaff.initials,
          piDelegatorId: selectedPi.userId,
          piInitials: selectedPi.initials,
          taskLabels: selectedTasks,
          dateDelegated,
          dateStarted,
        })
        const refreshed = await listDelegationWorkspace(studyId)
        setWorkspace(refreshed)
        setMessage(
          `Delegation ${result.delegationId.slice(0, 8)} created. Delegatee and PI signature requests are pending.`,
        )
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to create delegation')
      }
    })
  }

  function refreshAfterSignature(delegationLogId: string) {
    startTransition(async () => {
      try {
        await finalizeDelegationIfFullySigned(delegationLogId)
        const refreshed = await listDelegationWorkspace(studyId)
        setWorkspace(refreshed)
        setMessage('Signature recorded. Delegation status refreshed.')
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to refresh signature status')
      }
    })
  }

  return (
    <div className="space-y-6">
      <div>
        <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
          Investigator and Site Documentation
        </p>
        <h2 className="text-lg font-semibold text-slate-900">Site Delegation Log</h2>
        <p className="mt-1 text-sm text-slate-500">
          Documents the study tasks delegated by the Principal Investigator to qualified site
          personnel, supporting ICH GCP E6(R2) section 4.1.5.
        </p>
      </div>

      <section className="grid gap-3 rounded-md border border-slate-200 bg-slate-50 p-4 text-sm sm:grid-cols-2">
        <Field label="Study Name" value="[Study name]" />
        <Field label="Study Number" value="[Study number]" />
        <Field label="Site Name" value="[Site name]" />
        <Field label="Site Number" value="[Site number]" />
        <Field label="Principal Investigator" value="[PI name]" />
        <Field label="Document Version" value="1.0" />
        <Field label="Date Created" value="[MM/DD/YYYY]" />
        <Field label="Last Updated" value="[MM/DD/YYYY]" />
      </section>

      <section className="rounded-md border border-teal-200 bg-teal-50 p-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h3 className="text-sm font-semibold text-teal-950">Delegate Tasks to Staff</h3>
            <p className="mt-1 text-sm text-teal-800">
              Select PI/CRC staff, assign delegated tasks, and create signature requests for the
              delegatee acceptance and PI approval.
            </p>
          </div>
          <a
            href={links.operationalSignatures}
            className="rounded border border-teal-300 bg-white px-3 py-2 text-sm font-medium text-teal-800 hover:bg-teal-100"
          >
            Open signature inbox
          </a>
        </div>

        <div className="mt-4 grid gap-4 lg:grid-cols-2">
          <label className="text-sm font-medium text-slate-800">
            Name of Delegatee
            <select
              className="mt-2 w-full rounded border border-slate-300 bg-white px-3 py-2 text-sm"
              value={selectedStaffId}
              onChange={(event) => setSelectedStaffId(event.target.value)}
              disabled={isPending || !workspace}
            >
              {(workspace?.staff ?? []).map((staff) => (
                <option key={staff.userId} value={staff.userId}>
                  {staff.displayName} · {staff.role}
                </option>
              ))}
            </select>
          </label>

          <label className="text-sm font-medium text-slate-800">
            Principal Investigator
            <select
              className="mt-2 w-full rounded border border-slate-300 bg-white px-3 py-2 text-sm"
              value={selectedPiId}
              onChange={(event) => setSelectedPiId(event.target.value)}
              disabled={isPending || !workspace}
            >
              {(workspace?.piCandidates.length ? workspace.piCandidates : workspace?.staff ?? []).map((staff) => (
                <option key={staff.userId} value={staff.userId}>
                  {staff.displayName} · {staff.role}
                </option>
              ))}
            </select>
          </label>

          <label className="text-sm font-medium text-slate-800">
            Date Delegated
            <input
              className="mt-2 w-full rounded border border-slate-300 bg-white px-3 py-2 text-sm"
              type="date"
              value={dateDelegated}
              onChange={(event) => setDateDelegated(event.target.value)}
            />
          </label>

          <label className="text-sm font-medium text-slate-800">
            Date Started
            <input
              className="mt-2 w-full rounded border border-slate-300 bg-white px-3 py-2 text-sm"
              type="date"
              value={dateStarted}
              onChange={(event) => setDateStarted(event.target.value)}
            />
          </label>
        </div>

        <div className="mt-4">
          <p className="text-sm font-medium text-slate-800">Task/Responsibility</p>
          <div className="mt-2 grid gap-2 sm:grid-cols-2">
            {(workspace?.duties.map((duty) => duty.label) ?? [...DELEGATION_TASKS]).map((task) => (
              <label
                key={task}
                className="flex items-start gap-2 rounded border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700"
              >
                <input
                  type="checkbox"
                  className="mt-1"
                  checked={selectedTasks.includes(task)}
                  onChange={() => toggleTask(task)}
                />
                <span>{task}</span>
              </label>
            ))}
          </div>
        </div>

        <div className="mt-4 rounded border border-slate-200 bg-white p-3 text-sm text-slate-700">
          <p className="font-medium">Pending delegation preview</p>
          <p className="mt-1">
            {selectedStaff?.displayName ?? 'Delegatee'} ({selectedStaff?.initials ?? '--'}) will
            receive {selectedTasks.length} delegated task(s). {selectedPi?.displayName ?? 'PI'} (
            {selectedPi?.initials ?? '--'}) will receive the PI approval request.
          </p>
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-3">
          <button
            type="button"
            className="rounded bg-teal-700 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
            disabled={isPending || !workspace || selectedTasks.length === 0}
            onClick={submitDelegation}
          >
            {isPending ? 'Creating...' : 'Add to Delegation Log'}
          </button>
          {message ? <p className="text-sm font-medium text-teal-800">{message}</p> : null}
          {error ? <p className="text-sm font-medium text-red-700">{error}</p> : null}
        </div>
      </section>

      <section className="space-y-3">
        <h3 className="text-sm font-semibold text-slate-800">Current Delegation Assignments</h3>
        <div className="overflow-x-auto rounded-md border border-slate-200">
          <table className="min-w-[1000px] border-collapse bg-white text-left text-xs">
            <thead className="bg-slate-100 text-slate-700">
              <tr>
                <th className="border border-slate-200 px-3 py-2">Name of Delegatee</th>
                <th className="border border-slate-200 px-3 py-2">Title/Role</th>
                <th className="border border-slate-200 px-3 py-2">Initials</th>
                <th className="border border-slate-200 px-3 py-2">Tasks</th>
                <th className="border border-slate-200 px-3 py-2">Date Delegated</th>
                <th className="border border-slate-200 px-3 py-2">Delegatee Signature</th>
                <th className="border border-slate-200 px-3 py-2">PI Signature</th>
              </tr>
            </thead>
            <tbody>
              {(workspace?.logs ?? []).length === 0 ? (
                <tr>
                  <td className="border border-slate-200 px-3 py-4 text-slate-500" colSpan={7}>
                    No delegation assignments created yet.
                  </td>
                </tr>
              ) : (
                workspace?.logs.map((log) => (
                  <tr key={log.id} className="text-slate-700 align-top">
                    <td className="border border-slate-200 px-3 py-2">
                      <p className="font-medium">{log.delegateeName}</p>
                      <p className="mt-1 text-slate-500">{log.status}</p>
                    </td>
                    <td className="border border-slate-200 px-3 py-2">{log.staffRole}</td>
                    <td className="border border-slate-200 px-3 py-2">{log.staffInitials}</td>
                    <td className="border border-slate-200 px-3 py-2">{log.tasks.join(', ')}</td>
                    <td className="border border-slate-200 px-3 py-2">{log.delegationDate}</td>
                    <td className="border border-slate-200 px-3 py-2">
                      {log.staffSignatureRequestId ? (
                        <div className="min-w-[260px]">
                          <ElectronicSignaturePanel
                            requestId={log.staffSignatureRequestId}
                            signatureMeaning="Delegatee acceptance"
                            attestationText="I accept the delegated responsibilities listed for this study."
                            requiredRole={log.staffRole}
                            status={log.staffSignatureStatus === 'signed' ? 'signed' : 'pending'}
                            onSigned={() => refreshAfterSignature(log.id)}
                          />
                        </div>
                      ) : (
                        'Not requested'
                      )}
                    </td>
                    <td className="border border-slate-200 px-3 py-2">
                      {log.piSignatureRequestId ? (
                        <div className="min-w-[260px]">
                          <ElectronicSignaturePanel
                            requestId={log.piSignatureRequestId}
                            signatureMeaning="PI delegation approval"
                            attestationText="I approve this delegation of study responsibilities."
                            requiredRole="pi_sub_i"
                            status={log.piSignatureStatus === 'signed' ? 'signed' : 'pending'}
                            onSigned={() => refreshAfterSignature(log.id)}
                          />
                        </div>
                      ) : (
                        'Not requested'
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>

      <section className="space-y-3">
        <h3 className="text-sm font-semibold text-slate-800">Delegable Tasks</h3>
        <div className="grid gap-2 text-sm text-slate-600 sm:grid-cols-2">
          {DELEGATION_TASKS.map((task) => (
            <div key={task} className="rounded border border-slate-200 bg-white px-3 py-2">
              {task}
            </div>
          ))}
        </div>
      </section>

      <section className="space-y-3">
        <h3 className="text-sm font-semibold text-slate-800">Example Delegation Log</h3>
        <div className="overflow-x-auto rounded-md border border-slate-200">
          <table className="min-w-[1100px] border-collapse bg-white text-left text-xs">
            <thead className="bg-slate-100 text-slate-700">
              <tr>
                {DELEGATION_LOG_COLUMNS.map((column) => (
                  <th key={column} className="border border-slate-200 px-3 py-2 font-semibold">
                    {column}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {DELEGATION_EXAMPLE_ROWS.map((row) => (
                <tr key={`${row[0]}-${row[1]}`} className="text-slate-700">
                  {row.map((cell, index) => (
                    <td key={`${row[0]}-${index}`} className="border border-slate-200 px-3 py-2">
                      {cell || <span className="text-slate-400">Active</span>}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="grid gap-4 lg:grid-cols-[1fr_300px]">
        <div className="rounded-md border border-slate-200 bg-white p-4">
          <h3 className="text-sm font-semibold text-slate-800">Instructions for Use</h3>
          <ul className="mt-3 list-disc space-y-2 pl-5 text-sm text-slate-600">
            {DELEGATION_USAGE_INSTRUCTIONS.map((instruction) => (
              <li key={instruction}>{instruction}</li>
            ))}
          </ul>
        </div>
        <aside className="rounded-md border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600">
          <p className="font-semibold text-slate-800">ISF Location</p>
          <p className="mt-1">Investigator and Site Documentation, with CVs and GCP certificates.</p>
          <p className="mt-4 font-semibold text-slate-800">Retention</p>
          <p className="mt-1">Retain for 15 years after study completion.</p>
        </aside>
      </section>

      <section className="space-y-3">
        <h3 className="text-sm font-semibold text-slate-800">Version Control</h3>
        <div className="overflow-x-auto rounded-md border border-slate-200">
          <table className="min-w-full border-collapse bg-white text-left text-xs">
            <thead className="bg-slate-100 text-slate-700">
              <tr>
                <th className="border border-slate-200 px-3 py-2">Date of Change</th>
                <th className="border border-slate-200 px-3 py-2">Change Description</th>
                <th className="border border-slate-200 px-3 py-2">Changed By</th>
              </tr>
            </thead>
            <tbody>
              <tr className="text-slate-500">
                <td className="border border-slate-200 px-3 py-2">[MM/DD/YYYY]</td>
                <td className="border border-slate-200 px-3 py-2">Initial site delegation log created.</td>
                <td className="border border-slate-200 px-3 py-2">[Name]</td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>

      <footer className="rounded-md border border-slate-200 bg-white p-4 text-xs text-slate-500">
        <p>This document must remain current and available for regulatory inspection.</p>
        <p className="mt-1">
          Handwritten or electronic signatures are valid when controlled according to 21 CFR Part 11.
          Upload supporting delegation documents through{' '}
          <a href={links.documentIntake} className="text-teal-700 underline">
            Documents / Compliance
          </a>
          .
        </p>
      </footer>
    </div>
  )
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs font-medium uppercase tracking-wide text-slate-500">{label}</p>
      <p className="mt-1 rounded border border-slate-200 bg-white px-3 py-2 text-slate-700">
        {value}
      </p>
    </div>
  )
}
