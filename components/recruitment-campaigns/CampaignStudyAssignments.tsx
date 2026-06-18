import type { CampaignDetail } from '@/lib/crm/campaign-management'
import { linkStudyToCampaign, unlinkStudyFromCampaign } from '@/app/(ops)/recruitment/campaigns/actions'

type CampaignStudyAssignmentsProps = {
  detail: CampaignDetail
  canManage: boolean
  organizationId: string
  availableStudies?: { id: string; name: string }[]
}

export function CampaignStudyAssignments({
  detail,
  canManage,
  availableStudies,
}: CampaignStudyAssignmentsProps) {
  return (
    <section>
      <h2 className="mb-3 text-sm font-semibold text-slate-900">Linked Studies</h2>

      {detail.linked_studies.length === 0 ? (
        <p className="text-sm text-slate-500">No studies linked to this campaign.</p>
      ) : (
        <div className="rounded-md border border-slate-200 bg-white divide-y divide-slate-100">
          {detail.linked_studies.map((study) => (
            <div key={study.study_id} className="flex items-center justify-between px-4 py-3">
              <div>
                <p className="text-sm font-medium text-slate-900">{study.study_name}</p>
                <p className="text-xs text-slate-500">
                  Target leads: {study.target_leads ?? '—'} &middot; Target enrollments:{' '}
                  {study.target_enrollments ?? '—'}
                </p>
              </div>
              {canManage && (
                <form action={unlinkStudyFromCampaign}>
                  <input type="hidden" name="campaignId" value={detail.id} />
                  <input type="hidden" name="studyId" value={study.study_id} />
                  <button
                    type="submit"
                    className="text-xs text-red-600 hover:text-red-800 hover:underline"
                  >
                    Unlink
                  </button>
                </form>
              )}
            </div>
          ))}
        </div>
      )}

      {canManage && (
        <div className="mt-4">
          <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
            Link a Study
          </h3>
          <form action={linkStudyToCampaign} className="flex items-center gap-2">
            <input type="hidden" name="campaignId" value={detail.id} />
            <select
              name="studyId"
              className="flex-1 rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-teal-500 focus:outline-none focus:ring-1 focus:ring-teal-500"
            >
              <option value="">Select a study…</option>
              {availableStudies?.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
            <button
              type="submit"
              className="rounded-md bg-teal-700 px-3 py-1.5 text-xs font-semibold text-white hover:bg-teal-800 transition-colors"
            >
              Link
            </button>
          </form>
        </div>
      )}
    </section>
  )
}
