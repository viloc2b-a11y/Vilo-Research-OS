'use client'

import {
  ACKNOWLEDGEMENT_TYPE,
  ACKNOWLEDGEMENT_TYPE_LABELS,
  ASSIGNED_ROLE_OPTIONS,
  OBLIGATION_TYPE,
  SIGNATURE_MEANING,
  SIGNATURE_MEANING_LABELS,
  type AcknowledgementType,
  type CreateObligationInput,
  type ObligationType,
  type SignatureMeaning,
} from '@/lib/document-intake/obligation-types'

export type ObligationDraft = CreateObligationInput & { key: string }

export function obligationDraftToPayload(draft: ObligationDraft): CreateObligationInput {
  const { key: _rowKey, ...payload } = draft
  void _rowKey
  return payload
}

type ObligationAssignmentRowProps = {
  draft: ObligationDraft
  onChange: (draft: ObligationDraft) => void
  onRemove: () => void
}

export function createEmptyObligationDraft(type: ObligationType = OBLIGATION_TYPE.SIGNATURE): ObligationDraft {
  return {
    key: crypto.randomUUID(),
    obligation_type: type,
    signature_meaning: type === OBLIGATION_TYPE.SIGNATURE ? SIGNATURE_MEANING.REVIEWED : null,
    acknowledgement_type: type === OBLIGATION_TYPE.ACKNOWLEDGEMENT ? ACKNOWLEDGEMENT_TYPE.PASSIVE : null,
    assigned_role: 'research_coordinator',
    assigned_user_id: null,
    due_date: null,
  }
}

export function ObligationAssignmentRow({ draft, onChange, onRemove }: ObligationAssignmentRowProps) {
  const isSignature = draft.obligation_type === OBLIGATION_TYPE.SIGNATURE

  return (
    <div className="space-y-3 rounded-md border border-slate-200 bg-slate-50 p-4">
      <div className="flex items-center justify-between gap-2">
        <span className="text-sm font-medium text-slate-800">
          {isSignature ? 'Request signature' : 'Request acknowledgement'}
        </span>
        <button
          type="button"
          onClick={onRemove}
          className="text-xs text-slate-500 hover:text-red-600"
        >
          Remove
        </button>
      </div>

      <div className="grid gap-3 md:grid-cols-2">
        <label className="grid gap-1 text-sm">
          <span className="font-medium text-slate-700">Type</span>
          <select
            className="rounded-md border border-slate-300 p-2 text-sm"
            value={draft.obligation_type}
            onChange={(e) => {
              const obligation_type = e.target.value as ObligationType
              onChange({
                ...draft,
                obligation_type,
                signature_meaning:
                  obligation_type === OBLIGATION_TYPE.SIGNATURE ? SIGNATURE_MEANING.REVIEWED : null,
                acknowledgement_type:
                  obligation_type === OBLIGATION_TYPE.ACKNOWLEDGEMENT
                    ? ACKNOWLEDGEMENT_TYPE.PASSIVE
                    : null,
              })
            }}
          >
            <option value={OBLIGATION_TYPE.SIGNATURE}>Request signature</option>
            <option value={OBLIGATION_TYPE.ACKNOWLEDGEMENT}>Request acknowledgement</option>
          </select>
        </label>

        {isSignature ? (
          <label className="grid gap-1 text-sm">
            <span className="font-medium text-slate-700">Signature meaning</span>
            <select
              className="rounded-md border border-slate-300 p-2 text-sm"
              value={draft.signature_meaning ?? ''}
              onChange={(e) =>
                onChange({ ...draft, signature_meaning: e.target.value as SignatureMeaning })
              }
            >
              {Object.entries(SIGNATURE_MEANING_LABELS).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </label>
        ) : (
          <label className="grid gap-1 text-sm">
            <span className="font-medium text-slate-700">Acknowledgement type</span>
            <select
              className="rounded-md border border-slate-300 p-2 text-sm"
              value={draft.acknowledgement_type ?? ''}
              onChange={(e) =>
                onChange({
                  ...draft,
                  acknowledgement_type: e.target.value as AcknowledgementType,
                })
              }
            >
              {Object.entries(ACKNOWLEDGEMENT_TYPE_LABELS).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </label>
        )}
      </div>

      <div className="grid gap-3 md:grid-cols-2">
        <label className="grid gap-1 text-sm">
          <span className="font-medium text-slate-700">Assign to role</span>
          <select
            className="rounded-md border border-slate-300 p-2 text-sm"
            value={draft.assigned_role ?? ''}
            onChange={(e) =>
              onChange({
                ...draft,
                assigned_role: e.target.value || null,
                assigned_user_id: e.target.value ? null : draft.assigned_user_id,
              })
            }
          >
            <option value="">— Role —</option>
            {ASSIGNED_ROLE_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>

        <label className="grid gap-1 text-sm">
          <span className="font-medium text-slate-700">Or assign to user id</span>
          <input
            type="text"
            className="rounded-md border border-slate-300 p-2 font-mono text-sm"
            placeholder="User UUID (optional)"
            value={draft.assigned_user_id ?? ''}
            onChange={(e) =>
              onChange({
                ...draft,
                assigned_user_id: e.target.value.trim() || null,
                assigned_role: e.target.value.trim() ? null : draft.assigned_role,
              })
            }
          />
        </label>
      </div>

      <label className="grid gap-1 text-sm">
        <span className="font-medium text-slate-700">Due date (optional)</span>
        <input
          type="date"
          className="rounded-md border border-slate-300 p-2 text-sm"
          value={draft.due_date?.slice(0, 10) ?? ''}
          onChange={(e) =>
            onChange({
              ...draft,
              due_date: e.target.value ? `${e.target.value}T23:59:59.000Z` : null,
            })
          }
        />
      </label>
    </div>
  )
}
