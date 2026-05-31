'use client'

import { useActionState, useState, useRef } from 'react'
import { PenLine, Phone, Plus, ShieldCheck, Upload } from 'lucide-react'
import { ElectronicSignaturePanel } from '@/components/operations/ElectronicSignaturePanel'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import {
  addSubjectStatusHistory,
  addSubjectEmergencyContact,
  addSubjectProgressNote,
  addSubjectProtocolDeviation,
  archiveSubjectEmergencyContact,
  closeSubjectProtocolDeviation,
  assignComplianceDocumentToSubject,
  completeSubjectDocumentRequest,
  completeSubjectSignature,
  INITIAL_SUBJECT_ACTION_STATE,
  requestSubjectDocumentReview,
  requestSubjectSignature,
  transitionSubjectDocumentRequest,
  transitionSubjectSignatureRequest,
  updateSubjectEmergencyContact,
  updateSubjectProtocolDeviation,
  updateSubjectStatusHistory,
  uploadSubjectDocumentAction,
} from '@/lib/subject/source-template/actions'
import {
  SUBJECT_DOCUMENT_CATEGORIES,
  type SubjectSourceTemplateModel,
} from '@/lib/subject/source-template/types'

function Status({ message, ok }: { message: string | null; ok: boolean }) {
  if (!message) return null
  return <p className={ok ? 'text-xs text-emerald-700' : 'text-xs text-destructive'}>{message}</p>
}

function HiddenSubject({ studySubjectId }: { studySubjectId: string }) {
  return <input type="hidden" name="study_subject_id" value={studySubjectId} />
}

type SectionProps = {
  studySubjectId: string
  model: SubjectSourceTemplateModel
}

export function SubjectProgressNotesSection({ studySubjectId, model }: SectionProps) {
  const [state, action, pending] = useActionState(addSubjectProgressNote, INITIAL_SUBJECT_ACTION_STATE)
  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-lg font-semibold">Progress Notes</h2>
        <p className="text-sm text-muted-foreground">Subject-level operational notes only.</p>
      </div>
      <form action={action} className="rounded-lg border bg-muted/20 p-4 space-y-3">
        <HiddenSubject studySubjectId={studySubjectId} />
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1">
            <Label className="text-xs">Start Date</Label>
            <Input name="note_date" type="date" defaultValue={new Date().toISOString().slice(0, 10)} />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Note type</Label>
            <Input name="note_type" placeholder="SOAP, HPI, ROS, assessment..." />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Category</Label>
            <Input name="category" placeholder="Transportation issue, retention concern..." />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Chief complaint</Label>
            <Input name="chief_complaint" />
          </div>
          <div className="sm:col-span-2 space-y-1">
            <Label className="text-xs">Note *</Label>
            <Textarea name="note" rows={3} required />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Assessment</Label>
            <Textarea name="assessment" rows={2} />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Plan</Label>
            <Textarea name="plan" rows={2} />
          </div>
          <label className="flex items-center gap-2 text-sm">
            <input name="follow_up_needed" type="checkbox" />
            Follow-up action required
          </label>
          <div className="space-y-1">
            <Label className="text-xs">Follow-up owner</Label>
            <Input name="follow_up_owner" placeholder="CRC, PI, SI..." />
          </div>
        </div>
        <Status {...state} />
        <Button size="sm" disabled={pending}><Plus className="mr-1 h-3.5 w-3.5" />Add note</Button>
      </form>
      <div className="space-y-2">
        {model.notes.map((note) => (
          <div key={note.note_id} className="rounded-md border px-3 py-2 text-sm">
            <div className="flex justify-between gap-3">
              <p className="font-medium">{note.category}</p>
              <span className="text-xs text-muted-foreground">{note.note_date}</span>
            </div>
            <p className="mt-1 text-muted-foreground">{note.note}</p>
            {note.follow_up_needed ? (
              <p className="mt-1 text-xs text-amber-700">Follow-up: {note.follow_up_owner ?? 'Owner not set'}</p>
            ) : null}
          </div>
        ))}
        {!model.notes.length ? <p className="text-sm text-muted-foreground italic">No subject progress notes.</p> : null}
      </div>
    </div>
  )
}

