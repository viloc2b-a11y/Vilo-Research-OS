import { Badge } from '@/components/ui/badge'
import type { OrganizationMemberStatus } from '@/lib/admin/users/membership-status'
import { membershipStatusLabel } from '@/lib/admin/users/membership-status'
import { cn } from '@/lib/utils'

type MemberStatusBadgeProps = {
  status: OrganizationMemberStatus
}

export function MemberStatusBadge({ status }: MemberStatusBadgeProps) {
  return (
    <Badge
      variant={status === 'deactivated' ? 'secondary' : status === 'inactive' ? 'outline' : 'default'}
      className={cn(
        status === 'deactivated' && 'text-muted-foreground',
        status === 'inactive' && 'text-amber-900',
      )}
    >
      {membershipStatusLabel(status)}
    </Badge>
  )
}
