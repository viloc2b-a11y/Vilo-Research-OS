// components/subject/clinical-profile/LibrarySearchCombobox.tsx
// Reusable combobox for searching Phase 6B.1 pathology or medication libraries.
// Calls server actions directly via useTransition — no API route needed.
// Pattern: debounced input → server search → dropdown list → onSelect callback.

'use client'

import { useState, useTransition, useCallback, useRef, useEffect, type ReactNode } from 'react'
import { Search, Loader2, X } from 'lucide-react'
import {
  searchPathologyLibrary,
  searchMedicationLibrary,
  searchAllergenLibrary,
  searchSurgicalProcedureLibrary,
} from '@/lib/subject/clinical-profile/library-search'
import type {
  AllergenResult,
  MedicationResult,
  PathologyResult,
  SurgicalProcedureResult,
} from '@/lib/subject/clinical-profile/library-search-types'

// ---------------------------------------------------------------------------
// Pathology combobox
// ---------------------------------------------------------------------------

type PathologyComboboxProps = {
  value: { id: string; label: string } | null
  onSelect: (result: PathologyResult | null) => void
  placeholder?: string
  disabled?: boolean
}

export function PathologyCombobox({
  value,
  onSelect,
  placeholder = 'Search pathology library…',
  disabled,
}: PathologyComboboxProps) {
  return (
    <LibraryCombobox
      value={value}
      onSelect={onSelect}
      searchFn={searchPathologyLibrary}
      renderResult={(r: PathologyResult) => ({
        id: r.pathology_id,
        label: r.common_name,
        sublabel: [r.medical_name, r.icd10_code].filter(Boolean).join(' · '),
        badge: r.system,
      })}
      placeholder={placeholder}
      disabled={disabled}
    />
  )
}

// ---------------------------------------------------------------------------
// Medication combobox
// ---------------------------------------------------------------------------

type MedicationComboboxProps = {
  value: { id: string; label: string } | null
  onSelect: (result: MedicationResult | null) => void
  placeholder?: string
  disabled?: boolean
}

