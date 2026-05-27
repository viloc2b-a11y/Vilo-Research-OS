'use client'

import {
  DOCUMENT_INTELLIGENCE_DOMAIN_LABELS,
  DOCUMENT_INTELLIGENCE_DOMAINS,
  type DocumentIntelligenceDomain,
} from '@/lib/document-intelligence/document-domain-mapper'

type DocumentDomainChecklistProps = {
  selected: DocumentIntelligenceDomain[]
  onChange: (domains: DocumentIntelligenceDomain[]) => void
  disabled?: boolean
}

export function DocumentDomainChecklist({
  selected,
  onChange,
  disabled = false,
}: DocumentDomainChecklistProps) {
  function toggle(domain: DocumentIntelligenceDomain) {
    if (disabled) return
    if (selected.includes(domain)) {
      onChange(selected.filter((value) => value !== domain))
    } else {
      onChange([...selected, domain])
    }
  }

  return (
    <fieldset className="mt-3" disabled={disabled}>
      <legend className="text-sm font-medium text-slate-700">Use this document for:</legend>
      <div className="mt-2 grid gap-2 sm:grid-cols-2">
        {DOCUMENT_INTELLIGENCE_DOMAINS.map((domain) => (
          <label
            key={domain}
            className="flex cursor-pointer items-center gap-2 rounded border border-slate-200 bg-slate-50/50 px-2 py-1.5 text-sm text-slate-700"
          >
            <input
              type="checkbox"
              className="rounded border-slate-300"
              checked={selected.includes(domain)}
              onChange={() => toggle(domain)}
            />
            {DOCUMENT_INTELLIGENCE_DOMAIN_LABELS[domain]}
          </label>
        ))}
      </div>
      <p className="mt-2 text-xs text-slate-500">
        Classification defaults are always applied on the server. Leave all unchecked to use
        defaults only; check areas to merge with those defaults.
      </p>
    </fieldset>
  )
}
