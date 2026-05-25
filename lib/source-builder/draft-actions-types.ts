export type SourceBuilderDraftSummary = {
  id: string
  name: string
  studyNickname: string | null
  lastSavedAt: string | null
}

export type SourceBuilderDraftActionResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: string }
