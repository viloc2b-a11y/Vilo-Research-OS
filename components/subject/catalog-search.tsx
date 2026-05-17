'use client'

import { useEffect, useState } from 'react'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

export type CatalogSearchOption = {
  id: string
  primary: string
  secondary?: string | null
  meta?: Record<string, string | null>
}

type CatalogSearchProps = {
  label: string
  placeholder: string
  emptyHint: string
  selected: CatalogSearchOption | null
  onSelect: (option: CatalogSearchOption | null) => void
  onSearch: (query: string) => Promise<CatalogSearchOption[]>
  allowCustom?: boolean
  customLabel?: string
  customValue?: string
  onCustomChange?: (value: string) => void
}

export function CatalogSearch({
  label,
  placeholder,
  emptyHint,
  selected,
  onSelect,
  onSearch,
  allowCustom = false,
  customLabel = 'Or enter custom',
  customValue = '',
  onCustomChange,
}: CatalogSearchProps) {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<CatalogSearchOption[]>([])
  const [searching, setSearching] = useState(false)
  const [open, setOpen] = useState(false)

  useEffect(() => {
    if (selected) {
      setQuery(selected.primary)
      return
    }
    if (!query.trim()) {
      setResults([])
      return
    }

    const handle = window.setTimeout(async () => {
      setSearching(true)
      try {
        const hits = await onSearch(query)
        setResults(hits)
        setOpen(true)
      } finally {
        setSearching(false)
      }
    }, 250)

    return () => window.clearTimeout(handle)
  }, [query, onSearch, selected])

  function pick(option: CatalogSearchOption) {
    onSelect(option)
    onCustomChange?.('')
    setQuery(option.primary)
    setOpen(false)
  }

  function clearSelection() {
    onSelect(null)
    setQuery('')
    setResults([])
  }

  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      <div className="relative">
        <Input
          value={selected ? selected.primary : query}
          placeholder={placeholder}
          onChange={(e) => {
            if (selected) clearSelection()
            setQuery(e.target.value)
          }}
          onFocus={() => {
            if (!selected && results.length) setOpen(true)
          }}
          autoComplete="off"
        />
        {selected ? (
          <button
            type="button"
            className="absolute top-1/2 right-2 -translate-y-1/2 text-xs text-muted-foreground hover:text-foreground"
            onClick={clearSelection}
          >
            Clear
          </button>
        ) : null}
        {open && !selected && results.length > 0 ? (
          <ul
            className="absolute z-20 mt-1 max-h-48 w-full overflow-auto rounded-md border bg-background shadow-md"
            role="listbox"
          >
            {results.map((option) => (
              <li key={option.id}>
                <button
                  type="button"
                  className="w-full px-3 py-2 text-left text-sm hover:bg-muted"
                  onClick={() => pick(option)}
                >
                  <span className="font-medium">{option.primary}</span>
                  {option.secondary ? (
                    <span className="mt-0.5 block text-xs text-muted-foreground">
                      {option.secondary}
                    </span>
                  ) : null}
                </button>
              </li>
            ))}
          </ul>
        ) : null}
      </div>
      <p className="text-xs text-muted-foreground">
        {searching ? 'Searching catalog…' : emptyHint}
      </p>
      {allowCustom && onCustomChange ? (
        <div className="space-y-1">
          <Label className="text-xs text-muted-foreground">{customLabel}</Label>
          <Input
            value={customValue}
            placeholder="Free-text if not in catalog"
            onChange={(e) => {
              if (selected) clearSelection()
              onCustomChange(e.target.value)
            }}
            disabled={Boolean(selected)}
          />
        </div>
      ) : null}
    </div>
  )
}
