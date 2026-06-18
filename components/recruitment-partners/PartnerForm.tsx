import type { PartnerDetail, PartnerStatus, PartnerType } from '@/lib/crm/partner-management'
import { createPartner, updatePartner } from '@/app/(ops)/recruitment/partners/actions'

type PartnerFormProps = {
  mode: 'create' | 'edit'
  partner?: PartnerDetail
  organizationId: string
}

const PARTNER_TYPE_OPTIONS: { value: PartnerType; label: string }[] = [
  { value: 'digital_agency', label: 'Digital Agency' },
  { value: 'media_buyer', label: 'Media Buyer' },
  { value: 'community_org', label: 'Community Org' },
  { value: 'physician_group', label: 'Physician Group' },
  { value: 'hospital', label: 'Hospital' },
  { value: 'referral_network', label: 'Referral Network' },
  { value: 'patient_advocacy', label: 'Patient Advocacy' },
  { value: 'employer', label: 'Employer' },
  { value: 'other', label: 'Other' },
]

const PARTNER_STATUS_OPTIONS: { value: PartnerStatus; label: string }[] = [
  { value: 'active', label: 'Active' },
  { value: 'paused', label: 'Paused' },
  { value: 'inactive', label: 'Inactive' },
]

export function PartnerForm({ mode, partner, organizationId }: PartnerFormProps) {
  const action = mode === 'create' ? createPartner : updatePartner

  return (
    <form action={action} className="space-y-5 rounded-md border border-slate-200 bg-white p-5">
      {/* Hidden fields for edit mode */}
      {mode === 'edit' && partner && (
        <>
          <input type="hidden" name="partnerId" value={partner.id} />
          <input type="hidden" name="organizationId" value={organizationId} />
        </>
      )}

      {/* Create-only fields */}
      {mode === 'create' && (
        <>
          <div>
            <label htmlFor="name" className="block text-sm font-medium text-slate-700 mb-1">
              Partner Name <span className="text-red-500">*</span>
            </label>
            <input
              id="name"
              type="text"
              name="name"
              required
              className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-teal-500 focus:outline-none focus:ring-1 focus:ring-teal-500"
              placeholder="e.g. Acme Digital Agency"
            />
          </div>

          <div>
            <label htmlFor="partner_type" className="block text-sm font-medium text-slate-700 mb-1">
              Partner Type <span className="text-red-500">*</span>
            </label>
            <select
              id="partner_type"
              name="partner_type"
              required
              className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-teal-500 focus:outline-none focus:ring-1 focus:ring-teal-500"
            >
              <option value="">Select a type</option>
              {PARTNER_TYPE_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>

          {/* Status defaults to 'active' on create */}
          <input type="hidden" name="status" value="active" />
        </>
      )}

      {/* Edit-only fields */}
      {mode === 'edit' && partner && (
        <>
          <div>
            <p className="text-sm font-medium text-slate-700 mb-1">Partner Name</p>
            <p className="text-sm text-slate-900 rounded-md border border-slate-200 bg-slate-50 px-3 py-2">
              {partner.name}
            </p>
          </div>

          <div>
            <p className="text-sm font-medium text-slate-700 mb-1">Partner Type</p>
            <p className="text-sm text-slate-900 rounded-md border border-slate-200 bg-slate-50 px-3 py-2 capitalize">
              {partner.partner_type.replace(/_/g, ' ')}
            </p>
          </div>

          <div>
            <label htmlFor="status" className="block text-sm font-medium text-slate-700 mb-1">
              Status
            </label>
            <select
              id="status"
              name="status"
              defaultValue={partner.status}
              className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-teal-500 focus:outline-none focus:ring-1 focus:ring-teal-500"
            >
              {PARTNER_STATUS_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>
        </>
      )}

      {/* Shared contact fields */}
      <div>
        <label htmlFor="contact_name" className="block text-sm font-medium text-slate-700 mb-1">
          Contact Name
        </label>
        <input
          id="contact_name"
          type="text"
          name="contact_name"
          defaultValue={partner?.contact_name ?? ''}
          className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-teal-500 focus:outline-none focus:ring-1 focus:ring-teal-500"
          placeholder="e.g. Jane Smith"
        />
      </div>

      <div>
        <label htmlFor="contact_email" className="block text-sm font-medium text-slate-700 mb-1">
          Contact Email
        </label>
        <input
          id="contact_email"
          type="email"
          name="contact_email"
          defaultValue={partner?.contact_email ?? ''}
          className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-teal-500 focus:outline-none focus:ring-1 focus:ring-teal-500"
          placeholder="e.g. jane@example.com"
        />
      </div>

      <div>
        <label htmlFor="contact_phone" className="block text-sm font-medium text-slate-700 mb-1">
          Contact Phone
        </label>
        <input
          id="contact_phone"
          type="tel"
          name="contact_phone"
          defaultValue={partner?.contact_phone ?? ''}
          className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-teal-500 focus:outline-none focus:ring-1 focus:ring-teal-500"
          placeholder="e.g. +1 555-123-4567"
        />
      </div>

      <div>
        <label htmlFor="notes" className="block text-sm font-medium text-slate-700 mb-1">
          Notes
        </label>
        <textarea
          id="notes"
          name="notes"
          rows={3}
          defaultValue={partner?.notes ?? ''}
          className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-teal-500 focus:outline-none focus:ring-1 focus:ring-teal-500"
          placeholder="Optional notes about this partner"
        />
      </div>

      <div className="flex justify-end gap-3 pt-2">
        <a
          href={mode === 'edit' && partner ? `/recruitment/partners/${partner.id}` : '/recruitment/partners'}
          className="rounded-md border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 transition-colors"
        >
          Cancel
        </a>
        <button
          type="submit"
          className="rounded-md bg-teal-700 px-4 py-2 text-sm font-semibold text-white hover:bg-teal-800 transition-colors"
        >
          {mode === 'create' ? 'Create Partner' : 'Save Changes'}
        </button>
      </div>
    </form>
  )
}
