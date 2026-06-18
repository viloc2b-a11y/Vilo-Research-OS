import type { CampaignDetail, CampaignType, CampaignStatus } from '@/lib/crm/campaign-management'
import { createCampaign, updateCampaign } from '@/app/(ops)/recruitment/campaigns/actions'

type CampaignFormProps = {
  mode: 'create' | 'edit'
  campaign?: CampaignDetail
  organizationId: string
  partners?: { id: string; name: string }[]
}

const CAMPAIGN_TYPE_OPTIONS: { value: CampaignType; label: string }[] = [
  { value: 'referral_partner', label: 'Referral Partner' },
  { value: 'digital_paid', label: 'Digital Paid' },
  { value: 'community_event', label: 'Community Event' },
  { value: 'organic_seo', label: 'Organic SEO' },
  { value: 'internal', label: 'Internal' },
]

const CAMPAIGN_STATUS_OPTIONS: { value: CampaignStatus; label: string }[] = [
  { value: 'draft', label: 'Draft' },
  { value: 'active', label: 'Active' },
  { value: 'paused', label: 'Paused' },
  { value: 'closed', label: 'Closed' },
]

export function CampaignForm({ mode, campaign, organizationId, partners }: CampaignFormProps) {
  const action = mode === 'create' ? createCampaign : updateCampaign

  return (
    <form action={action} className="space-y-5 rounded-md border border-slate-200 bg-white p-5">
      {/* Hidden fields for edit mode */}
      {mode === 'edit' && campaign && (
        <>
          <input type="hidden" name="campaignId" value={campaign.id} />
          <input type="hidden" name="organizationId" value={organizationId} />
        </>
      )}

      {/* Create-only fields */}
      {mode === 'create' && (
        <>
          <div>
            <label htmlFor="name" className="block text-sm font-medium text-slate-700 mb-1">
              Campaign Name <span className="text-red-500">*</span>
            </label>
            <input
              id="name"
              type="text"
              name="name"
              required
              className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-teal-500 focus:outline-none focus:ring-1 focus:ring-teal-500"
              placeholder="e.g. Q1 2026 Facebook Campaign"
            />
          </div>

          <div>
            <label htmlFor="campaign_type" className="block text-sm font-medium text-slate-700 mb-1">
              Campaign Type <span className="text-red-500">*</span>
            </label>
            <select
              id="campaign_type"
              name="campaign_type"
              required
              className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-teal-500 focus:outline-none focus:ring-1 focus:ring-teal-500"
            >
              <option value="">Select a type</option>
              {CAMPAIGN_TYPE_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label htmlFor="utm_campaign" className="block text-sm font-medium text-slate-700 mb-1">
              UTM Campaign
            </label>
            <input
              id="utm_campaign"
              type="text"
              name="utm_campaign"
              className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-teal-500 focus:outline-none focus:ring-1 focus:ring-teal-500"
              placeholder="e.g. q1_facebook_2026"
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor="start_date" className="block text-sm font-medium text-slate-700 mb-1">
                Start Date
              </label>
              <input
                id="start_date"
                type="date"
                name="start_date"
                className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-teal-500 focus:outline-none focus:ring-1 focus:ring-teal-500"
              />
            </div>
            <div>
              <label htmlFor="end_date" className="block text-sm font-medium text-slate-700 mb-1">
                End Date
              </label>
              <input
                id="end_date"
                type="date"
                name="end_date"
                className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-teal-500 focus:outline-none focus:ring-1 focus:ring-teal-500"
              />
            </div>
          </div>
        </>
      )}

      {/* Edit-only fields */}
      {mode === 'edit' && (
        <>
          <div>
            <label htmlFor="status" className="block text-sm font-medium text-slate-700 mb-1">
              Status
            </label>
            <select
              id="status"
              name="status"
              defaultValue={campaign?.status}
              className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-teal-500 focus:outline-none focus:ring-1 focus:ring-teal-500"
            >
              {CAMPAIGN_STATUS_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label htmlFor="budget_amount" className="block text-sm font-medium text-slate-700 mb-1">
              Budget
            </label>
            <input
              id="budget_amount"
              type="number"
              name="budget_amount"
              step="0.01"
              min="0"
              defaultValue={campaign?.budget_amount ?? ''}
              className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-teal-500 focus:outline-none focus:ring-1 focus:ring-teal-500"
              placeholder="e.g. 5000.00"
            />
          </div>
        </>
      )}

      {/* Shared fields */}
      <div>
        <label htmlFor="description" className="block text-sm font-medium text-slate-700 mb-1">
          Description
        </label>
        <textarea
          id="description"
          name="description"
          rows={3}
          defaultValue={campaign?.description ?? ''}
          className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-teal-500 focus:outline-none focus:ring-1 focus:ring-teal-500"
          placeholder="Optional description for this campaign"
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor="target_leads" className="block text-sm font-medium text-slate-700 mb-1">
            Target Leads
          </label>
          <input
            id="target_leads"
            type="number"
            name="target_leads"
            min="0"
            defaultValue={campaign?.target_leads ?? ''}
            className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-teal-500 focus:outline-none focus:ring-1 focus:ring-teal-500"
            placeholder="e.g. 200"
          />
        </div>
        <div>
          <label htmlFor="target_enrollments" className="block text-sm font-medium text-slate-700 mb-1">
            Target Enrollments
          </label>
          <input
            id="target_enrollments"
            type="number"
            name="target_enrollments"
            min="0"
            defaultValue={campaign?.target_enrollments ?? ''}
            className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-teal-500 focus:outline-none focus:ring-1 focus:ring-teal-500"
            placeholder="e.g. 20"
          />
        </div>
      </div>

      {/* Optional partner linkage */}
      <div>
        <label htmlFor="partner_id" className="block text-xs font-semibold text-slate-700 mb-1">
          Partner (optional)
        </label>
        <select
          id="partner_id"
          name="partner_id"
          defaultValue={campaign?.partner_id ?? ''}
          className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-teal-500 focus:outline-none focus:ring-1 focus:ring-teal-500"
        >
          <option value="">No partner / Unassigned</option>
          {partners?.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>
      </div>

      <div className="flex justify-end gap-3 pt-2">
        <a
          href={mode === 'edit' && campaign ? `/recruitment/campaigns/${campaign.id}` : '/recruitment/campaigns'}
          className="rounded-md border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 transition-colors"
        >
          Cancel
        </a>
        <button
          type="submit"
          className="rounded-md bg-teal-700 px-4 py-2 text-sm font-semibold text-white hover:bg-teal-800 transition-colors"
        >
          {mode === 'create' ? 'Create Campaign' : 'Save Changes'}
        </button>
      </div>
    </form>
  )
}
