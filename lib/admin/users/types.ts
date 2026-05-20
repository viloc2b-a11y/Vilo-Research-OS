import type { OrganizationRole } from '@/lib/rbac/roles'

export type OrganizationMemberRow = {
  id: string
  organizationId: string
  userId: string
  email: string | null
  displayName: string | null
  primaryRole: OrganizationRole | null
  roles: OrganizationRole[]
  additionalRoles: OrganizationRole[]
  joinedAt: string
  updatedAt: string | null
  statusLabel: string
}

export type OrganizationMembersAdminModel = {
  organizationId: string
  organizationName: string
  actorUserId: string
  actorIsOwner: boolean
  actorIsAdmin: boolean
  members: OrganizationMemberRow[]
  inviteSupported: boolean
}
