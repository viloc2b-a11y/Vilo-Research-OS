'use client'

import { useState, useTransition } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import type { ReviewableItem, ReviewItemState, ReviewerStatus } from '@/lib/protocol-intake-review/types'
import { updateReviewItemAction } from '@/lib/protocol-intake-review/actions'
import { EvidenceBlock } from '@/components/source-builder/intake-review/evidence-block'
import { resolvedFieldValue } from '@/lib/protocol-intake-review/resolve'

const STATUS_LABEL: Record<ReviewerStatus, string> = {
  pending: 'Pending',
  accepted: 'Accepted',
  edited: 'Edited',
  rejected: 'Rejected',
  needs_clarification: 'Needs clarification',
}

export function ReviewItemCard(props: {
  draft_key: string
  item: ReviewableItem
  state: ReviewItemState
  onUpdated: () => void
}) {
  const { draft_key, item, state, onUpdated } = props
  const [pending, startTransition] = useTransition()
  const [editing, setEditing] = useState<string | null>(null)
  const [editValue, setEditValue] = useState('')
  const [editReason, setEditReason] = useState('')

  function run(action: () => Promise<unknown>) {
    startTransition(async () => {
      await action()
      onUpdated()
    })
  }

  function startEdit(fieldKey: string, current: unknown) {
    setEditing(fieldKey)
    setEditValue(
      typeof current === 'object' ? JSON.stringify(current) : String(current ?? ''),
    )
    setEditReason('')
  }

  return (
    <div className="rounded-lg border border-border p-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h4 className="font-medium text-foreground">{item.title}</h4>
          <div className="mt-1 flex flex-wrap gap-1">
            <Badge variant="outline">{STATUS_LABEL[state.reviewer_status]}</Badge>
            {state.evidence_insufficient ? (
              <Badge variant="outline" className="border-amber-500/50 text-amber-800">
                Evidence insufficient
              </Badge>
            ) : null}
          </div>
        </div>
        <div className="flex flex-wrap gap-1">
          <Button
            size="sm"
            variant="outline"
            disabled={pending}
            onClick={() =>
              run(() =>
                updateReviewItemAction({
                  draft_key,
                  item_id: item.item_id,
                  reviewer_status: 'accepted',
                }),
              )
            }
          >
            Accept
          </Button>
          <Button
            size="sm"
            variant="outline"
            disabled={pending}
            onClick={() =>
              run(() =>
                updateReviewItemAction({
                  draft_key,
                  item_id: item.item_id,
                  reviewer_status: 'rejected',
                }),
              )
            }
          >
            Reject
          </Button>
          <Button
            size="sm"
            variant="ghost"
            disabled={pending}
            onClick={() =>
              run(() =>
                updateReviewItemAction({
                  draft_key,
                  item_id: item.item_id,
                  evidence_insufficient: !state.evidence_insufficient,
                }),
              )
            }
          >
            {state.evidence_insufficient ? 'Clear evidence flag' : 'Evidence insufficient'}
          </Button>
        </div>
      </div>

      <div className="mt-3 space-y-3">
        {item.fields.map((field) => {
          const current = resolvedFieldValue(state, field.field_key, field.original_extracted_value)
          const display =
            typeof current === 'object' ? JSON.stringify(current) : String(current ?? '—')
          const originalDisplay =
            typeof field.original_extracted_value === 'object'
              ? JSON.stringify(field.original_extracted_value)
              : String(field.original_extracted_value ?? '—')
          const changed = display !== originalDisplay

          return (
            <div key={field.field_key} className="text-sm">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="font-medium capitalize">{field.label}</span>
                {item.fields.length > 0 && item.section !== 'missing' ? (
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-7 text-xs"
                    onClick={() => startEdit(field.field_key, current)}
                  >
                    Edit
                  </Button>
                ) : null}
              </div>
              <p className="mt-1 text-foreground">{display}</p>
              {changed ? (
                <p className="text-xs text-muted-foreground">
                  Original extracted: {originalDisplay}
                </p>
              ) : null}
              <EvidenceBlock
                evidence_refs={field.evidence_refs}
                confidence={field.confidence}
                extraction_method={field.extraction_method}
                requires_human_review={field.requires_human_review}
              />
              {editing === field.field_key ? (
                <div className="mt-2 space-y-2 rounded border border-dashed p-2">
                  <Input value={editValue} onChange={(e) => setEditValue(e.target.value)} />
                  <Textarea
                    placeholder="Reason for edit (required if value changes)"
                    value={editReason}
                    onChange={(e) => setEditReason(e.target.value)}
                    rows={2}
                  />
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      disabled={pending}
                      onClick={() =>
                        run(() =>
                          updateReviewItemAction({
                            draft_key,
                            item_id: item.item_id,
                            field_key: field.field_key,
                            edited_value: editValue,
                            edit_reason: editReason,
                          }).then(() => setEditing(null)),
                        )
                      }
                    >
                      Save edit
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => setEditing(null)}>
                      Cancel
                    </Button>
                  </div>
                </div>
              ) : null}
            </div>
          )
        })}
      </div>
    </div>
  )
}