export function SubjectStatusHistorySection({ studySubjectId, model }: SectionProps) {
  const [state, action, pending] = useActionState(addSubjectStatusHistory, INITIAL_SUBJECT_ACTION_STATE)
  const [editState, editAction, editPending] = useActionState(updateSubjectStatusHistory, INITIAL_SUBJECT_ACTION_STATE)
  const current = model.statusHistory.find((row) => row.ongoing) ?? model.statusHistory[0]
  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-lg font-semibold">Subject Status History</h2>
        <p className="text-sm text-muted-foreground">
          Current status: {current ? `${current.status} since ${current.start_date}` : 'Not recorded'}
        </p>
      </div>
      <form action={action} className="rounded-lg border bg-muted/20 p-4 space-y-3">
        <HiddenSubject studySubjectId={studySubjectId} />
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1">
            <Label className="text-xs">Status *</Label>
            <Select name="status" required>
              <SelectTrigger><SelectValue placeholder="Select status" /></SelectTrigger>
              <SelectContent>
                {['Screening', 'Screen Failure', 'Enrolled', 'Randomized', 'Active Treatment', 'Follow-Up', 'Withdrawn', 'Lost To Follow-Up', 'Early Termination', 'Completed'].map((status) => (
                  <SelectItem key={status} value={status}>{status}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <InputBlock name="start_date" label="Start Date *" type="date" required />
          <InputBlock name="stop_date" label="Stop Date" type="date" />
          <label className="flex items-center gap-2 text-sm">
            <input name="ongoing" type="checkbox" defaultChecked />
            Ongoing
          </label>
          <InputBlock name="reason" label="Reason" />
          <div className="sm:col-span-2"><TextareaBlock name="notes" label="Notes" /></div>
        </div>
        <Status {...state} />
        <Button size="sm" disabled={pending}>Add status</Button>
      </form>
      <div className="space-y-2">
        {model.statusHistory.map((row) => (
          <form key={row.status_id} action={editAction} className="rounded-md border px-3 py-2 text-sm">
            <HiddenSubject studySubjectId={studySubjectId} />
            <input type="hidden" name="status_id" value={row.status_id} />
            <div className="grid gap-2 sm:grid-cols-3">
              <Input name="status" defaultValue={row.status} aria-label="Status" />
              <Input name="start_date" type="date" defaultValue={row.start_date} aria-label="Start Date" />
              <Input name="stop_date" type="date" defaultValue={row.stop_date ?? ''} aria-label="Stop Date" />
              <label className="flex items-center gap-2 text-sm">
                <input name="ongoing" type="checkbox" defaultChecked={row.ongoing} />
                Ongoing
              </label>
              <Input name="reason" defaultValue={row.reason ?? ''} aria-label="Reason" />
              <Input name="notes" defaultValue={row.notes ?? ''} aria-label="Notes" />
            </div>
            <Button className="mt-2" size="sm" variant="outline" disabled={editPending}>Save edit</Button>
          </form>
        ))}
        <Status {...editState} />
        {!model.statusHistory.length ? <p className="text-sm text-muted-foreground italic">No subject status history.</p> : null}
      </div>
    </div>
  )
}

export function SubjectDocumentsSection({ studySubjectId, model }: SectionProps) {
  const [uploadState, uploadAction, uploadPending] = useActionState(uploadSubjectDocumentAction, INITIAL_SUBJECT_ACTION_STATE)
  const [assignState, assignAction, assignPending] = useActionState(assignComplianceDocumentToSubject, INITIAL_SUBJECT_ACTION_STATE)
  const [requestState, requestAction, requestPending] = useActionState(requestSubjectDocumentReview, INITIAL_SUBJECT_ACTION_STATE)
  const [completeState, completeAction, completePending] = useActionState(completeSubjectDocumentRequest, INITIAL_SUBJECT_ACTION_STATE)
  const [transitionState, transitionAction, transitionPending] = useActionState(transitionSubjectDocumentRequest, INITIAL_SUBJECT_ACTION_STATE)

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-lg font-semibold">eDocs, Labs & Miscellaneous</h2>
        <p className="text-sm text-muted-foreground">Upload, assign, categorize, link to visits, and request review or signature.</p>
      </div>

      <form action={uploadAction} className="rounded-lg border bg-muted/20 p-4 space-y-3">
        <HiddenSubject studySubjectId={studySubjectId} />
        <h3 className="text-sm font-medium">Upload document to subject</h3>
        <div className="grid gap-3 sm:grid-cols-2">
          <CategorySelect />
          <VisitSelect model={model} />
          <div className="space-y-1">
            <Label className="text-xs">File *</Label>
            <Input name="file" type="file" accept="application/pdf,image/jpeg,image/png" required />
          </div>
          <InputBlock name="document_date" label="Document Date" type="date" />
          <div className="space-y-1">
            <Label className="text-xs">Notes</Label>
            <Input name="notes" />
          </div>
        </div>
        <Status {...uploadState} />
        <Button size="sm" disabled={uploadPending}><Upload className="mr-1 h-3.5 w-3.5" />Upload</Button>
      </form>

      <form action={assignAction} className="rounded-lg border bg-muted/20 p-4 space-y-3">
        <HiddenSubject studySubjectId={studySubjectId} />
        <h3 className="text-sm font-medium">Assign already-ingested document</h3>
        <div className="grid gap-3 sm:grid-cols-2">
          <CategorySelect />
          <VisitSelect model={model} />
          <div className="space-y-1">
            <Label className="text-xs">Ingested document id *</Label>
            <Input name="compliance_document_id" required />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Display name</Label>
            <Input name="file_name" placeholder="External lab report" />
          </div>
        </div>
        <Status {...assignState} />
        <Button size="sm" variant="outline" disabled={assignPending}>Assign document</Button>
      </form>

      <form action={requestAction} className="rounded-lg border bg-muted/20 p-4 space-y-3">
        <HiddenSubject studySubjectId={studySubjectId} />
        <h3 className="text-sm font-medium">Request document review or signature</h3>
        <div className="grid gap-3 sm:grid-cols-2">
          <DocumentSelect model={model} />
          <UserSelect model={model} name="requested_to" label="Reviewer / signer *" />
          <div className="space-y-1">
            <Label className="text-xs">Request type</Label>
            <Select name="request_type" defaultValue="Review">
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="Review">Review</SelectItem>
                <SelectItem value="Signature">Signature</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Required role</Label>
            <Input name="required_role" placeholder="pi, si, crc..." />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Due date</Label>
            <Input name="due_date" type="date" />
          </div>
          <div className="sm:col-span-2 space-y-1">
            <Label className="text-xs">Message</Label>
            <Textarea name="message" rows={2} />
          </div>
        </div>
        <Status {...requestState} />
        <Button size="sm" disabled={requestPending}>Request</Button>
      </form>

      <div className="space-y-2">
        {model.documents.map((doc) => (
          <div key={doc.document_id} className="rounded-md border px-3 py-2 text-sm">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div>
                <p className="font-medium">{doc.file_name}</p>
                <p className="text-xs text-muted-foreground">{doc.document_category} · {doc.status}</p>
              </div>
              <div className="flex gap-2">
                {doc.previewUrl ? <a className="text-xs underline" href={doc.previewUrl} target="_blank">Preview</a> : null}
                {doc.downloadUrl ? <a className="text-xs underline" href={doc.downloadUrl}>Download</a> : null}
              </div>
            </div>
          </div>
        ))}
        {!model.documents.length ? <p className="text-sm text-muted-foreground italic">No subject documents.</p> : null}
      </div>

      {model.reviewRequests.length ? (
        <div className="space-y-2">
          <h3 className="text-sm font-medium">Review / signature requests</h3>
          {model.reviewRequests.map((request) => (
            <ReviewRequestItem 
              key={request.request_id} 
              request={request} 
              studySubjectId={studySubjectId} 
              completeAction={completeAction} 
              completePending={completePending} 
              transitionAction={transitionAction} 
              transitionPending={transitionPending} 
            />
          ))}
          <Status {...completeState} />
          <Status {...transitionState} />
        </div>
      ) : null}
    </div>
  )
}

export function SubjectSignaturesSection({ studySubjectId, model }: SectionProps) {
  const [requestState, requestAction, requestPending] = useActionState(requestSubjectSignature, INITIAL_SUBJECT_ACTION_STATE)
  const [completeState, completeAction, completePending] = useActionState(completeSubjectSignature, INITIAL_SUBJECT_ACTION_STATE)
  const [transitionState, transitionAction, transitionPending] = useActionState(transitionSubjectSignatureRequest, INITIAL_SUBJECT_ACTION_STATE)
  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-lg font-semibold">Subject-Level Signatures</h2>
        <p className="text-sm text-muted-foreground">Track subject-level attestations, separate from visit signatures.</p>
      </div>
      <form action={requestAction} className="rounded-lg border bg-muted/20 p-4 space-y-3">
        <HiddenSubject studySubjectId={studySubjectId} />
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1">
            <Label className="text-xs">Signature type *</Label>
            <Input name="signature_type" placeholder="PI review of AE" required />
          </div>
          <UserSelect model={model} name="requested_to" label="Requested to *" />
          <InputBlock name="required_role" label="Required role" placeholder="pi, si, crc..." />
          <div className="space-y-1">
            <Label className="text-xs">Related section *</Label>
            <Input name="related_section" placeholder="Adverse Events" required />
          </div>
          <DocumentSelect model={model} optional />
          <div className="sm:col-span-2 space-y-1">
            <Label className="text-xs">Signature meaning / attestation *</Label>
            <Textarea name="attestation_text" rows={2} required />
          </div>
        </div>
        <Status {...requestState} />
        <Button size="sm" disabled={requestPending}><PenLine className="mr-1 h-3.5 w-3.5" />Request signature</Button>
      </form>
      <div className="space-y-2">
        {model.signatures.map((sig) => (
          <div key={sig.signature_id} className="rounded-md border px-3 py-2 text-sm space-y-2">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <p className="font-medium">{sig.signature_type}</p>
                <p className="text-xs text-muted-foreground">{sig.related_section} · {sig.status}</p>
              </div>
              {sig.status !== 'Signed' ? (
                <form action={completeAction}>
                  <HiddenSubject studySubjectId={studySubjectId} />
                  <input type="hidden" name="request_id" value={sig.request_id} />
                  <Button size="sm" variant="outline" disabled={completePending}><ShieldCheck className="mr-1 h-3.5 w-3.5" />Sign</Button>
                </form>
              ) : null}
            </div>
            {sig.status !== 'Signed' ? (
              <form action={transitionAction} className="grid gap-2 sm:grid-cols-[1fr_auto_auto]">
                <HiddenSubject studySubjectId={studySubjectId} />
                <input type="hidden" name="request_id" value={sig.request_id} />
                <Input name="reason" placeholder="Reason required for reject/rescind" />
                <Button name="status" value="Rejected" size="sm" variant="outline" disabled={transitionPending}>Reject</Button>
                <Button name="status" value="Rescinded" size="sm" variant="outline" disabled={transitionPending}>Rescind</Button>
              </form>
            ) : null}
          </div>
        ))}
        <Status {...completeState} />
        <Status {...transitionState} />
        {!model.signatures.length ? <p className="text-sm text-muted-foreground italic">No subject-level signatures.</p> : null}
      </div>
    </div>
  )
}

