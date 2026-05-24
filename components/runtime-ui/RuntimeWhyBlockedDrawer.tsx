'use client'

import { useState } from 'react'
import { ChevronDown, HelpCircle } from 'lucide-react'
import type { RuntimeUiWhyBlocked } from '@/lib/runtime-ui/types'
import { MAX_PRIMARY_CAUSES_SHOWN } from '@/lib/runtime-ui/guardrails'

export function RuntimeWhyBlockedDrawer({ whyBlocked }: { whyBlocked: RuntimeUiWhyBlocked }) {
  const [open, setOpen] = useState(whyBlocked.blocked)

  if (!whyBlocked.blocked && whyBlocked.primaryCauses.length === 0) {
    return null
  }

  return (
    <div className="rounded-lg border border-border bg-card">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between gap-2 px-4 py-3 text-left text-sm font-medium text-foreground hover:bg-muted/40"
        aria-expanded={open}
      >
        <span className="flex items-center gap-2">
          <HelpCircle className="size-4 text-muted-foreground" />
          Why blocked?
        </span>
        <ChevronDown className={`size-4 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>
      {open ? (
        <div className="border-t border-border px-4 py-3 space-y-3">
          <p className="text-xs text-muted-foreground">
            Readiness: <span className="font-medium capitalize">{whyBlocked.readinessStatus}</span>
          </p>
          {whyBlocked.primaryCauses.length > 0 ? (
            <div>
              <p className="text-[10px] font-semibold uppercase text-muted-foreground">Primary causes</p>
              <ul className="mt-1 list-inside list-disc text-xs text-foreground">
                {whyBlocked.primaryCauses.slice(0, MAX_PRIMARY_CAUSES_SHOWN).map((c) => (
                  <li key={c}>{c}</li>
                ))}
              </ul>
            </div>
          ) : null}
          {whyBlocked.blockerRows.length > 0 ? (
            <ul className="space-y-1.5">
              {whyBlocked.blockerRows.map((b) => (
                <li key={b.id} className="rounded border border-border/60 px-2 py-1.5 text-xs">
                  <span className="font-medium">{b.label}</span>
                  <span className="text-muted-foreground"> — {b.detail}</span>
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      ) : null}
    </div>
  )
}
