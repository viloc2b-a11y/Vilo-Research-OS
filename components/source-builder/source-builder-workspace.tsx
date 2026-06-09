'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { DraftHeader } from '@/components/source-builder/draft-header'
import { DraftActions } from '@/components/source-builder/draft-actions'
import { FieldEditorPanel } from '@/components/source-builder/field-editor-panel'
import { ProcedureLibraryPanel } from '@/components/source-builder/procedure-library-panel'
import { VisitBuilderPanel } from '@/components/source-builder/visit-builder-panel'
import { VisitProcedureMatrix } from '@/components/source-builder/visit-procedure-matrix'
import {
  createSourceBuilderDraftAction,
  loadSourceBuilderDraftAction,
  saveSourceBuilderDraftAction,
} from '@/lib/source-builder/draft-actions-server'
import {
  createEmptyDraft,
  loadDraft as loadLocalDraft,
  saveDraft as saveLocalDraft,
} from '@/lib/source-builder/draft-storage'
import {
  createCustomProcedure,
  createProcedureFromProfile,
} from '@/lib/source-builder/procedure-library'
import type {
  DraftField,
  ProcedureLibraryBundle,
  SourceBuilderDraft,
} from '@/lib/source-builder/types'

type SourceBuilderWorkspaceProps = {
  library: ProcedureLibraryBundle
  initialDraftId?: string | null
  organizationId?: string | null
}