export function SubjectProtocolDeviationsSection({ studySubjectId, model }: SectionProps) {
  const [state, action, pending] = useActionState(addSubjectProtocolDeviation, INITIAL_SUBJECT_ACTION_STATE)
  const [editState, editAction, editPending] = useActionState(updateSubjectProtocolDeviation, INITIAL_SUBJECT_ACTION_STATE)
  const [closeState, closeAction, closePending] = useActionState(closeSubjectProtocolDeviation, INITIAL_SUBJECT_ACTION_STATE)
  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-lg font-semibold">Protocol Deviations</h2>
        <p className="text-sm text-muted-foreground">Confirmed protocol deviations only.</p>
      </div>
        <form action={action} className="rounded-lg border bg-muted/20 p-4 space-y-3">
          <HiddenSubject studySubjectId={studySubjectId} />
          <div className="grid gap-3 sm:grid-cols-2">
            <InputBlock name="deviation_date" label="Date *" type="date" required />
            <InputBlock name="start_date" label="Start Date" type="date" />
            <InputBlock name="stop_date" label="Stop Date" type="date" />
            <InputBlock name="resolution_date" label="Resolution date" type="date" />
            <label className="flex items-center gap-2 text-sm">
              <input name="ongoing" type="checkbox" defaultChecked />
              Ongoing
            </label>
            <InputBlock name="category" label="Category" />
            <InputBlock name="severity" label="Severity" placeholder="Minor, major, critical" />
            <div className="sm:col-span-2"><TextareaBlock name="description" label="Deviation description *" required /></div>
            <TextareaBlock name="root_cause" label="Root cause" />
            <InputBlock name="root_cause_category" label="Root cause category" />
            <TextareaBlock name="capa" label="CAPA" />
            <TextareaBlock name="corrective_action" label="Corrective action" />
            <TextareaBlock name="preventive_action" label="Preventive action" />
            <InputBlock name="capa_due_date" label="CAPA due date" type="date" />
            <InputBlock name="capa_completion_date" label="CAPA completion date" type="date" />
            <InputBlock name="capa_effectiveness_check_date" label="CAPA effectiveness check date" type="date" />
            <InputBlock name="status" label="Status" placeholder="Open, Resolved, Closed" />
          </div>
          <Status {...state} />
          <Button size="sm" disabled={pending}>Add confirmed deviation</Button>
        </form>
      <div className="space-y-3">
        {model.deviations.map((d) => (
          <div key={d.deviation_id} className="rounded-md border px-3 py-2 text-sm space-y-3">
            <p className="font-medium">{d.description}</p>
            <p className="text-xs text-muted-foreground">
              {[d.start_date ?? d.deviation_date, d.stop_date ? `Stop ${d.stop_date}` : d.ongoing ? 'Ongoing' : null, d.category, d.severity, d.status].filter(Boolean).join(' · ')}
            </p>
            <form action={editAction} className="grid gap-2 sm:grid-cols-2">
              <HiddenSubject studySubjectId={studySubjectId} />
              <input type="hidden" name="deviation_id" value={d.deviation_id} />
              <InputBlock name="deviation_date" label="Date *" type="date" required />
              <InputBlock name="start_date" label="Start Date" type="date" />
              <InputBlock name="stop_date" label="Stop Date" type="date" />
              <InputBlock name="resolution_date" label="Resolution date" type="date" />
              <label className="flex items-center gap-2 text-sm"><input name="ongoing" type="checkbox" defaultChecked={d.ongoing} />Ongoing</label>
              <InputBlock name="status" label="Status" placeholder={d.status} />
              <div className="sm:col-span-2"><TextareaBlock name="description" label="Description *" required /></div>
              <TextareaBlock name="root_cause" label="Root cause" />
              <TextareaBlock name="capa" label="CAPA" />
              <TextareaBlock name="corrective_action" label="Corrective action" />
              <TextareaBlock name="preventive_action" label="Preventive action" />
              <InputBlock name="capa_completion_date" label="CAPA completion date" type="date" />
              <Button className="sm:col-span-2 w-fit" size="sm" variant="outline" disabled={editPending}>Save update</Button>
            </form>
            <form action={closeAction} className="grid gap-2 sm:grid-cols-[1fr_1fr_1fr_auto]">
              <HiddenSubject studySubjectId={studySubjectId} />
              <input type="hidden" name="deviation_id" value={d.deviation_id} />
              <Input name="closure_date" type="date" aria-label="Closure date" />
              <Input name="capa_completion_date" type="date" aria-label="CAPA completion date" />
              <Input name="closure_note" placeholder="Closure note required" />
              <Button size="sm" variant="outline" disabled={closePending}>Close</Button>
            </form>
            <div className="rounded bg-muted/30 p-2">
              <p className="text-xs font-medium">History</p>
              {model.deviationHistory.filter((event) => event.record_id === d.deviation_id).map((event) => (
                <p key={event.event_id} className="text-xs text-muted-foreground">
                  {event.event_type} · {event.actor_id?.slice(0, 8) ?? 'system'} · {new Date(event.occurred_at).toLocaleString()}
                </p>
              ))}
            </div>
          </div>
        ))}
        <Status {...editState} />
        <Status {...closeState} />
        {!model.deviations.length ? <p className="text-sm text-muted-foreground italic">No confirmed protocol deviations.</p> : null}
      </div>
    </div>
  )
}

