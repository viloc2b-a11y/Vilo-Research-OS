import type { RecruitmentLeadSummary } from '@/lib/crm/recruitment-loaders'
import type { ScoreTier } from '@/app/(ops)/recruitment/_lib/recruitment-view-model'
import {
  submitRecruitmentContactAttempt,
  submitRecruitmentFollowUp,
  submitRecruitmentLeadConversion,
  submitRecruitmentQualify,
  submitRecruitmentStudyAssignment,
} from '@/app/(ops)/recruitment/actions'

const STAGE_CLASS: Record<string, string> = {
  lead: 'border-slate-200 bg-slate-50 text-slate-600',
  contacted: 'border-blue-200 bg-blue-50 text-blue-700',
  pre_screen: 'border-violet-200 bg-violet-50 text-violet-700',
  qualified: 'border-emerald-200 bg-emerald-50 text-emerald-700',
  scheduled: 'border-amber-200 bg-amber-50 text-amber-700',
  randomized: 'border-teal-200 bg-teal-50 text-teal-700',
}

const TIER_CLASS: Record<ScoreTier, string> = {
  high: 'border-red-200 bg-red-50 text-red-700',
  medium: 'border-amber-200 bg-amber-50 text-amber-700',
  waitlist: 'border-slate-200 bg-slate-50 text-slate-600',
}

export function LeadCard({
  lead,
  organizationId,
  tier,
  compact = false,
  canInteract = false,
}: {
  lead: RecruitmentLeadSummary
  organizationId: string
  tier?: ScoreTier
  compact?: boolean
  canInteract?: boolean
}) {
  return (
    <article className="rounded-md border border-slate-200 bg-white p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold text-slate-900">{lead.full_name}</h3>
          <p className="mt-1 text-xs text-slate-500">
            {lead.email ?? 'No email'} · {lead.phone || 'No phone'}
          </p>
        </div>
        <div className="flex flex-wrap justify-end gap-2">
          {tier ? (
            <span className={`rounded-full border px-2 py-0.5 text-xs font-semibold capitalize ${TIER_CLASS[tier]}`}>
              {tier}
            </span>
          ) : null}
          <span className={`rounded-full border px-2 py-0.5 text-xs font-semibold ${STAGE_CLASS[lead.stage] ?? STAGE_CLASS.lead}`}>
            {lead.stage.replaceAll('_', ' ')}
          </span>
        </div>
      </div>

      <dl className={`mt-4 grid gap-3 text-sm ${compact ? 'grid-cols-2' : 'md:grid-cols-3'}`}>
        <Field label="Score" value={lead.prescreen_score?.toString() ?? 'Not scored'} />
        <Field label="Campaign" value={lead.campaign_id ?? 'Unattributed'} />
        <Field label="Source" value={lead.recruitment_source_channel ?? 'Unknown'} />
        <Field label="Assigned user" value={lead.assigned_user_id ?? 'Unassigned'} />
        <Field label="Last contact" value={formatDateTime(lead.last_contacted_at)} />
        <Field label="Attempts" value={lead.contact_attempts.toString()} />
      </dl>

      {canInteract ? <LeadInteractionPanel lead={lead} organizationId={organizationId} /> : null}
    </article>
  )
}

function LeadInteractionPanel({
  lead,
  organizationId,
}: {
  lead: RecruitmentLeadSummary
  organizationId: string
}) {
  return (
    <details className="mt-4 rounded-md border border-teal-100 bg-teal-50/40 p-3">
      <summary className="cursor-pointer text-sm font-semibold text-teal-900">
        Coordinator actions
      </summary>
      <div className="mt-4 grid gap-4 xl:grid-cols-2">
        <ContactAttemptForm leadId={lead.id} organizationId={organizationId} />
        <FollowUpForm leadId={lead.id} organizationId={organizationId} />
        <QualifyForm lead={lead} organizationId={organizationId} />
        <AssignStudyForm leadId={lead.id} organizationId={organizationId} />
        <ConvertLeadForm leadId={lead.id} organizationId={organizationId} />
      </div>
    </details>
  )
}

function HiddenLeadInputs({ leadId, organizationId }: { leadId: string; organizationId: string }) {
  return (
    <>
      <input type="hidden" name="leadId" value={leadId} />
      <input type="hidden" name="organizationId" value={organizationId} />
    </>
  )
}

function ContactAttemptForm({ leadId, organizationId }: { leadId: string; organizationId: string }) {
  return (
    <form action={submitRecruitmentContactAttempt} className="space-y-3 rounded-md border border-slate-200 bg-white p-3">
      <HiddenLeadInputs leadId={leadId} organizationId={organizationId} />
      <h4 className="text-xs font-semibold uppercase tracking-wide text-slate-600">Contact attempt</h4>
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="space-y-1 text-xs font-medium text-slate-600">
          Type
          <select name="attemptType" required defaultValue="call" className="h-9 w-full rounded-md border border-slate-300 bg-white px-2 text-sm">
            <option value="call">Call</option>
            <option value="sms">SMS</option>
            <option value="email">Email</option>
          </select>
        </label>
        <label className="space-y-1 text-xs font-medium text-slate-600">
          Outcome
          <select name="outcome" required defaultValue="" className="h-9 w-full rounded-md border border-slate-300 bg-white px-2 text-sm">
            <option value="" disabled>Select outcome</option>
            <option value="reached">Reached</option>
            <option value="no_answer">No answer</option>
            <option value="voicemail">Voicemail</option>
            <option value="wrong_number">Wrong number</option>
            <option value="opted_out">Opted out</option>
            <option value="rescheduled">Rescheduled</option>
            <option value="other">Other</option>
          </select>
        </label>
      </div>
      <label className="space-y-1 text-xs font-medium text-slate-600">
        Notes
        <textarea name="notes" className="min-h-16 w-full rounded-md border border-slate-300 px-2 py-2 text-sm" />
      </label>
      <button type="submit" className="rounded-md bg-teal-700 px-3 py-2 text-sm font-semibold text-white hover:bg-teal-800">
        Log contact
      </button>
    </form>
  )
}

