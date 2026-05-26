import { redirect } from 'next/navigation'
import {
  getOrganizationMemberships,
  getPrimaryOrganizationId,
  getSessionUser,
} from '@/lib/auth/session'
import { canAccessSubjectVisitWorkspace } from '@/lib/rbac/permissions'
import { createServerClient } from '@/lib/supabase/server'
import { VisitRuntimeClient } from '@/components/visit-runtime-execution/visit-runtime-client'

export default async function VisitRuntimePage() {
  const user = await getSessionUser()
  if (!user) redirect('/login')

  const organizationId = await getPrimaryOrganizationId(user.id)
  if (!organizationId) {
    return (
      <div className="space-y-4 p-6">
        <h1 className="text-2xl font-semibold tracking-tight">Visit runtime execution</h1>
        <p className="text-sm text-muted-foreground">No organization access is available.</p>
      </div>
    )
  }

  const memberships = await getOrganizationMemberships(user.id)
  if (!canAccessSubjectVisitWorkspace(memberships, organizationId)) {
    return (
      <div className="space-y-4 p-6">
        <h1 className="text-2xl font-semibold tracking-tight">Visit runtime execution</h1>
        <p className="text-sm text-muted-foreground">Access denied.</p>
      </div>
    )
  }

  const supabase = await createServerClient()

  const { data: studies } = await supabase
    .from('studies')
    .select('id, name')
    .eq('organization_id', organizationId)
    .order('name', { ascending: true })

  const studyList = (studies ?? []).map((study) => ({
    id: String(study.id),
    name: String(study.name),
  }))

  const subjectsByStudy: Record<string, { id: string; subjectIdentifier: string }[]> = {}
  const packagesByStudy: Record<
    string,
    { id: string; packageName: string; packageVersion: number }[]
  > = {}
  const visitShellsByPackage: Record<string, { id: string; visitCode: string; visitName: string }[]> =
    {}
  const procedureFieldDefinitionsByShell: Record<
    string,
    Array<{ field_id: string; label: string; type: string; required?: boolean }>
  > = {}

  for (const study of studyList) {
    const { data: subjects } = await supabase
      .from('study_subjects')
      .select('id, subject_identifier')
      .eq('organization_id', organizationId)
      .eq('study_id', study.id)
      .order('subject_identifier', { ascending: true })

    subjectsByStudy[study.id] = (subjects ?? []).map((subject) => ({
      id: String(subject.id),
      subjectIdentifier: String(subject.subject_identifier),
    }))

    const { data: packages } = await supabase
      .from('runtime_source_packages')
      .select('id, package_name, package_version')
      .eq('organization_id', organizationId)
      .eq('study_id', study.id)
      .in('package_status', ['reviewed', 'approved'])
      .order('package_version', { ascending: false })

    packagesByStudy[study.id] = (packages ?? []).map((pkg) => ({
      id: String(pkg.id),
      packageName: String(pkg.package_name),
      packageVersion: Number(pkg.package_version),
    }))
  }

  const packageIds = Object.values(packagesByStudy).flatMap((packages) => packages.map((pkg) => pkg.id))
  if (packageIds.length > 0) {
    const { data: visitShells } = await supabase
      .from('runtime_source_visit_shells')
      .select('id, source_package_id, visit_code, visit_name, sequence_order')
      .in('source_package_id', packageIds)
      .order('sequence_order', { ascending: true })

    for (const shell of visitShells ?? []) {
      const packageId = String(shell.source_package_id)
      if (!visitShellsByPackage[packageId]) visitShellsByPackage[packageId] = []
      visitShellsByPackage[packageId].push({
        id: String(shell.id),
        visitCode: String(shell.visit_code),
        visitName: String(shell.visit_name),
      })
    }

    const { data: procedureShells } = await supabase
      .from('runtime_source_procedure_shells')
      .select('id, source_shell_json')
      .in('source_package_id', packageIds)

    for (const shell of procedureShells ?? []) {
      const fields =
        ((shell.source_shell_json as { fields?: Array<{
          field_id: string
          label: string
          type: string
          required?: boolean
        }> })?.fields) ?? []
      procedureFieldDefinitionsByShell[String(shell.id)] = fields
    }
  }

  return (
    <div className="space-y-6 p-6">
      <header className="max-w-3xl">
        <h1 className="text-2xl font-semibold tracking-tight text-slate-900">
          Visit runtime execution
        </h1>
        <p className="mt-1 text-sm text-slate-500">
          Create subject visit workspaces from reviewed source packages. Capture procedure field
          values, lock completed visits, and preserve immutable snapshots (draft execution mode — not
          final eSource signatures).
        </p>
      </header>
      <VisitRuntimeClient
        organizationId={organizationId}
        studies={studyList}
        subjectsByStudy={subjectsByStudy}
        packagesByStudy={packagesByStudy}
        visitShellsByPackage={visitShellsByPackage}
        procedureFieldDefinitionsByShell={procedureFieldDefinitionsByShell}
      />
    </div>
  )
}
