import {
  CANONICAL_ORGANIZATION_ROLES,
  type OrganizationRole,
} from '@/lib/rbac/roles'

export const ORGANIZATION_ROLE_LABELS: Record<OrganizationRole, string> = {
  owner: 'Owner',
  admin: 'Admin',
  site_staff: 'Site Staff',
  research_coordinator: 'Research Coordinator',
  data_coordinator: 'Data Coordinator',
  pi_sub_i: 'PI / Sub-I',
  read_only: 'Read Only',
  unblinded_coordinator: 'Unblinded Coordinator',
  unblinded_cra: 'Unblinded CRA',
}

export const UNBLINDED_ORGANIZATION_ROLES: OrganizationRole[] = [
  'unblinded_coordinator',
  'unblinded_cra',
]

export const ROLE_MATRIX_HELP: { role: OrganizationRole; description: string }[] = [
  {
    role: 'research_coordinator',
    description: 'Blinded coordinator workflow.',
  },
  {
    role: 'data_coordinator',
    description: 'Source/eSource and data workflow.',
  },
  {
    role: 'unblinded_coordinator',
    description: 'Coordinator with restricted unblinded access.',
  },
  {
    role: 'unblinded_cra',
    description: 'Unblinded monitoring, read/review only.',
  },
  {
    role: 'pi_sub_i',
    description: 'Clinical review/signature.',
  },
  {
    role: 'read_only',
    description: 'View-only.',
  },
]

export const ASSIGNABLE_ROLES: OrganizationRole[] = [...CANONICAL_ORGANIZATION_ROLES]

export function roleLabel(role: OrganizationRole | string): string {
  const key = role as OrganizationRole
  return ORGANIZATION_ROLE_LABELS[key] ?? role.replace(/_/g, ' ')
}

export function formatRoleList(roles: OrganizationRole[]): string {
  return roles.map(roleLabel).join(', ')
}

export function additionalRoles(
  primary: OrganizationRole | null,
  all: OrganizationRole[],
): OrganizationRole[] {
  if (!primary) return all
  return all.filter((r) => r !== primary)
}
