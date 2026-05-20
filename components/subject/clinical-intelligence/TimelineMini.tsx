// components/subject/clinical-intelligence/TimelineMini.tsx
// Phase 6E — Compact, collapsible clinical timeline.
// Client component: owns the expand/collapse state only.
// All data arrives as serialized props from the server.
'use client'

import { useState } from 'react'
import {
  Activity,
  AlertCircle,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  ClipboardList,
  Pill,
  Scissors,
  ShieldAlert,
  XCircle,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import type { ClinicalTimelineEvent, ClinicalTimelineEventType } from '@/lib/subject/clinical-intelligence/types'

// ---------------------------------------------------------------------------
// Icon map
// ---------------------------------------------------------------------------

const EVENT_ICONS: Record<ClinicalTimelineEventType, React.FC<{ className?: string }>> = {
  diagnosis_added: (p) => <ClipboardList {...p} />,
  diagnosis_resolved: (p) => <CheckCircle2 {...p} />,
  medication_started: (p) => <Pill {...p} />,
  medication_stopped: (p) => <XCircle {...p} />,
  allergy_added: (p) => <ShieldAlert {...p} />,
  surgery_added: (p) => <Scissors {...p} />,
  lifestyle_updated: (p) => <Activity {...p} />,
  ae_added: (p) => <AlertCircle {...p} />,
  protocol_event: (p) => <ClipboardList {...p} />,
}

const EVENT_COLORS: Record<ClinicalTimelineEventType, string> = {
  diagnosis_added: 'text-blue-600',
  diagnosis_resolved: 'text-green-600',
  medication_started: 'text-violet-600',
  medication_stopped: 'text-muted-foreground',
  allergy_added: 'text-amber-600',
  surgery_added: 'text-orange-600',
  lifestyle_updated: 'text-teal-600',
  ae_added: 'text-destructive',
  protocol_event: 'text-muted-foreground',
}

// ---------------------------------------------------------------------------
// Date formatter
// ---------------------------------------------------------------------------

function fmtDate(effective: string | null, captured: string): string {
  const iso = effective ?? captured
  try {
    return new Date(iso).toLocaleDateString(undefined, {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    })
  } catch {
    return iso.slice(0, 10)
  }
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

type TimelineMiniProps = {
  events: ClinicalTimelineEvent[]
  defaultVisible?: number
}

export function TimelineMini({ events, defaultVisible = 7 }: TimelineMiniProps) {
  const [expanded, setExpanded] = useState(false)

  if (events.length === 0) {
    return (
      <p className="text-xs text-muted-foreground italic">
        No clinical events recorded yet.
      </p>
    )
  }

  const visible = expanded ? events : events.slice(0, defaultVisible)
  const hasMore = events.length > defaultVisible

  return (
    <div className="space-y-1">
      {visible.map((event, i) => {
        const Icon = EVENT_ICONS[event.eventType]
        const colorClass = EVENT_COLORS[event.eventType]

        return (
          <div key={`${event.entityId}-${event.eventType}-${i}`} className="flex items-start gap-2.5">
            {/* Spine line */}
            <div className="flex flex-col items-center shrink-0">
              <div className={`mt-0.5 rounded-full p-0.5 ${colorClass}`}>
                <Icon className="h-3 w-3" />
              </div>
              {i < visible.length - 1 && (
                <div className="w-px flex-1 bg-border mt-1" style={{ minHeight: 12 }} />
              )}
            </div>

            {/* Content */}
            <div className="pb-2 min-w-0">
              <p className="text-xs leading-snug text-foreground">{event.label}</p>
              <p className="text-[10px] text-muted-foreground mt-0.5">
                {event.effectiveDate
                  ? fmtDate(event.effectiveDate, event.capturedAt)
                  : `Documented ${fmtDate(null, event.capturedAt)}`}
                {event.source ? ` · ${event.source}` : ''}
              </p>
            </div>
          </div>
        )
      })}

      {hasMore && (
        <Button
          variant="ghost"
          size="sm"
          className="h-6 px-1 text-xs text-muted-foreground"
          onClick={() => setExpanded((v) => !v)}
        >
          {expanded ? (
            <><ChevronUp className="mr-1 h-3 w-3" />Show fewer</>
          ) : (
            <><ChevronDown className="mr-1 h-3 w-3" />{events.length - defaultVisible} more events</>
          )}
        </Button>
      )}
    </div>
  )
}
