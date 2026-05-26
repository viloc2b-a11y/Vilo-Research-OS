'use client'

import { useState } from 'react'
import type { StudyRuntimeGraphJson } from '@/lib/study-runtime-composition/runtime-composition-types'

type CompileRuntimeButtonProps = {
  organizationId: string
  studyId: string
  onCompiled: (graph: StudyRuntimeGraphJson, graphHash: string) => void
}

export function CompileRuntimeButton({
  organizationId,
  studyId,
  onCompiled,
}: CompileRuntimeButtonProps) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleCompile() {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/study-runtime/compile', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          organization_id: organizationId,
          study_id: studyId,
          persist_snapshot: true,
        }),
      })
      const data = (await res.json()) as {
        graph?: StudyRuntimeGraphJson
        graphHash?: string
        error?: string
      }
      if (!res.ok || !data.graph || !data.graphHash) {
        throw new Error(data.error || 'Compile failed')
      }
      onCompiled(data.graph, data.graphHash)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Compile failed')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex flex-col items-start gap-1">
      <button
        type="button"
        disabled={loading}
        onClick={() => void handleCompile()}
        className="rounded-md bg-emerald-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-emerald-500 disabled:opacity-50"
      >
        {loading ? 'Compiling…' : 'Compile runtime graph'}
      </button>
      {error ? <span className="text-xs text-red-600">{error}</span> : null}
    </div>
  )
}
