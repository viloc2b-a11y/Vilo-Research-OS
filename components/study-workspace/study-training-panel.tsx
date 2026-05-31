'use client'

import { useEffect, useMemo, useState, useTransition } from 'react'
import type { StudyWorkspaceRuntimeLinks } from '@/lib/study-workspace/study-workspace-links'
import {
  TRAINING_EXAMPLE_ROWS,
  TRAINING_LOG_COLUMNS,
  TRAINING_USAGE_INSTRUCTIONS,
} from '@/lib/studies/isf-log-templates'
import {
  completePiTrainingAcknowledgment,
  completeTraineeTrainingSignature,
  completeTrainerTrainingSignature,
  createTrainingAssignment,
  listTrainingLogWorkspace,
  requestPiTrainingAcknowledgment,
  requestTraineeTrainingSignature,
  requestTrainerTrainingSignature,
  type TrainingAssignmentRow,
  type TrainingLogWorkspace,
} from '@/lib/studies/training-log-actions'
import { ElectronicSignaturePanel } from '@/components/operations/ElectronicSignaturePanel'

type StudyTrainingPanelProps = {
  links: StudyWorkspaceRuntimeLinks
  studyId: string
}

function todayPlus(days: number) {
  const date = new Date()
  date.setDate(date.getDate() + days)
  return date.toISOString().slice(0, 10)
}

