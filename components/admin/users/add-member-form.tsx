'use client'

import { useActionState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { addOrganizationMemberByEmail } from '@/lib/admin/users/actions'
import { INITIAL_ADMIN_USER_ACTION_STATE } from '@/lib/admin/users/actions-state'
import { ASSIGNABLE_ROLES, roleLabel } from '@/lib/admin/users/role-labels'

type AddMemberFormProps = {
  organizationId: string
  actorIsOwner: boolean
  inviteSupported: boolean
}

export function AddMemberForm({
  organizationId,
  actorIsOwner,
  inviteSupported,
}: AddMemberFormProps) {
  const [state, formAction, pending] = useActionState(
    addOrganizationMemberByEmail,
    INITIAL_ADMIN_USER_ACTION_STATE,
  )

  const assignable = ASSIGNABLE_ROLES.filter((r) => actorIsOwner || r !== 'owner')

  return (
    <section
      className="rounded-lg border bg-card p-4"
      style={{ borderColor: 'var(--border)' }}
    >
      <h2 className="text-sm font-semibold text-foreground">Add user</h2>
      {!inviteSupported ? (
        <p className="mt-2 text-sm text-muted-foreground">
          Invite user coming soon — service role is required to look up accounts by email.
        </p>
      ) : (
        <>
          <p className="mt-1 text-xs text-muted-foreground">
            Add an existing auth account by email. The user must already exist in Supabase Auth.
          </p>
          <form action={formAction} className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-end">
            <input type="hidden" name="organization_id" value={organizationId} />
            <div className="flex-1 space-y-1">
              <Label htmlFor="add-member-email">Email</Label>
              <Input
                id="add-member-email"
                name="email"
                type="email"
                required
                placeholder="user@site.example"
                autoComplete="off"
              />
            </div>
            <div className="w-full space-y-1 sm:w-52">
              <Label htmlFor="add-member-role">Initial role</Label>
              <select
                id="add-member-role"
                name="initial_role"
                defaultValue="research_coordinator"
                className="flex h-8 w-full rounded-lg border border-input bg-transparent px-2.5 text-sm"
              >
                {assignable.map((role) => (
                  <option key={role} value={role}>
                    {roleLabel(role)}
                  </option>
                ))}
              </select>
            </div>
            <Button type="submit" disabled={pending}>
              {pending ? 'Adding…' : 'Add member'}
            </Button>
          </form>
          {state.message ? (
            <p
              className={`mt-2 text-sm ${state.ok ? 'text-emerald-700' : 'text-destructive'}`}
              role="status"
            >
              {state.message}
            </p>
          ) : null}
        </>
      )}
    </section>
  )
}