function FollowUpForm({ leadId, organizationId }: { leadId: string; organizationId: string }) {
  return (
    <form action={submitRecruitmentFollowUp} className="space-y-3 rounded-md border border-slate-200 bg-white p-3">
      <HiddenLeadInputs leadId={leadId} organizationId={organizationId} />
      <h4 className="text-xs font-semibold uppercase tracking-wide text-slate-600">Schedule follow-up</h4>
      <label className="space-y-1 text-xs font-medium text-slate-600">
        Follow-up date/time
        <input name="nextFollowUpAt" type="datetime-local" required className="h-9 w-full rounded-md border border-slate-300 px-2 text-sm" />
      </label>
      <button type="submit" className="rounded-md bg-slate-900 px-3 py-2 text-sm font-semibold text-white hover:bg-slate-800">
        Schedule
      </button>
    </form>
  )
}

function QualifyForm({ lead, organizationId }: { lead: RecruitmentLeadSummary; organizationId: string }) {
  const canQualify = lead.stage === 'pre_screen'
  return (
    <form action={submitRecruitmentQualify} className="space-y-3 rounded-md border border-slate-200 bg-white p-3">
      <HiddenLeadInputs leadId={lead.id} organizationId={organizationId} />
      <h4 className="text-xs font-semibold uppercase tracking-wide text-slate-600">Qualify lead</h4>
      <p className="text-xs text-slate-500">Allowed transition: pre_screen → qualified.</p>
      <label className="space-y-1 text-xs font-medium text-slate-600">
        Optional next follow-up
        <input name="nextFollowUpAt" type="datetime-local" className="h-9 w-full rounded-md border border-slate-300 px-2 text-sm" />
      </label>
      <button
        type="submit"
        disabled={!canQualify}
        className="rounded-md bg-emerald-700 px-3 py-2 text-sm font-semibold text-white hover:bg-emerald-800 disabled:cursor-not-allowed disabled:bg-slate-300"
      >
        Qualify
      </button>
    </form>
  )
}

function AssignStudyForm({ leadId, organizationId }: { leadId: string; organizationId: string }) {
  return (
    <form action={submitRecruitmentStudyAssignment} className="space-y-3 rounded-md border border-slate-200 bg-white p-3">
      <HiddenLeadInputs leadId={leadId} organizationId={organizationId} />
      <h4 className="text-xs font-semibold uppercase tracking-wide text-slate-600">Assign study</h4>
      <label className="space-y-1 text-xs font-medium text-slate-600">
        Study UUID
        <input name="studyId" required className="h-9 w-full rounded-md border border-slate-300 px-2 text-sm font-mono" placeholder="study UUID" />
      </label>
      <label className="flex items-center gap-2 text-xs font-medium text-slate-600">
        <input name="markPrimary" type="checkbox" className="h-4 w-4 rounded border-slate-300" />
        Mark as primary match
      </label>
      <button type="submit" className="rounded-md bg-slate-900 px-3 py-2 text-sm font-semibold text-white hover:bg-slate-800">
        Assign study
      </button>
    </form>
  )
}

function ConvertLeadForm({ leadId, organizationId }: { leadId: string; organizationId: string }) {
  return (
    <form action={submitRecruitmentLeadConversion} className="space-y-3 rounded-md border border-slate-200 bg-white p-3 xl:col-span-2">
      <HiddenLeadInputs leadId={leadId} organizationId={organizationId} />
      <h4 className="text-xs font-semibold uppercase tracking-wide text-slate-600">Convert to subject</h4>
      <p className="text-xs text-slate-500">
        Uses the existing lead-to-subject link flow so the patient lead attribution chain remains attached.
      </p>
      <label className="space-y-1 text-xs font-medium text-slate-600">
        Study subject UUID
        <input name="studySubjectId" required className="h-9 w-full rounded-md border border-slate-300 px-2 text-sm font-mono" placeholder="study_subjects.id" />
      </label>
      <button type="submit" className="rounded-md bg-teal-700 px-3 py-2 text-sm font-semibold text-white hover:bg-teal-800">
        Convert lead
      </button>
    </form>
  )
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">{label}</dt>
      <dd className="mt-1 truncate text-slate-800" title={value}>{value}</dd>
    </div>
  )
}

function formatDateTime(value: string | null): string {
  if (!value) return 'Never'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return 'Unknown'
  return date.toLocaleString()
}
