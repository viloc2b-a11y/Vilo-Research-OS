'use client'

import { MemberLifecycleActions } from '@/components/admin/users/member-lifecycle-actions'
import { MemberRoleEditor } from '@/components/admin/users/member-role-editor'
import { MemberStatusBadge } from '@/components/admin/users/member-status-badge'
import {
  formatRoleList,
  roleLabel,
  UNBLINDED_ORGANIZATION_ROLES,
} from '@/lib/admin/users/role-labels'
import type { OrganizationMembersAdminModel } from '@/lib/admin/users/types'

function formatWhen(iso: string | null) {
  if (!iso) return '—'
  try {
    return new Date(iso).toLocaleString(undefined, {
      dateStyle: 'medium',
      timeStyle: 'short',
    })
  } catch {
    return iso
  }
}

type OrganizationMemberTableProps = {
  model: OrganizationMembersAdminModel
}

export function OrganizationMemberTable({ model }: OrganizationMemberTableProps) {
  return (
    <div className="overflow-x-auto rounded-lg border border-border bg-card">
      <table className="w-full min-w-[720px] text-left text-sm">
        <thead>
          <tr className="border-b border-border bg-muted/40 text-xs uppercase tracking-wide text-muted-foreground">
            <th className="px-4 py-3 font-medium">User</th>
            <th className="px-4 py-3 font-medium">Primary role</th>
            <th className="px-4 py-3 font-medium">Additional roles</th>
            <th className="px-4 py-3 font-medium">Status</th>
            <th className="px-4 py-3 font-medium">Updated</th>
            <th className="px-4 py-3 font-medium">Actions</th>
          </tr>
        </thead>
        <tbody>
          {model.members.map((member) => {
            const showUnblindedBadge = member.roles.some((r) =>
              UNBLINDED_ORGANIZATION_ROLES.includes(r),
            )
            return (
              <tr key={member.id} className="border-b border-border align-top last:border-0">
                <td className="px-4 py-3">
                  <p className="font-medium text-foreground">
                    {member.displayName ?? member.email ?? 'Unknown user'}
                  </p>
                  {member.email ? (
                    <p className="text-xs text-muted-foreground">{member.email}</p>
                  ) : null}
                  {member.userId === model.actorUserId ? (
                    <span className="mt-1 inline-block text-[10px] uppercase text-primary">
                      You
                    </span>
                  ) : null}
                </td>
                <td className="px-4 py-3">
                  {member.primaryRole ? roleLabel(member.primaryRole) : '—'}
                  {member.primaryRole &&
                  UNBLINDED_ORGANIZATION_ROLES.includes(member.primaryRole) ? (
                    <span className="ml-1 text-[10px] text-amber-800">unblinded</span>
                  ) : null}
                </td>
                <td className="px-4 py-3 text-muted-foreground">
                  {member.additionalRoles.length > 0
                    ? formatRoleList(member.additionalRoles)
                    : '—'}
                  {showUnblindedBadge && member.additionalRoles.length === 0 ? (
                    <span className="text-[10px] text-amber-800">unblinded</span>
                  ) : null}
                </td>
                <td className="px-4 py-3">
                  <MemberStatusBadge status={member.status} />
                </td>
                <td className="px-4 py-3 text-xs text-muted-foreground">
                  {formatWhen(member.updatedAt ?? member.joinedAt)}
                </td>
                <td className="px-4 py-3">
                  <MemberRoleEditor
                    member={member}
                    organizationId={model.organizationId}
                    actorIsOwner={model.actorIsOwner}
                  />
                  <MemberLifecycleActions
                    member={member}
                    organizationId={model.organizationId}
                  />
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
      {model.members.length === 0 ? (
        <p className="p-4 text-sm text-muted-foreground">No members in this organization.</p>
      ) : null}
    </div>
  )
}
