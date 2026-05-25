'use client'

import Link from 'next/link'
import { useActionState } from 'react'
import { ChevronLeft } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { createStudy } from '@/lib/studies/actions'
import {
  INITIAL_CREATE_STUDY_STATE,
  type CreateStudyActionState,
} from '@/lib/studies/create-study-action-state'
import { STUDY_PHASE_OPTIONS, STUDY_STATUS_VALUES } from '@/lib/studies/types'

type OrgOption = {
  organizationId: string
  organizationName: string
}

type CreateStudyFormProps = {
  organizations: OrgOption[]
  defaultOrganizationId: string | null
}

const fieldClass =
  'w-full h-9 px-3 rounded-lg border border-border text-sm bg-card focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent'

function FieldError({ message }: { message?: string }) {
  if (!message) return null
  return <p className="text-xs text-destructive mt-1">{message}</p>
}

export function CreateStudyForm({ organizations, defaultOrganizationId }: CreateStudyFormProps) {
  const [state, formAction, pending] = useActionState<CreateStudyActionState, FormData>(
    createStudy,
    INITIAL_CREATE_STUDY_STATE,
  )

  const showOrgSelect = organizations.length > 1
  const orgId = defaultOrganizationId ?? organizations[0]?.organizationId ?? ''

  return (
    <div className="max-w-xl">
      <Link
        href="/studies"
        className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-primary mb-6"
      >
        <ChevronLeft className="w-4 h-4" />
        Back to Studies
      </Link>

      <div className="mb-6">
        <h1 className="heading-serif text-xl text-foreground">New Study</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Create a protocol shell for operational testing. Sponsor, phase, and enrollment are stored
          on the initial study version metadata.
        </p>
      </div>

      <form id="create-study-form" action={formAction} className="vilo-card p-6 space-y-5">
        {showOrgSelect ? (
          <div>
            <Label htmlFor="organization_id">Organization</Label>
            <select
              id="organization_id"
              name="organization_id"
              className={fieldClass}
              defaultValue={orgId}
              required
            >
              {organizations.map((org) => (
                <option key={org.organizationId} value={org.organizationId}>
                  {org.organizationName}
                </option>
              ))}
            </select>
            <FieldError message={state.fieldErrors?.organization_id} />
          </div>
        ) : (
          <input type="hidden" name="organization_id" value={orgId} />
        )}

        <div>
          <Label htmlFor="title">Protocol / study title</Label>
          <Input
            id="title"
            name="title"
            className="mt-1.5"
            placeholder="e.g. OA Phase 3 Operational Pilot"
            required
            maxLength={240}
          />
          <FieldError message={state.fieldErrors?.title} />
        </div>

        <div>
          <Label htmlFor="study_code">Study code</Label>
          <Input
            id="study_code"
            name="study_code"
            className="mt-1.5 mono-id"
            placeholder="e.g. VILO-OA-301"
            required
            maxLength={64}
          />
          <p className="text-xs text-muted-foreground mt-1">Unique per organization; used as the study slug.</p>
          <FieldError message={state.fieldErrors?.study_code} />
        </div>

        <div>
          <Label htmlFor="sponsor_name">Sponsor name</Label>
          <Input
            id="sponsor_name"
            name="sponsor_name"
            className="mt-1.5"
            placeholder="e.g. Vilo Research"
            required
            maxLength={160}
          />
          <FieldError message={state.fieldErrors?.sponsor_name} />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <Label htmlFor="phase">Phase</Label>
            <select id="phase" name="phase" className={`${fieldClass} mt-1.5`} required defaultValue="">
              <option value="" disabled>
                Select phase
              </option>
              {STUDY_PHASE_OPTIONS.map((phase) => (
                <option key={phase} value={phase}>
                  {phase}
                </option>
              ))}
            </select>
            <FieldError message={state.fieldErrors?.phase} />
          </div>

          <div>
            <Label htmlFor="status">Status</Label>
            <select
              id="status"
              name="status"
              className={`${fieldClass} mt-1.5`}
              required
              defaultValue="draft"
            >
              {STUDY_STATUS_VALUES.map((status) => (
                <option key={status} value={status}>
                  {status}
                </option>
              ))}
            </select>
            <FieldError message={state.fieldErrors?.status} />
          </div>
        </div>

        <div>
          <Label htmlFor="enrollment_target">Target enrollment (optional)</Label>
          <Input
            id="enrollment_target"
            name="enrollment_target"
            type="number"
            min={1}
            className="mt-1.5"
            placeholder="e.g. 120"
          />
          <FieldError message={state.fieldErrors?.enrollment_target} />
        </div>

        {state.message && !state.ok ? (
          <p className="text-sm text-destructive rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2">
            {state.message}
          </p>
        ) : null}

        <div className="flex items-center gap-3 pt-2">
          <Button
            id="create-study-submit"
            type="submit"
            disabled={pending}
            className="vilo-btn-primary border-0"
          >
            {pending ? 'Creating…' : 'Create Study'}
          </Button>
          <Link href="/studies" className="text-sm text-muted-foreground hover:text-foreground">
            Cancel
          </Link>
        </div>
      </form>
    </div>
  )
}
