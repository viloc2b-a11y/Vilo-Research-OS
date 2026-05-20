import {
  ROLE_MATRIX_HELP,
  UNBLINDED_ORGANIZATION_ROLES,
  roleLabel,
} from '@/lib/admin/users/role-labels'

export function RoleMatrixHelp() {
  return (
    <section
      className="rounded-lg border bg-card p-4 text-sm"
      style={{ borderColor: 'var(--border)' }}
    >
      <h2 className="font-semibold text-foreground">Role guide</h2>
      <p className="mt-1 text-xs text-muted-foreground">
        Effective permissions are the union of all assigned roles. Legacy primary role matches the
        first role in the list.
      </p>
      <ul className="mt-3 space-y-2">
        {ROLE_MATRIX_HELP.map((entry) => (
          <li key={entry.role}>
            <span className="font-medium text-foreground">{roleLabel(entry.role)}:</span>{' '}
            <span className="text-muted-foreground">{entry.description}</span>
          </li>
        ))}
      </ul>
      <p className="mt-3 rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-xs text-amber-950">
        <span className="font-semibold">Unblinded roles</span> (
        {UNBLINDED_ORGANIZATION_ROLES.map(roleLabel).join(', ')}) may access restricted
        treatment/IP/randomization information. Admin does not automatically receive unblinded
        access.
      </p>
    </section>
  )
}
