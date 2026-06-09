'use client'

import { useState, useTransition } from 'react'
import { updateOrganizationProfile } from '@/app/(ops)/admin/organization/actions'

type OrganizationProfileProps = {
  organization: {
    id: string
    name: string
    legal_name: string | null
    address: string | null
    phone: string | null
    email: string | null
    website: string | null
    tax_id: string | null
    npi: string | null
    clia: string | null
    status: string
    created_at: string
    updated_at: string | null
  }
  adminRole: string
  canEdit: boolean
}

export function OrganizationProfileForm({ organization, adminRole, canEdit }: OrganizationProfileProps) {
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)

  async function onSubmit(formData: FormData) {
    setError(null)
    setSuccess(false)
    
    const data = {
      name: formData.get('name') as string,
      legal_name: (formData.get('legal_name') as string) || null,
      address: (formData.get('address') as string) || null,
      phone: (formData.get('phone') as string) || null,
      email: (formData.get('email') as string) || null,
      website: (formData.get('website') as string) || null,
      tax_id: (formData.get('tax_id') as string) || null,
      npi: (formData.get('npi') as string) || null,
      clia: (formData.get('clia') as string) || null,
    }

    startTransition(async () => {
      try {
        await updateOrganizationProfile(organization.id, data)
        setSuccess(true)
      } catch (err: any) {
        setError(err.message)
      }
    })
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between rounded-xl border border-border bg-card p-4">
        <div>
          <h2 className="text-sm font-semibold text-foreground">Organization Status</h2>
          <div className="mt-1 flex items-center gap-2">
            <span className="flex h-2 w-2 rounded-full bg-emerald-500"></span>
            <span className="text-sm text-muted-foreground capitalize">{organization.status}</span>
            <span className="text-sm text-muted-foreground ml-2 border-l border-border pl-2">
              Role: <strong className="text-foreground">{adminRole}</strong>
            </span>
          </div>
        </div>
        <div className="text-right">
          <p className="text-xs text-muted-foreground">ID: {organization.id}</p>
          <p className="text-xs text-muted-foreground mt-1">
            Created: {new Date(organization.created_at).toLocaleDateString()}
          </p>
        </div>
      </div>

      <form action={onSubmit} className="vilo-card p-6 space-y-6">
        <div className="grid gap-6 md:grid-cols-2">
          <div className="space-y-2">
            <label htmlFor="name" className="text-sm font-medium text-foreground">
              Organization Name <span className="text-destructive">*</span>
            </label>
            <input
              id="name"
              name="name"
              required
              defaultValue={organization.name}
              disabled={!canEdit || isPending}
              className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
            />
          </div>
          <div className="space-y-2">
            <label htmlFor="legal_name" className="text-sm font-medium text-foreground">
              Legal Name
            </label>
            <input
              id="legal_name"
              name="legal_name"
              defaultValue={organization.legal_name || ''}
              disabled={!canEdit || isPending}
              className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors disabled:cursor-not-allowed disabled:opacity-50"
            />
          </div>
        </div>

        <div className="space-y-2">
          <label htmlFor="address" className="text-sm font-medium text-foreground">
            Address
          </label>
          <input
            id="address"
            name="address"
            defaultValue={organization.address || ''}
            disabled={!canEdit || isPending}
            className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors disabled:cursor-not-allowed disabled:opacity-50"
          />
        </div>

        <div className="grid gap-6 md:grid-cols-3">
          <div className="space-y-2">
            <label htmlFor="phone" className="text-sm font-medium text-foreground">
              Phone
            </label>
            <input
              id="phone"
              name="phone"
              defaultValue={organization.phone || ''}
              disabled={!canEdit || isPending}
              className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors disabled:cursor-not-allowed disabled:opacity-50"
            />
          </div>
          <div className="space-y-2">
            <label htmlFor="email" className="text-sm font-medium text-foreground">
              Email
            </label>
            <input
              id="email"
              name="email"
              type="email"
              defaultValue={organization.email || ''}
              disabled={!canEdit || isPending}
              className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors disabled:cursor-not-allowed disabled:opacity-50"
            />
          </div>
          <div className="space-y-2">
            <label htmlFor="website" className="text-sm font-medium text-foreground">
              Website
            </label>
            <input
              id="website"
              name="website"
              type="url"
              defaultValue={organization.website || ''}
              disabled={!canEdit || isPending}
              className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors disabled:cursor-not-allowed disabled:opacity-50"
            />
          </div>
        </div>

        <div className="grid gap-6 md:grid-cols-3">
          <div className="space-y-2">
            <label htmlFor="tax_id" className="text-sm font-medium text-foreground">
              Tax ID / EIN
            </label>
            <input
              id="tax_id"
              name="tax_id"
              defaultValue={organization.tax_id || ''}
              disabled={!canEdit || isPending}
              className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors disabled:cursor-not-allowed disabled:opacity-50"
            />
          </div>
          <div className="space-y-2">
            <label htmlFor="npi" className="text-sm font-medium text-foreground">
              NPI
            </label>
            <input
              id="npi"
              name="npi"
              defaultValue={organization.npi || ''}
              disabled={!canEdit || isPending}
              className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors disabled:cursor-not-allowed disabled:opacity-50"
            />
          </div>
          <div className="space-y-2">
            <label htmlFor="clia" className="text-sm font-medium text-foreground">
              CLIA
            </label>
            <input
              id="clia"
              name="clia"
              defaultValue={organization.clia || ''}
              disabled={!canEdit || isPending}
              className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors disabled:cursor-not-allowed disabled:opacity-50"
            />
          </div>
        </div>

        {error && (
          <div className="rounded-md bg-destructive/15 p-3 text-sm text-destructive">
            {error}
          </div>
        )}
        
        {success && (
          <div className="rounded-md bg-emerald-500/15 p-3 text-sm text-emerald-600">
            Organization profile updated successfully.
          </div>
        )}

        {canEdit && (
          <div className="flex justify-end pt-4 border-t border-border mt-6">
            <button
              type="submit"
              disabled={isPending}
              className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground shadow transition-colors hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50"
            >
              {isPending ? 'Saving...' : 'Save Changes'}
            </button>
          </div>
        )}
      </form>
    </div>
  )
}
