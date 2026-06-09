'use client'

import { useMemo, useState } from 'react'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import type { ProcedureLibraryBundle } from '@/lib/source-builder/types'

type ProcedureLibraryPanelProps = {
  library: ProcedureLibraryBundle
  attachedCodes: Set<string>
  onAttach: (profileCode: string) => void
  onAddCustom: (name: string, uiCategory: string) => void
}

export function ProcedureLibraryPanel({
  library,
  attachedCodes,
  onAttach,
  onAddCustom,
}: ProcedureLibraryPanelProps) {
  const [customName, setCustomName] = useState('')
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()

  const query = searchParams.get('procedure_q') ?? ''
  const category = searchParams.get('procedure_category') ?? 'all'

  const hasActiveFilter = Boolean(query.trim()) || category !== 'all'

  function updateUrl(nextQuery: string, nextCategory: string) {
    const params = new URLSearchParams(searchParams.toString())
    if (nextQuery.trim()) {
      params.set('procedure_q', nextQuery.trim())
    } else {
      params.delete('procedure_q')
    }
    if (nextCategory && nextCategory !== 'all') {
      params.set('procedure_category', nextCategory)
    } else {
      params.delete('procedure_category')
    }
    router.replace(params.toString() ? `${pathname}?${params.toString()}` : pathname, {
      scroll: false,
    })
  }

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    return library.profiles.filter((p) => {
      if (category !== 'all' && p.uiCategory !== category) return false
      if (!q) return true
      return (
        p.display_name.toLowerCase().includes(q) ||
        p.procedure_profile_code.toLowerCase().includes(q)
      )
    })
  }, [library.profiles, query, category])

  const grouped = useMemo(() => {
    const map = new Map<string, typeof filtered>()
    for (const p of filtered) {
      const list = map.get(p.uiCategory) ?? []
      list.push(p)
      map.set(p.uiCategory, list)
    }
    return [...map.entries()]
  }, [filtered])

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">Procedure library</CardTitle>
        <CardDescription>
          Reusable documentation profiles ({library.profiles.length} procedures). Attach to draft,
          then assign to visits in the matrix.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-col gap-2 sm:flex-row">
          <Input
            placeholder="Search procedures…"
            value={query}
            onChange={(e) => updateUrl(e.target.value, category)}
            className="sm:flex-1"
          />
          <select
            className="h-9 rounded-md border border-input bg-transparent px-3 text-sm"
            value={category}
            onChange={(e) => updateUrl(query, e.target.value)}
          >
            <option value="all">All categories</option>
            {library.uiCategories.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </div>

        <div className="flex items-center justify-between gap-3 rounded-md border border-slate-200 bg-slate-50/80 px-3 py-2 text-sm">
          <div className="flex flex-wrap items-center gap-2 text-slate-600">
            <span className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
              Filter status
            </span>
            {hasActiveFilter ? (
              <span className="inline-flex items-center rounded-full bg-teal-50 px-2.5 py-1 text-xs font-semibold text-teal-800 ring-1 ring-inset ring-teal-200">
                Active: {query.trim() || 'search'}
                {category !== 'all' ? ` · ${category}` : ''}
              </span>
            ) : (
              <span className="inline-flex items-center rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-600">
                No active filter
              </span>
            )}
          </div>
          {hasActiveFilter ? (
            <button
              type="button"
              className="rounded-md border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
              onClick={() => updateUrl('', 'all')}
            >
              Clear filter
            </button>
          ) : null}
        </div>

        <section className="flex flex-wrap gap-2 border-b pb-3">
          <Input
            placeholder="Custom procedure name"
            value={customName}
            onChange={(e) => setCustomName(e.target.value)}
            className="max-w-xs"
          />
          <Button
            type="button"
            size="sm"
            variant="secondary"
            disabled={!customName.trim()}
            onClick={() => {
              onAddCustom(customName.trim(), 'Protocol Procedures')
              setCustomName('')
            }}
          >
            Add custom procedure
          </Button>
        </section>

        <div className="max-h-[420px] space-y-4 overflow-y-auto pr-1">
          {grouped.map(([cat, items]) => (
            <section key={cat}>
              <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                {cat}
              </h3>
              <ul className="space-y-1">
                {items.map((p) => {
                  const attached = attachedCodes.has(p.procedure_profile_code)
                  return (
                    <li
                      key={p.procedure_profile_code}
                      className="flex items-center justify-between gap-2 rounded-md border px-2 py-1.5 text-sm"
                    >
                      <span className="min-w-0 flex-1 truncate" title={p.operational_purpose}>
                        {p.display_name}
                      </span>
                      <Button
                        type="button"
                        size="sm"
                        variant={attached ? 'outline' : 'default'}
                        disabled={attached}
                        onClick={() => onAttach(p.procedure_profile_code)}
                      >
                        {attached ? 'Added' : 'Add'}
                      </Button>
                    </li>
                  )
                })}
              </ul>
            </section>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}
