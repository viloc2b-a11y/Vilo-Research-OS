/**
 * Client-side draft persistence fallback when no organization session is available.
 */

import type { SourceBuilderDraft } from './types'
import { newId } from './procedure-library'

const STORAGE_KEY = 'vilo-source-builder-drafts-v1'

type DraftIndex = { id: string; name: string; lastSavedAt: string | null }[]

function readIndex(): DraftIndex {
  if (typeof window === 'undefined') return []
  try {
    const raw = localStorage.getItem(`${STORAGE_KEY}-index`)
    return raw ? (JSON.parse(raw) as DraftIndex) : []
  } catch {
    return []
  }
}

function writeIndex(index: DraftIndex) {
  localStorage.setItem(`${STORAGE_KEY}-index`, JSON.stringify(index))
}

export function listDraftSummaries(): DraftIndex {
  return readIndex().sort((a, b) => {
    const ta = a.lastSavedAt ? Date.parse(a.lastSavedAt) : 0
    const tb = b.lastSavedAt ? Date.parse(b.lastSavedAt) : 0
    return tb - ta
  })
}

export function loadDraft(id: string): SourceBuilderDraft | null {
  if (typeof window === 'undefined') return null
  try {
    const raw = localStorage.getItem(`${STORAGE_KEY}-${id}`)
    return raw ? (JSON.parse(raw) as SourceBuilderDraft) : null
  } catch {
    return null
  }
}

export function saveDraft(draft: SourceBuilderDraft): SourceBuilderDraft {
  const updated: SourceBuilderDraft = {
    ...draft,
    lastSavedAt: new Date().toISOString(),
    version: draft.version + 1,
  }
  localStorage.setItem(`${STORAGE_KEY}-${updated.id}`, JSON.stringify(updated))
  const index = readIndex().filter((d) => d.id !== updated.id)
  index.push({
    id: updated.id,
    name: updated.name,
    lastSavedAt: updated.lastSavedAt,
  })
  writeIndex(index)
  return updated
}

export function createEmptyDraft(name?: string): SourceBuilderDraft {
  return {
    id: newId(),
    name: name ?? 'New study source draft',
    protocolNickname: '',
    description: '',
    status: 'draft',
    lastSavedAt: null,
    visits: [],
    procedures: [],
    matrix: [],
    version: 0,
  }
}

export function deleteDraft(id: string) {
  localStorage.removeItem(`${STORAGE_KEY}-${id}`)
  writeIndex(readIndex().filter((d) => d.id !== id))
}

export const VISIT_PRESETS = [
  { name: 'Visit 1', visitType: 'scheduled', studyDay: '1', window: '' },
  { name: 'Visit 2', visitType: 'scheduled', studyDay: '14', window: '±3 days' },
  { name: 'Visit 3', visitType: 'scheduled', studyDay: '28', window: '±3 days' },
  { name: 'Follow-up Visit', visitType: 'scheduled', studyDay: '', window: '' },
  { name: 'EOS Visit', visitType: 'eos', studyDay: '', window: '' },
  { name: 'Phone Visit', visitType: 'phone', studyDay: '', window: '' },
  { name: 'Unscheduled Visit', visitType: 'unscheduled', studyDay: '', window: '' },
] as const
