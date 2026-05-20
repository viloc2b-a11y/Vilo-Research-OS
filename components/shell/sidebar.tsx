import { SidebarNav } from '@/components/shell/sidebar-nav'

type SidebarProps = {
  organizationName?: string | null
}

export function Sidebar({ organizationName }: SidebarProps) {
  return <SidebarNav organizationName={organizationName} />
}