export function SubjectEmergencyContactsSection({ studySubjectId, model }: SectionProps) {
  const [state, action, pending] = useActionState(addSubjectEmergencyContact, INITIAL_SUBJECT_ACTION_STATE)
  const [editState, editAction, editPending] = useActionState(updateSubjectEmergencyContact, INITIAL_SUBJECT_ACTION_STATE)
  const [archiveState, archiveAction, archivePending] = useActionState(archiveSubjectEmergencyContact, INITIAL_SUBJECT_ACTION_STATE)
  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-lg font-semibold">Emergency Contacts</h2>
        <p className="text-sm text-muted-foreground">Subject emergency contact information.</p>
      </div>
        <form action={action} className="rounded-lg border bg-muted/20 p-4 space-y-3">
          <HiddenSubject studySubjectId={studySubjectId} />
          <div className="grid gap-3 sm:grid-cols-2">
            <InputBlock name="name" label="Name *" required />
            <InputBlock name="relationship" label="Relationship" />
            <InputBlock name="phone" label="Phone" />
            <InputBlock name="email" label="Email" type="email" />
            <InputBlock name="address" label="Address optional" />
            <InputBlock name="preferred_method" label="Preferred Contact Method" placeholder="Phone, email, text" />
            <InputBlock name="availability" label="Availability" placeholder="Always, weekdays..." />
            <InputBlock name="language" label="Language" />
            <label className="flex items-center gap-2 text-sm">
              <input name="primary_contact" type="checkbox" />
              Primary Contact
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input name="privacy_consent" type="checkbox" />
              Privacy Consent
            </label>
            <div className="sm:col-span-2"><TextareaBlock name="notes" label="Notes" /></div>
          </div>
          <Status {...state} />
          <Button size="sm" disabled={pending}><Phone className="mr-1 h-3.5 w-3.5" />Add contact</Button>
        </form>
      <div className="space-y-2">
        {model.emergencyContacts.map((c) => (
          <div key={c.contact_id} className="rounded-md border px-3 py-2 text-sm space-y-2">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <p className="font-medium">{c.name}{c.primary_contact ? ' · Primary' : ''}</p>
                <p className="text-xs text-muted-foreground">
                  {[c.relationship, c.phone, c.email, c.preferred_method, c.availability, c.privacy_consent ? 'Privacy consent' : null].filter(Boolean).join(' · ')}
                </p>
              </div>
            </div>
            <form action={editAction} className="grid gap-2 sm:grid-cols-3">
              <HiddenSubject studySubjectId={studySubjectId} />
              <input type="hidden" name="contact_id" value={c.contact_id} />
              <Input name="name" defaultValue={c.name} aria-label="Name" />
              <Input name="relationship" defaultValue={c.relationship ?? ''} aria-label="Relationship" />
              <Input name="phone" defaultValue={c.phone ?? ''} aria-label="Phone" />
              <Input name="email" defaultValue={c.email ?? ''} aria-label="Email" />
              <Input name="address" defaultValue={c.address ?? ''} aria-label="Address" />
              <Input name="preferred_method" defaultValue={c.preferred_method ?? ''} aria-label="Preferred method" />
              <Input name="availability" defaultValue={c.availability ?? ''} aria-label="Availability" />
              <Input name="language" defaultValue={c.language ?? ''} aria-label="Language" />
              <Input name="notes" defaultValue={c.notes ?? ''} aria-label="Notes" />
              <label className="flex items-center gap-2 text-sm"><input name="primary_contact" type="checkbox" defaultChecked={c.primary_contact} />Primary Contact</label>
              <label className="flex items-center gap-2 text-sm"><input name="privacy_consent" type="checkbox" defaultChecked={c.privacy_consent} />Privacy Consent</label>
              <Button className="w-fit" size="sm" variant="outline" disabled={editPending}>Save edit</Button>
            </form>
            <form action={archiveAction}>
              <HiddenSubject studySubjectId={studySubjectId} />
              <input type="hidden" name="contact_id" value={c.contact_id} />
              <Button size="sm" variant="outline" disabled={archivePending}>Archive</Button>
            </form>
          </div>
        ))}
        <Status {...editState} />
        <Status {...archiveState} />
        {!model.emergencyContacts.length ? <p className="text-sm text-muted-foreground italic">No emergency contacts.</p> : null}
      </div>
    </div>
  )
}