export function SourceBuilderWorkspace({
  library,
  initialDraftId,
  organizationId = null,
}: SourceBuilderWorkspaceProps) {
  const [draft, setDraft] = useState<SourceBuilderDraft | null>(null)
  const [selectedProcedureId, setSelectedProcedureId] = useState<string | null>(null)
  const [savedMessage, setSavedMessage] = useState<string | null>(null)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [serverPersisted, setServerPersisted] = useState(false)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false

    async function loadInitial() {
      setLoading(true)
      setSaveError(null)

      if (initialDraftId && organizationId) {
        const result = await loadSourceBuilderDraftAction(initialDraftId, organizationId)
        if (!cancelled && result.ok) {
          setDraft(result.data)
          setServerPersisted(true)
          setLoading(false)
          return
        }
      }

      if (initialDraftId) {
        const local = loadLocalDraft(initialDraftId)
        if (!cancelled && local) {
          setDraft(local)
          setServerPersisted(false)
          setLoading(false)
          return
        }
      }

      if (!cancelled) {
        setDraft(createEmptyDraft())
        setServerPersisted(false)
        setLoading(false)
      }
    }

    void loadInitial()
    return () => {
      cancelled = true
    }
  }, [initialDraftId, organizationId])

  const patchDraft = useCallback((patch: Partial<SourceBuilderDraft>) => {
    setDraft((d) => (d ? { ...d, ...patch } : d))
    setSavedMessage(null)
    setSaveError(null)
  }, [])

  const attachedCodes = useMemo(() => {
    const codes = new Set<string>()
    if (!draft) return codes
    for (const p of draft.procedures) {
      if (p.profileCode) codes.add(p.profileCode)
    }
    return codes
  }, [draft])

  function handleAttach(profileCode: string) {
    if (!draft) return
    const proc = createProcedureFromProfile(library, profileCode)
    if (!proc) return
    setDraft({
      ...draft,
      procedures: [...draft.procedures, proc],
    })
    setSelectedProcedureId(proc.id)
  }

  function handleAddCustom(name: string, uiCategory: string) {
    if (!draft) return
    const proc = createCustomProcedure(name, uiCategory)
    setDraft({
      ...draft,
      procedures: [...draft.procedures, proc],
    })
    setSelectedProcedureId(proc.id)
  }

  async function handleSave() {
    if (!draft) return
    setSaving(true)
    setSaveError(null)
    setSavedMessage(null)

    try {
      if (organizationId) {
        const result = serverPersisted
          ? await saveSourceBuilderDraftAction(draft, organizationId)
          : await createSourceBuilderDraftAction(draft, organizationId)

        if (!result.ok) {
          setSaveError(result.error)
          return
        }

        setDraft(result.data)
        setServerPersisted(true)
        setSavedMessage('Draft saved to your organization.')
        if (typeof window !== 'undefined' && window.location.pathname.endsWith('/manual')) {
          window.history.replaceState(
            null,
            '',
            `/source-builder/manual?draft=${result.data.id}`,
          )
        }
        return
      }

      const saved = saveLocalDraft(draft)
      setDraft(saved)
      setSavedMessage('Draft saved locally (sign in with an organization to sync across devices).')
      if (typeof window !== 'undefined' && window.location.pathname.endsWith('/manual')) {
        window.history.replaceState(null, '', `/source-builder/manual?draft=${saved.id}`)
      }
    } finally {
      setSaving(false)
    }
  }

  if (loading || !draft) {
    return <p className="text-sm text-muted-foreground">Loading workspace…</p>
  }

  const hasActiveDraft = Boolean(draft.id)

  return (
    <div className="space-y-6">
      <p className="text-sm text-muted-foreground">
        <Link href="/source-builder" className="hover:underline">
          Source builder
        </Link>
        <span aria-hidden className="px-2">
          /
        </span>
        <span className="text-foreground">Manual draft</span>
      </p>

      <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border bg-card px-4 py-3 text-sm">
        <div className="flex flex-wrap items-center gap-2 text-muted-foreground">
          <span className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
            Draft status
          </span>
          {hasActiveDraft ? (
            <span className="inline-flex items-center rounded-full bg-teal-50 px-2.5 py-1 text-xs font-semibold text-teal-800 ring-1 ring-inset ring-teal-200">
              Active: {draft.id}
            </span>
          ) : (
            <span className="inline-flex items-center rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-600">
              No active draft
            </span>
          )}
        </div>
        <p className="text-xs text-muted-foreground">
          {organizationId
            ? 'Organization persistence enabled.'
            : 'Browser persistence only until you sign in.'}
        </p>
      </div>

      <DraftHeader draft={draft} onChange={patchDraft} />

      <DraftActions
        draft={draft}
        onSave={() => void handleSave()}
        savedMessage={savedMessage}
        saveError={saveError}
        saving={saving}
        persistenceMode={organizationId ? 'server' : 'local'}
      />

      <div className="grid gap-6 xl:grid-cols-2">
        <VisitBuilderPanel
          visits={draft.visits}
          onChange={(visits) => patchDraft({ visits })}
        />
        <ProcedureLibraryPanel
          library={library}
          attachedCodes={attachedCodes}
          onAttach={handleAttach}
          onAddCustom={handleAddCustom}
        />
      </div>

      <VisitProcedureMatrix
        visits={draft.visits}
        procedures={draft.procedures}
        matrix={draft.matrix}
        onChange={(matrix) => patchDraft({ matrix })}
      />

      <FieldEditorPanel
        procedures={draft.procedures}
        selectedProcedureId={selectedProcedureId}
        onSelectProcedure={setSelectedProcedureId}
        onUpdateProcedure={(procedureId, fields: DraftField[]) => {
          setDraft({
            ...draft,
            procedures: draft.procedures.map((p) =>
              p.id === procedureId ? { ...p, fields } : p,
            ),
          })
          setSavedMessage(null)
          setSaveError(null)
        }}
        onRenameProcedure={(procedureId, displayName) => {
          setDraft({
            ...draft,
            procedures: draft.procedures.map((p) =>
              p.id === procedureId ? { ...p, displayName } : p,
            ),
          })
        }}
      />

      <aside className="rounded-md border border-dashed bg-muted/40 p-4 text-sm text-muted-foreground">
        <strong className="text-foreground">Architecture note:</strong>{' '}
        {organizationId
          ? 'Drafts are stored in your organization workspace (Supabase). They do not affect capture runtime until publish (Phase 6A.6).'
          : 'No organization session — drafts are stored in this browser only. Sign in to sync across devices.'}{' '}
        Pipeline: Draft → Review → Publish → existing CPST / publish_source_package.
      </aside>
    </div>
  )
}
