// components/subjects/subject-chart-header.tsx
// Phase 7D — Subject Workspace Header (Vilo OS visual shell)
// Sticky header with subject identity, status, risk, breadcrumb context.
// All data props preserved — only visual output changed.

import Link from 'next/link'
import { ChevronRight } from 'lucide-react'
import { studiesIndexPath, studyDetailPath } from '@/lib/ops/paths'
import { SubjectHealthStatusBadge } from '@/components/subjects/operations/SubjectHealthStatusBadge'
import type { SubjectOperationalHealth } from '@/lib/subject/operations/types'
import type { SubjectChartHeaderModel } from '@/lib/subject/visits/types'

type SubjectChartHeaderProps = {
  header: SubjectChartHeaderModel
  subtitle?: string
  operationalHealth?: SubjectOperationalHealth | null
}

function enrollmentStatusClass(status: string) {
  switch (status) {
    case 'active':     return 'status-badge-healthy'
    case 'enrolled':   return 'status-badge-healthy'
    case 'screening':  return 'status-badge-watch'
    case 'completed':  return 'bg-muted text-muted-foreground'
    case 'withdrawn':  return 'status-badge-risk'
    default:           return 'bg-muted text-muted-foreground'
  }
}

function healthToRisk(health: SubjectOperationalHealth | null | undefined): string {
  if (!health) return 'bg-muted text-muted-foreground'
  return {
    healthy:   'status-badge-healthy',
    attention: 'status-badge-watch',
    critical:  'status-badge-critical',
  }[health] ?? 'bg-muted text-muted-foreground'
}

export function SubjectChartHeader({
  header,
  subtitle,
  operationalHealth,
}: SubjectChartHeaderProps) {
  void subtitle
  const initials = header.initials ?? header.subjectIdentifier?.slice(0, 2).toUpperCase() ?? '—'

  return (
    <div
      className="bg-card border-b"
      style={{ borderColor: 'var(--border)' }}
    >
      {/* Breadcrumb */}
      <div className="flex items-center gap-1.5 px-6 pt-3 pb-0 text-xs" style={{ color: 'var(--muted-foreground)' }}>
        <Link href={studiesIndexPath()} className="hover:text-primary transition-colors">
          Studies
        </Link>
        {header.studyName && (
          <>
            <ChevronRight className="w-3 h-3 flex-shrink-0" />
            <Link
              href={studyDetailPath(header.studyId)}
              className="hover:text-primary transition-colors truncate max-w-[180px]"
            >
              {header.studyName}
            </Link>
          </>
        )}
        <ChevronRight className="w-3 h-3 flex-shrink-0" />
        <span className="font-semibold" style={{ color: 'var(--foreground)' }}>
          Subject {header.subjectIdentifier}
        </span>
      </div>

      {/* Identity row */}
      <div className="flex items-center gap-4 px-6 py-3">
        {/* Avatar */}
        <div
          className="w-10 h-10 rounded-xl flex items-center justify-center text-sm font-bold text-white flex-shrink-0"
          style={{ backgroundColor: 'var(--primary)' }}
        >
          {initials}
        </div>

        {/* Subject info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-0.5">
            <span className="text-base font-semibold" style={{ color: 'var(--foreground)' }}>
              Subject {header.subjectIdentifier}
            </span>
            {/* Enrollment status */}
            <span className={`status-badge ${enrollmentStatusClass(header.enrollmentStatus)}`}>
              {header.enrollmentStatus.replace(/_/g, ' ')}
            </span>
            {/* Operational health */}
            {operationalHealth && (
              <span className={`status-badge ${healthToRisk(operationalHealth)}`}>
                {operationalHealth === 'healthy' ? 'Healthy' : operationalHealth === 'attention' ? 'Attention' : 'Critical'}
              </span>
            )}
          </div>
          <div className="flex items-center gap-4 text-xs" style={{ color: 'var(--muted-foreground)' }}>
            {header.studyName && (
              <span>{header.studyName}</span>
            )}
            {header.randomizationNumber && (
              <>
                <span>·</span>
                <span className="mono-id">Rand #{header.randomizationNumber}</span>
              </>
            )}
            {header.randomizationArm && (
              <>
                <span>·</span>
                <span>Arm {header.randomizationArm}</span>
              </>
            )}
            {header.initials && (
              <>
                <span>·</span>
                <span>Initials: {header.initials}</span>
              </>
            )}
          </div>
        </div>

        {/* Operational health full badge on the right */}
        {operationalHealth && (
          <SubjectHealthStatusBadge health={operationalHealth} />
        )}
      </div>
    </div>
  )
}
