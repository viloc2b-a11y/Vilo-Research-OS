// components/subject/clinical-intelligence/ClinicalRiskPanel.tsx
// Phase 6E — Clinical Intelligence surface panel.
//
// Server component. Receives LongitudinalClinicalProfile as props (no DB calls here).
// Renders:
//   1. Summary stat row    — active conditions / meds / allergies / surgeries
//   2. Risk flags section  — severity-colored flags with rationale
//   3. Recent activity     — collapsible mini timeline (client sub-component)
//
// Design rules:
//   - Read-only — no actions, no verify buttons, no mutations
//   - Internal site staff only — panel is shown when canVerify=true OR always
//     (it's informational, not restricted)
//   - No CRA tooling, no sponsor workflows

import {
  AlertCircle,
  AlertTriangle,
  Info,
  Pill,
  Scissors,
  ShieldAlert,
  Stethoscope,
  Zap,
} from 'lucide-react'
import { TimelineMini } from './TimelineMini'
import type { LongitudinalClinicalProfile, ClinicalRiskFlag } from '@/lib/subject/clinical-intelligence/types'

// ---------------------------------------------------------------------------
// Stat row
// ---------------------------------------------------------------------------

function StatCard({
  icon,
  count,
  label,
  warn,
}: {
  icon: React.ReactNode
  count: number
  label: string
  warn?: boolean
}) {
  return (
    <div
      className={`flex items-center gap-2 rounded-md border px-3 py-2 ${
        warn && count > 0 ? 'border-amber-300 bg-amber-50 dark:border-amber-800 dark:bg-amber-950/30' : 'bg-muted/20'
      }`}
    >
      <span className={`shrink-0 ${warn && count > 0 ? 'text-amber-600' : 'text-muted-foreground'}`}>
        {icon}
      </span>
      <div>
        <p className="text-base font-semibold leading-none">{count}</p>
        <p className="text-[10px] text-muted-foreground mt-0.5">{label}</p>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Risk flag card
// ---------------------------------------------------------------------------

const FLAG_CONFIG: Record<
  string,
  { bgClass: string; borderClass: string; textClass: string; Icon: React.FC<{ className?: string }> }
> = {
  critical: {
    bgClass: 'bg-destructive/5',
    borderClass: 'border-l-destructive/60',
    textClass: 'text-destructive',
    Icon: (p) => <AlertCircle {...p} />,
  },
  warning: {
    bgClass: 'bg-amber-50 dark:bg-amber-950/20',
    borderClass: 'border-l-amber-400',
    textClass: 'text-amber-700 dark:text-amber-400',
    Icon: (p) => <AlertTriangle {...p} />,
  },
  info: {
    bgClass: 'bg-blue-50 dark:bg-blue-950/20',
    borderClass: 'border-l-blue-400',
    textClass: 'text-blue-700 dark:text-blue-400',
    Icon: (p) => <Info {...p} />,
  },
}

function RiskFlagCard({ flag }: { flag: ClinicalRiskFlag }) {
  const cfg = FLAG_CONFIG[flag.severity] ?? FLAG_CONFIG.info
  const { Icon } = cfg

  return (
    <div
      className={`rounded-md border border-l-4 px-3 py-2 ${cfg.bgClass} ${cfg.borderClass}`}
    >
      <div className="flex items-start gap-2">
        <Icon className={`mt-0.5 h-3.5 w-3.5 shrink-0 ${cfg.textClass}`} />
        <div className="min-w-0">
          <p className={`text-xs font-medium ${cfg.textClass}`}>{flag.label}</p>
          <p className="text-xs text-muted-foreground mt-0.5 leading-snug">{flag.rationale}</p>
        </div>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Section header
// ---------------------------------------------------------------------------

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <h4 className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
      {children}
    </h4>
  )
}

// ---------------------------------------------------------------------------
// Main panel
// ---------------------------------------------------------------------------

type ClinicalRiskPanelProps = {
  longitudinal: LongitudinalClinicalProfile
}

export function ClinicalRiskPanel({ longitudinal }: ClinicalRiskPanelProps) {
  const {
    activeConditionCount,
    activeMedicationCount,
    activeAllergyCount,
    surgeryCount,
    riskFlags,
    timeline,
    hasSevereAllergies,
    hasAnticoagulants,
  } = longitudinal

  const criticalCount = riskFlags.filter((f) => f.severity === 'critical').length
  const warningCount = riskFlags.filter((f) => f.severity === 'warning').length

  return (
    <div className="rounded-lg border bg-card shadow-sm overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between border-b px-4 py-2.5 bg-muted/30">
        <div className="flex items-center gap-2">
          <Zap className="h-3.5 w-3.5 text-muted-foreground" />
          <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Clinical Intelligence
          </span>
        </div>
        <div className="flex items-center gap-1.5">
          {criticalCount > 0 && (
            <span className="inline-flex items-center gap-1 rounded-full bg-destructive/10 px-2 py-0.5 text-[10px] font-semibold text-destructive">
              <AlertCircle className="h-2.5 w-2.5" />
              {criticalCount} critical
            </span>
          )}
          {warningCount > 0 && (
            <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 dark:bg-amber-900/30 px-2 py-0.5 text-[10px] font-semibold text-amber-700 dark:text-amber-400">
              <AlertTriangle className="h-2.5 w-2.5" />
              {warningCount} warning{warningCount > 1 ? 's' : ''}
            </span>
          )}
          {riskFlags.length === 0 && (
            <span className="inline-flex items-center gap-1 rounded-full bg-green-100 dark:bg-green-900/30 px-2 py-0.5 text-[10px] font-semibold text-green-700 dark:text-green-400">
              No flags
            </span>
          )}
        </div>
      </div>

      <div className="p-4 space-y-4">
        {/* Summary stats */}
        <div>
          <SectionLabel>Active Summary</SectionLabel>
          <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-4">
            <StatCard
              icon={<Stethoscope className="h-3.5 w-3.5" />}
              count={activeConditionCount}
              label="Conditions"
            />
            <StatCard
              icon={<Pill className="h-3.5 w-3.5" />}
              count={activeMedicationCount}
              label="Active meds"
              warn={hasAnticoagulants}
            />
            <StatCard
              icon={<ShieldAlert className="h-3.5 w-3.5" />}
              count={activeAllergyCount}
              label="Allergies"
              warn={hasSevereAllergies}
            />
            <StatCard
              icon={<Scissors className="h-3.5 w-3.5" />}
              count={surgeryCount}
              label="Surgeries"
            />
          </div>
        </div>

        {/* Risk flags */}
        <div>
          <SectionLabel>
            Risk Flags
            {riskFlags.length > 0 ? ` · ${riskFlags.length}` : ''}
          </SectionLabel>
          <div className="mt-2 space-y-2">
            {riskFlags.length === 0 ? (
              <p className="text-xs text-muted-foreground italic">
                No risk flags detected based on current profile data.
              </p>
            ) : (
              riskFlags.map((flag) => (
                <RiskFlagCard key={flag.id} flag={flag} />
              ))
            )}
          </div>
        </div>

        {/* Recent activity */}
        {timeline.length > 0 && (
          <div>
            <SectionLabel>
              Recent Activity · {timeline.length} event{timeline.length !== 1 ? 's' : ''}
            </SectionLabel>
            <div className="mt-2">
              {/* Timeline reversed so most recent first */}
              <TimelineMini events={[...timeline].reverse()} defaultVisible={6} />
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