export function StudyTrainingPanel({ links, studyId }: StudyTrainingPanelProps) {
  const [workspace, setWorkspace] = useState<TrainingLogWorkspace | null>(null)
  const [selectedTraineeId, setSelectedTraineeId] = useState('')
  const [selectedTrainerId, setSelectedTrainerId] = useState('')
  const [trainingType, setTrainingType] = useState('Protocol-Specific Training')
  const [trainingTopic, setTrainingTopic] = useState('Protocol-Specific Training')
  const [materialTitle, setMaterialTitle] = useState('Protocol training material')
  const [dueDate, setDueDate] = useState(todayPlus(7))
  const [requiresTrainerSignature, setRequiresTrainerSignature] = useState(false)
  const [requiresPiAcknowledgment, setRequiresPiAcknowledgment] = useState(false)
  const [certificateExpected, setCertificateExpected] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  const loadWorkspace = () => {
    startTransition(async () => {
      try {
        const data = await listTrainingLogWorkspace(studyId)
        setWorkspace(data)
        setSelectedTraineeId((current) => current || data.staff[0]?.userId || '')
        setSelectedTrainerId((current) => current || data.piCandidates[0]?.userId || data.staff[0]?.userId || '')
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load training log')
      }
    })
  }

  useEffect(() => {
    loadWorkspace()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [studyId])

  const selectedTrainee = useMemo(
    () => workspace?.staff.find((staff) => staff.userId === selectedTraineeId) ?? null,
    [selectedTraineeId, workspace],
  )
  const selectedTrainer = useMemo(
    () => workspace?.staff.find((staff) => staff.userId === selectedTrainerId) ?? null,
    [selectedTrainerId, workspace],
  )

  function createAssignment() {
    if (!selectedTrainee) {
      setError('Select a trainee.')
      return
    }
    setError(null)
    setMessage(null)
    startTransition(async () => {
      try {
        const result = await createTrainingAssignment(studyId, {
          traineeUserId: selectedTrainee.userId,
          traineeName: selectedTrainee.displayName,
          traineeRole: selectedTrainee.role,
          traineeInitials: selectedTrainee.initials,
          trainingType,
          trainingTopic,
          trainingMaterialTitle: materialTitle,
          dueDate,
          trainerUserId: selectedTrainer?.userId ?? null,
          trainerName: selectedTrainer?.displayName ?? null,
          trainerInitials: selectedTrainer?.initials ?? null,
          requiresTrainerSignature,
          requiresPiAcknowledgment,
          certificateExpected,
        })
        const refreshed = await listTrainingLogWorkspace(studyId)
        setWorkspace(refreshed)
        setMessage(`Training assignment ${result.assignmentId.slice(0, 8)} created.`)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to create training assignment')
      }
    })
  }

  function requestSignature(
    assignment: TrainingAssignmentRow,
    role: 'trainee' | 'trainer' | 'pi',
  ) {
    startTransition(async () => {
      try {
        if (role === 'trainee') await requestTraineeTrainingSignature(assignment.id)
        if (role === 'trainer') await requestTrainerTrainingSignature(assignment.id)
        if (role === 'pi') await requestPiTrainingAcknowledgment(assignment.id)
        const refreshed = await listTrainingLogWorkspace(studyId)
        setWorkspace(refreshed)
        setMessage(`${role} signature request is ready.`)
      } catch (err) {
        setError(err instanceof Error ? err.message : `Failed to request ${role} signature`)
      }
    })
  }

  function completeSignature(
    assignment: TrainingAssignmentRow,
    role: 'trainee' | 'trainer' | 'pi',
  ) {
    startTransition(async () => {
      try {
        if (role === 'trainee') await completeTraineeTrainingSignature(assignment.id)
        if (role === 'trainer') await completeTrainerTrainingSignature(assignment.id)
        if (role === 'pi') await completePiTrainingAcknowledgment(assignment.id)
        const refreshed = await listTrainingLogWorkspace(studyId)
        setWorkspace(refreshed)
        setMessage(`${role} signature recorded and assignment status refreshed.`)
      } catch (err) {
        setError(err instanceof Error ? err.message : `Failed to complete ${role} signature`)
      }
    })
  }

  return (
    <div className="space-y-6">
      <div>
        <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
          Training Documentation
        </p>
        <h2 className="text-lg font-semibold text-slate-900">Site Training Log</h2>
        <p className="mt-1 text-sm text-slate-500">
          Assign study training, request electronic trainee/trainer/PI signatures, and lock
          completed records into the audit trail.
        </p>
      </div>

      <section className="grid gap-3 rounded-md border border-slate-200 bg-slate-50 p-4 text-sm sm:grid-cols-2">
        <Field label="Study Name" value={workspace?.study.name ?? '[Study name]'} />
        <Field label="Study Number" value="[Study number]" />
        <Field label="Site Name" value="[Site name]" />
        <Field label="Site Number" value="[Site number]" />
        <Field label="Principal Investigator" value="[PI name]" />
        <Field label="Document Version" value="1.0" />
        <Field label="Date Created" value="[MM/DD/YYYY]" />
        <Field label="Last Updated" value="[MM/DD/YYYY]" />
      </section>

      <section className="rounded-md border border-teal-200 bg-teal-50 p-4">
        <h3 className="text-sm font-semibold text-teal-950">Create Training Assignment</h3>
        <div className="mt-4 grid gap-4 lg:grid-cols-2">
          <label className="text-sm font-medium text-slate-800">
            Trainee Name
            <select
              className="mt-2 w-full rounded border border-slate-300 bg-white px-3 py-2 text-sm"
              value={selectedTraineeId}
              onChange={(event) => setSelectedTraineeId(event.target.value)}
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
            Trainer / PI
            <select
              className="mt-2 w-full rounded border border-slate-300 bg-white px-3 py-2 text-sm"
              value={selectedTrainerId}
              onChange={(event) => setSelectedTrainerId(event.target.value)}
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
            Training Type
            <select
              className="mt-2 w-full rounded border border-slate-300 bg-white px-3 py-2 text-sm"
              value={trainingType}
              onChange={(event) => setTrainingType(event.target.value)}
            >
              {(workspace?.types ?? []).map((type) => (
                <option key={type} value={type}>{type}</option>
              ))}
            </select>
          </label>

          <label className="text-sm font-medium text-slate-800">
            Training Topic / Material
            <select
              className="mt-2 w-full rounded border border-slate-300 bg-white px-3 py-2 text-sm"
              value={trainingTopic}
              onChange={(event) => {
                setTrainingTopic(event.target.value)
                setMaterialTitle(event.target.value)
              }}
            >
              {(workspace?.topics ?? []).map((topic) => (
                <option key={topic} value={topic}>{topic}</option>
              ))}
            </select>
          </label>

          <label className="text-sm font-medium text-slate-800">
            Material Title
            <input
              className="mt-2 w-full rounded border border-slate-300 bg-white px-3 py-2 text-sm"
              value={materialTitle}
              onChange={(event) => setMaterialTitle(event.target.value)}
            />
          </label>

          <label className="text-sm font-medium text-slate-800">
            Due Date
            <input
              className="mt-2 w-full rounded border border-slate-300 bg-white px-3 py-2 text-sm"
              type="date"
              value={dueDate}
              onChange={(event) => setDueDate(event.target.value)}
            />
          </label>
        </div>

        <div className="mt-4 flex flex-wrap gap-4 text-sm text-slate-700">
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={requiresTrainerSignature}
              onChange={(event) => setRequiresTrainerSignature(event.target.checked)}
            />
            Trainer signature required
          </label>
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={requiresPiAcknowledgment}
              onChange={(event) => setRequiresPiAcknowledgment(event.target.checked)}
            />
            PI acknowledgment required
          </label>
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={certificateExpected}
              onChange={(event) => setCertificateExpected(event.target.checked)}
            />
            Certificate expected
          </label>
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-3">
          <button
            type="button"
            className="rounded bg-teal-700 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
            disabled={isPending || !workspace}
            onClick={createAssignment}
          >
            {isPending ? 'Creating...' : 'Create Training Assignment'}
          </button>
          {message ? <p className="text-sm font-medium text-teal-800">{message}</p> : null}
          {error ? <p className="text-sm font-medium text-red-700">{error}</p> : null}
        </div>
      </section>

      <section className="space-y-3">
        <h3 className="text-sm font-semibold text-slate-800">Training Assignments</h3>
        <div className="overflow-x-auto rounded-md border border-slate-200">
          <table className="min-w-[1400px] border-collapse bg-white text-left text-xs">
            <thead className="bg-slate-100 text-slate-700">
              <tr>
                <th className="border border-slate-200 px-3 py-2">Trainee</th>
                <th className="border border-slate-200 px-3 py-2">Training</th>
                <th className="border border-slate-200 px-3 py-2">Due</th>
                <th className="border border-slate-200 px-3 py-2">Status</th>
                <th className="border border-slate-200 px-3 py-2">Trainee Signature</th>
                <th className="border border-slate-200 px-3 py-2">Trainer Signature</th>
                <th className="border border-slate-200 px-3 py-2">PI Acknowledgment</th>
              </tr>
            </thead>
            <tbody>
              {(workspace?.assignments ?? []).length === 0 ? (
                <tr>
                  <td className="border border-slate-200 px-3 py-4 text-slate-500" colSpan={7}>
                    No training assignments created yet.
                  </td>
                </tr>
              ) : (
                workspace?.assignments.map((assignment) => (
                  <tr key={assignment.id} className="align-top text-slate-700">
                    <td className="border border-slate-200 px-3 py-2">
                      <p className="font-medium">{assignment.traineeName}</p>
                      <p className="text-slate-500">{assignment.traineeRole} · {assignment.traineeInitials}</p>
                    </td>
                    <td className="border border-slate-200 px-3 py-2">
                      <p className="font-medium">{assignment.trainingTopic}</p>
                      <p className="text-slate-500">{assignment.trainingType}</p>
                      <p className="text-slate-500">{assignment.trainingMaterialTitle}</p>
                    </td>
                    <td className="border border-slate-200 px-3 py-2">{assignment.dueDate ?? 'None'}</td>
                    <td className="border border-slate-200 px-3 py-2">
                      <span className="rounded bg-slate-100 px-2 py-1">{assignment.status}</span>
                      {assignment.lockedAt ? <p className="mt-2 text-slate-500">Locked</p> : null}
                    </td>
                    <td className="border border-slate-200 px-3 py-2">
                      <SignatureCell
                        assignment={assignment}
                        role="trainee"
                        requestId={assignment.traineeSignatureRequestId}
                        status={assignment.traineeSignatureStatus}
                        onRequest={() => requestSignature(assignment, 'trainee')}
                        onSigned={() => completeSignature(assignment, 'trainee')}
                      />
                    </td>
                    <td className="border border-slate-200 px-3 py-2">
                      {assignment.requiresTrainerSignature ? (
                        <SignatureCell
                          assignment={assignment}
                          role="trainer"
                          requestId={assignment.trainerSignatureRequestId}
                          status={assignment.trainerSignatureStatus}
                          onRequest={() => requestSignature(assignment, 'trainer')}
                          onSigned={() => completeSignature(assignment, 'trainer')}
                        />
                      ) : (
                        <span className="text-slate-400">Not required</span>
                      )}
                    </td>
                    <td className="border border-slate-200 px-3 py-2">
                      {assignment.requiresPiAcknowledgment ? (
                        <SignatureCell
                          assignment={assignment}
                          role="pi"
                          requestId={assignment.piSignatureRequestId}
                          status={assignment.piSignatureStatus}
                          onRequest={() => requestSignature(assignment, 'pi')}
                          onSigned={() => completeSignature(assignment, 'pi')}
                        />
                      ) : (
                        <span className="text-slate-400">Not required</span>
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
        <h3 className="text-sm font-semibold text-slate-800">Example Training Log</h3>
        <div className="overflow-x-auto rounded-md border border-slate-200">
          <table className="min-w-[1300px] border-collapse bg-white text-left text-xs">
            <thead className="bg-slate-100 text-slate-700">
              <tr>
                {TRAINING_LOG_COLUMNS.map((column) => (
                  <th key={column} className="border border-slate-200 px-3 py-2 font-semibold">
                    {column}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {TRAINING_EXAMPLE_ROWS.map((row) => (
                <tr key={`${row[0]}-${row[4]}`} className="text-slate-700">
                  {row.map((cell, index) => (
                    <td key={`${row[0]}-${index}`} className="border border-slate-200 px-3 py-2">
                      {cell || <span className="text-slate-400">N/A</span>}
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
            {TRAINING_USAGE_INSTRUCTIONS.map((instruction) => (
              <li key={instruction}>{instruction}</li>
            ))}
          </ul>
        </div>
        <aside className="rounded-md border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600">
          <p className="font-semibold text-slate-800">ISF Location</p>
          <p className="mt-1">Training Documentation, behind the Study Training tab.</p>
          <p className="mt-4 font-semibold text-slate-800">Retention</p>
          <p className="mt-1">Retain for 15 years after study completion.</p>
        </aside>
      </section>

      <footer className="rounded-md border border-slate-200 bg-white p-4 text-xs text-slate-500">
        <p>This document must remain current and available for regulatory inspection.</p>
        <p className="mt-1">
          Handwritten or electronic signatures are valid when controlled according to 21 CFR Part 11.
          Upload certificates and supporting evidence through{' '}
          <a href={links.documentIntake} className="text-teal-700 underline">
            Documents / Compliance
          </a>
          .
        </p>
      </footer>
    </div>
  )
}

function SignatureCell({
  assignment,
  role,
  requestId,
  status,
  onRequest,
  onSigned,
}: {
  assignment: TrainingAssignmentRow
  role: 'trainee' | 'trainer' | 'pi'
  requestId: string | null
  status: string | null
  onRequest: () => void
  onSigned: () => void
}) {
  if (!requestId) {
    return (
      <button
        type="button"
        className="rounded border border-slate-300 px-3 py-2 text-xs font-medium text-slate-800 hover:bg-slate-50"
        disabled={assignment.status === 'Completed' || assignment.status === 'Locked'}
        onClick={onRequest}
      >
        Request signature
      </button>
    )
  }

  return (
    <div className="min-w-[260px]">
      <ElectronicSignaturePanel
        requestId={requestId}
        signatureMeaning={role === 'pi' ? 'PI training acknowledgment' : `${role} training signature`}
        attestationText="I confirm this training record is accurate and complete."
        requiredRole={role === 'pi' ? 'pi_sub_i' : assignment.traineeRole}
        status={status === 'signed' ? 'signed' : 'pending'}
        onSigned={onSigned}
      />
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