export function MedicationCombobox({
  value,
  onSelect,
  placeholder = 'Search medication library…',
  disabled,
}: MedicationComboboxProps) {
  const [searchNotice, setSearchNotice] = useState<string | null>(null)

  const searchMedications = useCallback(async (q: string) => {
    try {
      const { results, error } = await searchMedicationLibrary(q)
      setSearchNotice(error ?? null)
      return results
    } catch (err) {
      console.error('[MedicationCombobox] search failed', err)
      setSearchNotice('Medication library search failed.')
      return []
    }
  }, [])

  return (
    <div className="space-y-1">
      <LibraryCombobox
        value={value}
        onSelect={onSelect}
        searchFn={searchMedications}
        renderResult={(r: MedicationResult) => ({
          id: r.medication_id,
          label: r.medication_name,
          sublabel: [r.brand_name, r.drug_class].filter(Boolean).join(' · '),
          badge: r.route ?? undefined,
        })}
        placeholder={placeholder}
        disabled={disabled}
        emptyHint="No matches found. Enter a custom medication name below."
      />
      {searchNotice ? (
        <p className="text-xs text-amber-700 dark:text-amber-400" role="status">
          {searchNotice}
        </p>
      ) : null}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Allergen combobox (free text + vocabulary suggestions)
// ---------------------------------------------------------------------------

type AllergenComboboxProps = {
  allergen: string
  onAllergenChange: (value: string) => void
  onPick?: (result: AllergenResult) => void
  placeholder?: string
  disabled?: boolean
}

export function AllergenCombobox({
  allergen,
  onAllergenChange,
  onPick,
  placeholder = 'Search or type allergen…',
  disabled,
}: AllergenComboboxProps) {
  return (
    <FreeTextLibraryCombobox<AllergenResult>
      textValue={allergen}
      onTextChange={onAllergenChange}
      searchFn={searchAllergenLibrary}
      renderResult={(r) => ({
        id: r.vocabulary_id,
        label: r.display_name,
        sublabel: [r.category, r.allergen_type].filter(Boolean).join(' · '),
        badge: r.allergen_type ?? undefined,
      })}
      onPick={(result) => {
        onAllergenChange(result.display_name)
        onPick?.(result)
      }}
      placeholder={placeholder}
      disabled={disabled}
      emptyHint="No library match. Keep typing to use a custom allergen name."
    />
  )
}

// ---------------------------------------------------------------------------
// Surgical procedure combobox
// ---------------------------------------------------------------------------

type SurgicalProcedureComboboxProps = {
  value: { id: string; label: string } | null
  onSelect: (result: SurgicalProcedureResult | null) => void
  placeholder?: string
  disabled?: boolean
}

export function SurgicalProcedureCombobox({
  value,
  onSelect,
  placeholder = 'Search surgical procedure library…',
  disabled,
}: SurgicalProcedureComboboxProps) {
  return (
    <LibraryCombobox
      value={value}
      onSelect={onSelect}
      searchFn={searchSurgicalProcedureLibrary}
      renderResult={(r: SurgicalProcedureResult) => ({
        id: r.id,
        label: r.label,
        sublabel: r.code,
        badge: r.category ?? undefined,
      })}
      placeholder={placeholder}
      disabled={disabled}
      emptyHint="No procedure match. Use Other / Unlisted below."
    />
  )
}

// ---------------------------------------------------------------------------
// Generic combobox implementation
// ---------------------------------------------------------------------------

type RenderedResult = {
  id: string
  label: string
  sublabel?: string | null
  badge?: string
}

type LibraryComboboxProps<T> = {
  value: { id: string; label: string } | null
  onSelect: (result: T | null) => void
  searchFn: (query: string) => Promise<T[]>
  renderResult: (result: T) => RenderedResult
  placeholder: string
  disabled?: boolean
  emptyHint?: ReactNode
}

function LibraryCombobox<T>({
  value,
  onSelect,
  searchFn,
  renderResult,
  placeholder,
  disabled,
  emptyHint = 'No results found. You can enter a custom name below.',
}: LibraryComboboxProps<T>) {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<T[]>([])
  const [open, setOpen] = useState(false)
  const [isPending, startTransition] = useTransition()
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const containerRef = useRef<HTMLDivElement>(null)

  const runSearch = useCallback(
    (q: string) => {
      if (q.trim().length < 2) {
        setResults([])
        setOpen(false)
        return
      }
      startTransition(async () => {
        try {
          const data = await searchFn(q)
          setResults(Array.isArray(data) ? data : [])
          setOpen(true)
        } catch (err) {
          console.error('[LibraryCombobox] search failed', err)
          setResults([])
          setOpen(true)
        }
      })
    },
    [searchFn],
  )

  function handleInput(e: React.ChangeEvent<HTMLInputElement>) {
    const q = e.target.value
    setQuery(q)
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => runSearch(q), 280)
  }

  function handleSelect(result: T) {
    let rendered: RenderedResult
    try {
      rendered = renderResult(result)
    } catch (err) {
      console.error('[LibraryCombobox] renderResult failed', err)
      return
    }
    setQuery(rendered.label)
    setOpen(false)
    setResults([])
    onSelect(result)
  }

  function handleClear() {
    setQuery('')
    setResults([])
    setOpen(false)
    onSelect(null)
  }

  // Close dropdown on outside click
  useEffect(() => {
    function handler(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  // Show selected value label if no active query
  const displayValue = value && !query ? value.label : query

  return (
    <div ref={containerRef} className="relative">
      <div className="relative flex items-center">
        <Search className="pointer-events-none absolute left-2.5 h-3.5 w-3.5 text-muted-foreground" />
        <input
          type="text"
          value={displayValue}
          onChange={handleInput}
          onFocus={() => { if (results.length > 0) setOpen(true) }}
          placeholder={placeholder}
          disabled={disabled}
          className={[
            'w-full rounded-md border bg-background py-2 pl-8 pr-8 text-sm',
            'focus:outline-none focus:ring-2 focus:ring-ring/50',
            'disabled:cursor-not-allowed disabled:opacity-50',
          ].join(' ')}
        />
        {isPending && (
          <Loader2 className="absolute right-2.5 h-3.5 w-3.5 animate-spin text-muted-foreground" />
        )}
        {(value || query) && !isPending && (
          <button
            type="button"
            onClick={handleClear}
            className="absolute right-2.5 text-muted-foreground hover:text-foreground"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        )}
      </div>

      {open && results.length > 0 && (
        <div className="absolute z-50 mt-1 w-full rounded-md border bg-background shadow-lg">
          <ul className="max-h-60 overflow-auto py-1">
            {results.map((result, index) => {
              let rendered: RenderedResult
              try {
                rendered = renderResult(result)
              } catch (err) {
                console.error('[LibraryCombobox] renderResult failed', err)
                return null
              }
              const rowKey = rendered.id || `row-${index}`
              return (
                <li key={rowKey}>
                  <button
                    type="button"
                    onClick={() => handleSelect(result)}
                    className="w-full px-3 py-2 text-left text-sm hover:bg-muted/50 focus:bg-muted/50 focus:outline-none"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <span className="font-medium">{rendered.label}</span>
                        {rendered.sublabel && (
                          <p className="mt-0.5 text-xs text-muted-foreground truncate">
                            {rendered.sublabel}
                          </p>
                        )}
                      </div>
                      {rendered.badge && (
                        <span className="shrink-0 rounded-full bg-muted px-1.5 py-0 text-[10px] text-muted-foreground capitalize">
                          {rendered.badge}
                        </span>
                      )}
                    </div>
                  </button>
                </li>
              )
            })}
          </ul>
        </div>
      )}

      {open && !isPending && results.length === 0 && query.trim().length >= 2 && (
        <div className="absolute z-50 mt-1 w-full rounded-md border bg-background px-3 py-2 text-xs text-muted-foreground shadow-lg">
          {emptyHint}
        </div>
      )}
    </div>
  )
}

type FreeTextLibraryComboboxProps<T> = {
  textValue: string
  onTextChange: (value: string) => void
  onPick: (result: T) => void
  searchFn: (query: string) => Promise<T[]>
  renderResult: (result: T) => RenderedResult
  placeholder: string
  disabled?: boolean
  emptyHint?: string
}

/** Library suggestions while keeping typed free text in sync (allergen field). */
function FreeTextLibraryCombobox<T>({
  textValue,
  onTextChange,
  onPick,
  searchFn,
  renderResult,
  placeholder,
  disabled,
  emptyHint = 'No results found. You can enter a custom name.',
}: FreeTextLibraryComboboxProps<T>) {
  const [query, setQuery] = useState(textValue)
  const [results, setResults] = useState<T[]>([])
  const [open, setOpen] = useState(false)
  const [isPending, startTransition] = useTransition()
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    setQuery(textValue)
  }, [textValue])

  const runSearch = useCallback(
    (q: string) => {
      if (q.trim().length < 2) {
        setResults([])
        setOpen(false)
        return
      }
      startTransition(async () => {
        const data = await searchFn(q)
        setResults(data)
        setOpen(true)
      })
    },
    [searchFn],
  )

  function handleInput(e: React.ChangeEvent<HTMLInputElement>) {
    const q = e.target.value
    setQuery(q)
    onTextChange(q)
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => runSearch(q), 280)
  }

  function handleSelect(result: T) {
    const rendered = renderResult(result)
    setQuery(rendered.label)
    setOpen(false)
    setResults([])
    onPick(result)
  }

  function handleClear() {
    setQuery('')
    onTextChange('')
    setResults([])
    setOpen(false)
  }

  useEffect(() => {
    function handler(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  return (
    <div ref={containerRef} className="relative">
      <div className="relative flex items-center">
        <Search className="pointer-events-none absolute left-2.5 h-3.5 w-3.5 text-muted-foreground" />
        <input
          type="text"
          value={query}
          onChange={handleInput}
          onFocus={() => {
            if (results.length > 0) setOpen(true)
          }}
          placeholder={placeholder}
          disabled={disabled}
          className={[
            'w-full rounded-md border bg-background py-2 pl-8 pr-8 text-sm',
            'focus:outline-none focus:ring-2 focus:ring-ring/50',
            'disabled:cursor-not-allowed disabled:opacity-50',
          ].join(' ')}
        />
        {isPending && (
          <Loader2 className="absolute right-2.5 h-3.5 w-3.5 animate-spin text-muted-foreground" />
        )}
        {query && !isPending && (
          <button
            type="button"
            onClick={handleClear}
            className="absolute right-2.5 text-muted-foreground hover:text-foreground"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        )}
      </div>

      {open && results.length > 0 && (
        <div className="absolute z-50 mt-1 w-full rounded-md border bg-background shadow-lg">
          <ul className="max-h-60 overflow-auto py-1">
            {results.map((result) => {
              const rendered = renderResult(result)
              return (
                <li key={rendered.id}>
                  <button
                    type="button"
                    onClick={() => handleSelect(result)}
                    className="w-full px-3 py-2 text-left text-sm hover:bg-muted/50 focus:bg-muted/50 focus:outline-none"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <span className="font-medium">{rendered.label}</span>
                        {rendered.sublabel && (
                          <p className="mt-0.5 text-xs text-muted-foreground truncate">
                            {rendered.sublabel}
                          </p>
                        )}
                      </div>
                      {rendered.badge && (
                        <span className="shrink-0 rounded-full bg-muted px-1.5 py-0 text-[10px] text-muted-foreground capitalize">
                          {rendered.badge}
                        </span>
                      )}
                    </div>
                  </button>
                </li>
              )
            })}
          </ul>
        </div>
      )}

      {open && !isPending && results.length === 0 && query.trim().length >= 2 && (
        <div className="absolute z-50 mt-1 w-full rounded-md border bg-background px-3 py-2 text-xs text-muted-foreground shadow-lg">
          {emptyHint}
        </div>
      )}
    </div>
  )
}
