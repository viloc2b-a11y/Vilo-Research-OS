import { redirect } from 'next/navigation'
import { createServerClient } from '@/lib/supabase/server'
import { getSessionUser, getOrganizationMemberships } from '@/lib/auth/session'
import { hasSiteAdminAccess } from '@/lib/rbac/permissions'
import { OrganizationProfileForm } from '@/components/admin/organization-profile-form'

export default async function OrganizationProfilePage() {
  const user = await getSessionUser()
  if (!user) redirect('/login')

  const memberships = await getOrganizationMemberships(user.id)
  
  // Get active organization based on context (for now, pick the first active one the user is admin of)
  const adminMembership = memberships.find(m => m.roles.includes('admin') || m.roles.includes('owner') || m.role === 'admin' || m.role === 'owner')
  if (!adminMembership) {
    return <div className="p-6">No admin access detected for any organization.</div>
  }

  const organizationId = adminMembership.organization_id

  const supabase = await createServerClient()
  const { data: orgData, error } = await supabase
    .from('organizations')
    .select('*')
    .eq('id', organizationId)
    .single()

  if (error || !orgData) {
    return <div className="p-6">Error loading organization profile.</div>
  }

  const canEdit = hasSiteAdminAccess(memberships, organizationId)

  return (
    <div className="p-6 max-w-4xl">
      <div className="border-b border-border pb-5 mb-6">
        <h1 className="heading-serif text-xl text-foreground">Company Profile</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Manage your main organization details and compliance settings.
        </p>
      </div>
      
      <OrganizationProfileForm 
        organization={orgData as any} 
        adminRole={adminMembership.role} 
        canEdit={canEdit} 
      />
    </div>
  )
}
