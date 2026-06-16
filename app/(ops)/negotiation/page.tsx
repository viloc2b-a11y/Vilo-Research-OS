import { redirect } from 'next/navigation'
import { getSessionUser, getOrganizationMemberships } from '@/lib/auth/session'
import { activeMemberships } from '@/lib/auth/membership-access'
import { canViewNegotiation } from '@/lib/rbac/permissions'
import NegotiationClient from './_components/NegotiationClient'

export default async function NegotiationEnginePage() {
  const user = await getSessionUser()
  if (!user) redirect('/login')
  const memberships = activeMemberships(await getOrganizationMemberships(user.id))
  if (!canViewNegotiation(memberships)) redirect('/')
  return <NegotiationClient />
}
