import { join } from 'node:path'

export function canLoadIntakeReviewFixtures(): boolean {
  return process.env.NODE_ENV !== 'production'
}

export function intakeReviewRoots(cwd?: string): string[] {
  if (!canLoadIntakeReviewFixtures()) return []
  const root = cwd ?? process.cwd()
  return [
    join(root, 'fixtures', 'intake-review'),
    join(root, '.phase12c-py-smoke'),
  ]
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
