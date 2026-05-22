import { join } from 'node:path'

const DEFAULT_INTAKE_REVIEW_ROOTS = [
  join(/*turbopackIgnore: true*/ process.cwd(), 'fixtures', 'intake-review'),
  join(/*turbopackIgnore: true*/ process.cwd(), '.phase12c-py-smoke'),
]

export function intakeReviewRoots(cwd?: string): string[] {
  return cwd
    ? [
        join(/*turbopackIgnore: true*/ cwd, 'fixtures', 'intake-review'),
        join(/*turbopackIgnore: true*/ cwd, '.phase12c-py-smoke'),
      ]
    : [...DEFAULT_INTAKE_REVIEW_ROOTS]
}

export function workspaceDir(draftKey: string): string
export function workspaceDir(cwd: string, draftKey: string): string
export function workspaceDir(cwdOrDraftKey: string, draftKey?: string): string {
  const cwd = draftKey === undefined
    ? /*turbopackIgnore: true*/ process.cwd()
    : cwdOrDraftKey
  const key = draftKey ?? cwdOrDraftKey
  return join(/*turbopackIgnore: true*/ cwd, 'data', 'intake-review-workspaces', key)
}
