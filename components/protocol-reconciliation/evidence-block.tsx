// Read-only source-evidence presentation for reconciliation cards.
// Pure display: never editable, never affects approval or matching.

export function textSnippet(text: string | null | undefined, max = 240): string | null {
  if (!text) return null
  const trimmed = text.trim()
  if (!trimmed) return null
  const body = trimmed.length <= max ? trimmed : `${trimmed.slice(0, max)}…`
  return `“${body}”`
}

export function evidenceSectionLine(
  title: string | null | undefined,
  type: string | null | undefined,
): string | null {
  const cleanTitle = title?.trim() || null
  const cleanType = type?.trim() || null
  if (!cleanTitle && !cleanType) return null
  if (cleanTitle && cleanType) return `Section: ${cleanTitle} (${cleanType})`
  return `Section: ${cleanTitle ?? cleanType}`
}

export function formatConfidencePercent(
  value: number | null | undefined,
  label: string,
): string | null {
  if (value === null || value === undefined || Number.isNaN(value)) return null
  // Candidate/section confidences are stored as numeric(5,2); accept either a
  // 0–1 fraction or an already-percent value.
  const pct = value <= 1 ? value * 100 : value
  return `${label} ${Math.round(pct)}%`
}

export function EvidenceBlock({ lines }: { lines: (string | null)[] }) {
  const visible = lines.filter((line): line is string => Boolean(line && line.trim()))

  return (
    <div className="mt-2 rounded border border-slate-100 bg-slate-50 p-2">
      <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">
        Source evidence
      </p>
      {visible.length === 0 ? (
        <p className="mt-1 text-xs text-slate-400">No evidence available</p>
      ) : (
        <div className="mt-1 space-y-1">
          {visible.map((line, index) => (
            <p key={index} className="text-xs text-slate-600">
              {line}
            </p>
          ))}
        </div>
      )}
    </div>
  )
}
