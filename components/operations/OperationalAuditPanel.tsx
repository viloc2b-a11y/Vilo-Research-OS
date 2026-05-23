import { Clock, ShieldAlert, FileText, User } from 'lucide-react'
import type { OperationalChronologyRow } from '@/lib/operations/loadOperationalChronology'

function formatSafeSummary(event: OperationalChronologyRow): string {
  // Try to extract a safe human summary without exposing unblinded raw data
  // payload is already filtered/redacted by loadOperationalChronology
  const p = event.payload
  if (typeof p.reason === 'string') return p.reason
  if (typeof p.note_preview === 'string') return p.note_preview
  if (typeof p.file_name === 'string') return p.file_name
  if (typeof p.status === 'string') return p.status
  if (typeof p.title === 'string') return p.title
  return 'System action recorded.'
}

export function OperationalAuditPanel({
  events,
  title = 'Operational Audit Trail',
}: {
  events: OperationalChronologyRow[]
  title?: string
}) {
  return (
    <div className="vilo-card overflow-hidden">
      <div className="p-4 border-b border-border bg-muted/30">
        <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
          <Clock className="w-4 h-4 text-primary" />
          {title}
        </h3>
        <p className="text-xs text-muted-foreground mt-1">
          Append-only, ALCOA+ compliant operational event stream.
        </p>
      </div>

      {events.length === 0 ? (
        <div className="p-8 text-center text-sm text-muted-foreground">
          No audit events recorded yet.
        </div>
      ) : (
        <div className="divide-y divide-border/60">
          {events.map((event) => {
            const isCritical =
              event.eventType.includes('LOCKED') ||
              event.eventType.includes('SIGNED') ||
              event.eventType.includes('REOPENED')

            return (
              <div key={event.id} className="p-4 hover:bg-muted/20 transition-colors">
                <div className="flex items-center justify-between mb-1">
                  <span
                    className={`text-xs font-semibold ${
                      isCritical ? 'text-primary' : 'text-foreground'
                    }`}
                  >
                    {event.eventType.replace(/_/g, ' ')}
                  </span>
                  <span className="text-[10px] text-muted-foreground tabular-nums">
                    {new Date(event.occurredAt).toLocaleString()}
                  </span>
                </div>
                
                <p className="text-xs text-muted-foreground mb-2">
                  {formatSafeSummary(event)}
                </p>

                <div className="flex items-center gap-3 text-[10px] text-muted-foreground mt-2">
                  {event.actorUserId && (
                    <span className="flex items-center gap-1 bg-accent px-1.5 py-0.5 rounded">
                      <User className="w-3 h-3" /> User {event.actorUserId.slice(0, 6)}
                    </span>
                  )}
                  {event.procedureExecutionId && (
                    <span className="flex items-center gap-1 bg-accent px-1.5 py-0.5 rounded">
                      <FileText className="w-3 h-3" /> Proc {event.procedureExecutionId.slice(0, 6)}
                    </span>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
