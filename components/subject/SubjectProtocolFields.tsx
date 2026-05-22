'use client'

import { useState } from 'react'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { isAnchorRole, SUBJECT_ROLE_OPTIONS } from '@/lib/studies/protocol-primitives'
import type { SubjectRoleKind } from '@/lib/subject/visits/types'

export type AnchorSubjectOption = {
  id: string
  label: string
}

export function SubjectProtocolFields({
  subjectRole = 'participant',
  householdId = '',
  anchorSubjectId = '',
  anchorOptions = [],
  showGenerateHousehold = true,
}: {
  subjectRole?: SubjectRoleKind | string
  householdId?: string
  anchorSubjectId?: string
  anchorOptions?: AnchorSubjectOption[]
  showGenerateHousehold?: boolean
}) {
  const [role, setRole] = useState(subjectRole)
  const showAnchor = isAnchorRole(role)

  return (
    <div className="rounded-md border border-border/60 p-4 space-y-4">
      <div>
        <p className="text-sm font-medium text-foreground">Protocol role & household</p>
        <p className="text-xs text-muted-foreground">
          For index + household contact studies. Leave defaults for standard single-participant protocols.
        </p>
      </div>
      <div className="grid gap-4 md:grid-cols-3">
        <div className="space-y-1">
          <Label htmlFor="subject_role">Subject role</Label>
          <select
            id="subject_role"
            name="subject_role"
            defaultValue={subjectRole}
            className="h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm"
            onChange={(e) => setRole(e.target.value)}
          >
            {SUBJECT_ROLE_OPTIONS.map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-1">
          <Label htmlFor="household_id">Household ID (UUID)</Label>
          <Input
            id="household_id"
            name="household_id"
            defaultValue={householdId}
            placeholder="Shared across related subjects"
          />
          {showGenerateHousehold ? (
            <label className="mt-1 flex items-center gap-2 text-xs text-muted-foreground">
              <input type="checkbox" name="generate_household" />
              Generate new household ID on save
            </label>
          ) : null}
        </div>
        {showAnchor ? (
          <div className="space-y-1">
            <Label htmlFor="anchor_subject_id">Anchor (index) subject</Label>
            {anchorOptions.length > 0 ? (
              <select
                id="anchor_subject_id"
                name="anchor_subject_id"
                defaultValue={anchorSubjectId}
                className="h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm"
              >
                <option value="">— None —</option>
                {anchorOptions.map((opt) => (
                  <option key={opt.id} value={opt.id}>
                    {opt.label}
                  </option>
                ))}
              </select>
            ) : (
              <Input
                id="anchor_subject_id"
                name="anchor_subject_id"
                defaultValue={anchorSubjectId}
                placeholder="Index subject UUID"
              />
            )}
            <p className="text-[10px] text-muted-foreground">
              Links this contact/caregiver to the index patient in the household.
            </p>
          </div>
        ) : null}
      </div>
    </div>
  )
}
