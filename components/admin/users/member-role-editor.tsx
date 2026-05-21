'use client'

import { useActionState, useMemo, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Label } from '@/components/ui/label'
import {
  updateOrganizationMemberRoles,
  INITIAL_ADMIN_USER_ACTION_STATE,
} from '@/lib/admin/users/actions'
import {
  assignableRolesForActor,
  canActorEditTargetRoles,
} from '@/lib/admin/users/role-policy'
import {
  roleLabel,
  UNBLINDED_ORGANIZATION_ROLES,
} from '@/lib/admin/users/role-labels'
import type { OrganizationMemberRow } from '@/lib/admin/users/types'
import type { OrganizationRole } from '@/lib/rbac/roles'
import { cn } from '@/lib/utils'

type MemberRoleEditorProps = {
  member: OrganizationMemberRow
  organizationId: string
  actorIsOwner: boolean
}

export function MemberRoleEditor({
  member,
  organizationId,
  actorIsOwner,
}: MemberRoleEditorProps) {
  const [open, setOpen] = useState(false)
  const [selected, setSelected] = useState<Set<OrganizationRole>>(
    () => new Set(member.roles),
  )

  const [state, formAction, pending] = useActionState(
    updateOrganizationMemberRoles,
    INITIAL_ADMIN_USER_ACTION_STATE,
  )

  const assignable = useMemo(
    () => assignableRolesForActor(actorIsOwner),
    [actorIsOwner],
  )

  const canEdit = canActorEditTargetRoles(actorIsOwner, member.roles)
  const hasUnblindedSelected = [...selected].some((r) =>
    UNBLINDED_ORGANIZATION_ROLES.includes(r),
  )

  function toggle(role: OrganizationRole, checked: boolean) {
    setSelected((prev) => {
      const next = new Set(prev)
      if (checked) next.add(role)
      else next.delete(role)
      return next
    })
  }

  if (!open) {
    return (
      <Button
        type="button"
        variant="outline"
        size="sm"
        disabled={!canEdit}
        onClick={() => setOpen(true)}
      >
        Edit roles
      </Button>
    )
  }

  return (
    <div className="mt-2 rounded-md border border-border bg-muted/30 p-3">
      <form action={formAction} className="space-y-3">
        <input type="hidden" name="organization_id" value={organizationId} />
        <input type="hidden" name="member_id" value={member.id} />

        <p className="text-xs font-medium text-foreground">
          Roles for {member.displayName ?? member.email ?? member.userId}
        </p>

        {member.status === 'deactivated' ? (
          <p className="text-xs text-muted-foreground">
            Member is deactivated. Role changes are saved for audit history and do not
            reactivate access.
          </p>
        ) : null}

        {[...selected].map((role) => (
          <input key={role} type="hidden" name="roles" value={role} />
        ))}

        <div className="grid gap-2 sm:grid-cols-2">
          {assignable.map((role) => {
            const isUnblinded = UNBLINDED_ORGANIZATION_ROLES.includes(role)
            const checked = selected.has(role)
            const disabled =
              !actorIsOwner && role === 'owner' && !member.roles.includes('owner')

            return (
              <div key={role} className="flex items-start gap-2">
                <Checkbox
                  id={`${member.id}-${role}`}
                  checked={checked}
                  disabled={disabled}
                  onCheckedChange={(value) => toggle(role, value === true)}
                />
                <Label
                  htmlFor={`${member.id}-${role}`}
                  className={cn(
                    'text-xs leading-snug',
                    isUnblinded && 'text-amber-900',
                  )}
                >
                  {roleLabel(role)}
                  {isUnblinded ? (
                    <span className="ml-1 font-normal text-amber-800">(unblinded)</span>
                  ) : null}
                </Label>
              </div>
            )
          })}
        </div>

        {hasUnblindedSelected ? (
          <p className="text-xs text-amber-900">
            Unblinded roles may access restricted treatment/IP/randomization information.
          </p>
        ) : null}

        {!actorIsOwner && member.roles.includes('owner') ? (
          <p className="text-xs text-muted-foreground">
            Only an owner can change roles for another owner.
          </p>
        ) : null}

        <div className="flex flex-wrap gap-2">
          <Button type="submit" size="sm" disabled={pending || selected.size === 0}>
            {pending ? 'Saving…' : 'Save roles'}
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => {
              setSelected(new Set(member.roles))
              setOpen(false)
            }}
          >
            Cancel
          </Button>
        </div>

        {state.message ? (
          <p
            className={`text-xs ${state.ok ? 'text-emerald-700' : 'text-destructive'}`}
            role="status"
          >
            {state.message}
          </p>
        ) : null}
      </form>
    </div>
  )
}
