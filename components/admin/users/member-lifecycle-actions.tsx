'use client'

import { useActionState, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  deactivateOrganizationMember,
  reactivateOrganizationMember,
  INITIAL_ADMIN_USER_ACTION_STATE,
} from '@/lib/admin/users/actions'
import type { OrganizationMemberRow } from '@/lib/admin/users/types'

type MemberLifecycleActionsProps = {
  member: OrganizationMemberRow
  organizationId: string
}

export function MemberLifecycleActions({
  member,
  organizationId,
}: MemberLifecycleActionsProps) {
  const [showDeactivate, setShowDeactivate] = useState(false)
  const [deactivateState, deactivateAction, deactivatePending] = useActionState(
    deactivateOrganizationMember,
    INITIAL_ADMIN_USER_ACTION_STATE,
  )
  const [reactivateState, reactivateAction, reactivatePending] = useActionState(
    reactivateOrganizationMember,
    INITIAL_ADMIN_USER_ACTION_STATE,
  )

  const lifecycleMessage = deactivateState.message ?? reactivateState.message
  const lifecycleOk = deactivateState.ok || reactivateState.ok

  if (member.status === 'deactivated') {
    return (
      <div className="mt-2 space-y-2">
        {member.hasHistoricalActivity ? (
          <p className="text-xs text-muted-foreground">
            This user has study activity and cannot be removed. Deactivate instead.
          </p>
        ) : null}
        {member.canReactivate ? (
          <form action={reactivateAction}>
            <input type="hidden" name="organization_id" value={organizationId} />
            <input type="hidden" name="member_id" value={member.id} />
            <Button type="submit" variant="outline" size="sm" disabled={reactivatePending}>
              {reactivatePending ? 'Reactivating…' : 'Reactivate'}
            </Button>
          </form>
        ) : null}
        {lifecycleMessage ? (
          <p
            className={`text-xs ${lifecycleOk ? 'text-emerald-700' : 'text-destructive'}`}
            role="status"
          >
            {lifecycleMessage}
          </p>
        ) : null}
      </div>
    )
  }

  return (
    <div className="mt-2 space-y-2">
      {member.hasHistoricalActivity ? (
        <p className="text-xs text-muted-foreground">
          This user has study activity and cannot be removed. Deactivate instead.
        </p>
      ) : null}

      {!showDeactivate && member.canDeactivate ? (
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="text-destructive hover:text-destructive"
          onClick={() => setShowDeactivate(true)}
        >
          Deactivate
        </Button>
      ) : null}

      {showDeactivate && member.canDeactivate ? (
        <form action={deactivateAction} className="space-y-2 rounded-md border border-border p-3">
          <input type="hidden" name="organization_id" value={organizationId} />
          <input type="hidden" name="member_id" value={member.id} />
          <div className="space-y-1">
            <Label htmlFor={`deactivate-reason-${member.id}`} className="text-xs">
              Reason (optional)
            </Label>
            <Textarea
              id={`deactivate-reason-${member.id}`}
              name="deactivation_reason"
              rows={2}
              className="text-xs"
              placeholder="e.g. left site, access suspended"
            />
          </div>
          <div className="flex flex-wrap gap-2">
            <Button
              type="submit"
              variant="destructive"
              size="sm"
              disabled={deactivatePending}
            >
              {deactivatePending ? 'Deactivating…' : 'Confirm deactivate'}
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => setShowDeactivate(false)}
            >
              Cancel
            </Button>
          </div>
        </form>
      ) : null}

      {lifecycleMessage ? (
        <p
          className={`text-xs ${lifecycleOk ? 'text-emerald-700' : 'text-destructive'}`}
          role="status"
        >
          {lifecycleMessage}
        </p>
      ) : null}
    </div>
  )
}