function CategorySelect() {
  return (
    <div className="space-y-1">
      <Label className="text-xs">Document category *</Label>
      <Select name="document_category" required>
        <SelectTrigger><SelectValue placeholder="Select category" /></SelectTrigger>
        <SelectContent>
          {SUBJECT_DOCUMENT_CATEGORIES.map((category) => (
            <SelectItem key={category} value={category}>{category}</SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  )
}

function VisitSelect({ model }: { model: SubjectSourceTemplateModel }) {
  return (
    <div className="space-y-1">
      <Label className="text-xs">Linked visit optional</Label>
      <Select name="visit_id">
        <SelectTrigger><SelectValue placeholder="None" /></SelectTrigger>
        <SelectContent>
          {model.visitOptions.map((visit) => (
            <SelectItem key={visit.id} value={visit.id}>{visit.label}</SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  )
}

function DocumentSelect({ model, optional = false }: { model: SubjectSourceTemplateModel; optional?: boolean }) {
  return (
    <div className="space-y-1">
      <Label className="text-xs">{optional ? 'Related document optional' : 'Document *'}</Label>
      <Select name={optional ? 'related_document_id' : 'document_id'} required={!optional}>
        <SelectTrigger><SelectValue placeholder={optional ? 'None' : 'Select document'} /></SelectTrigger>
        <SelectContent>
          {model.documents.map((doc) => (
            <SelectItem key={doc.document_id} value={doc.document_id}>{doc.file_name}</SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  )
}

function UserSelect({ model, name, label }: { model: SubjectSourceTemplateModel; name: string; label: string }) {
  return (
    <div className="space-y-1">
      <Label className="text-xs">{label}</Label>
      <Select name={name} required>
        <SelectTrigger><SelectValue placeholder="Select user" /></SelectTrigger>
        <SelectContent>
          {model.userOptions.map((user) => (
            <SelectItem key={user.id} value={user.id}>{user.label}</SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  )
}

function InputBlock(props: { name: string; label: string; type?: string; placeholder?: string; required?: boolean }) {
  return (
    <div className="space-y-1">
      <Label className="text-xs">{props.label}</Label>
      <Input name={props.name} type={props.type} placeholder={props.placeholder} required={props.required} />
    </div>
  )
}

function TextareaBlock(props: { name: string; label: string; required?: boolean }) {
  return (
    <div className="space-y-1">
      <Label className="text-xs">{props.label}</Label>
      <Textarea name={props.name} rows={2} required={props.required} />
    </div>
  )
}

type ReviewRequestItemProps = {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  request: any
  completeAction: (payload: FormData) => void
  completePending: boolean
  transitionAction: (payload: FormData) => void
  transitionPending: boolean
  studySubjectId: string
}

function ReviewRequestItem({ request, completeAction, completePending, transitionAction, transitionPending, studySubjectId }: ReviewRequestItemProps) {
  const [showSignature, setShowSignature] = useState(false)
  const formRef = useRef<HTMLFormElement>(null)

  const isLegacy = !request.signature_request_id
  const isCompleted = request.status === 'Reviewed' || request.status === 'Signed' || request.status === 'Rejected' || request.status === 'Rescinded'

  return (
    <div className="rounded-md border px-3 py-2 text-sm space-y-2">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span>{request.request_type} · {request.status}</span>
        
        {!isCompleted ? (
           isLegacy ? (
            <form action={completeAction}>
              <HiddenSubject studySubjectId={studySubjectId} />
              <input type="hidden" name="request_id" value={request.request_id} />
              <input type="hidden" name="status" value="Reviewed" />
              <Button size="sm" variant="outline" disabled={completePending}>Legacy Mark Reviewed</Button>
            </form>
           ) : (
             <Button size="sm" variant="outline" onClick={() => setShowSignature(!showSignature)}>
               {showSignature ? 'Cancel' : 'Sign & Review'}
             </Button>
           )
        ) : null}
      </div>

      {showSignature && !isLegacy && !isCompleted && (
         <div className="mt-2">
           <ElectronicSignaturePanel
             requestId={request.signature_request_id}
             signatureMeaning="PI reviewed subject document"
             attestationText="I reviewed this subject document."
             requiredRole="pi"
             status="pending"
             onSigned={() => {
               formRef.current?.requestSubmit()
             }}
           />
           <form ref={formRef} action={completeAction} className="hidden">
              <HiddenSubject studySubjectId={studySubjectId} />
              <input type="hidden" name="request_id" value={request.request_id} />
              <input type="hidden" name="status" value="Reviewed" />
           </form>
         </div>
      )}

      {!isCompleted && (
        <form action={transitionAction} className="grid gap-2 sm:grid-cols-[1fr_1fr_auto_auto] mt-2">
          <HiddenSubject studySubjectId={studySubjectId} />
          <input type="hidden" name="request_id" value={request.request_id} />
          <Input name="reason" placeholder="Reason required for reject/rescind" />
          <label className="flex items-center gap-2 text-xs">
            <input name="notify_requester" type="checkbox" />
            Notify requester
          </label>
          <Button name="status" value="Rejected" size="sm" variant="outline" disabled={transitionPending}>Reject</Button>
          <Button name="status" value="Rescinded" size="sm" variant="outline" disabled={transitionPending}>Rescind</Button>
        </form>
      )}
    </div>
  )
}

