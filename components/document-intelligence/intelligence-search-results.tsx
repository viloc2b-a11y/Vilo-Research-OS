import type { DocumentIntelligenceSearchResult } from '@/lib/document-intelligence/document-intelligence-types'

export function IntelligenceSearchResults({
  results,
}: {
  results: DocumentIntelligenceSearchResult[]
}) {
  if (results.length === 0) return null

  return (
    <ul className="mt-4 space-y-3">
      {results.map((result) => (
        <li key={result.chunkId} className="rounded-md border border-slate-100 bg-slate-50 p-3">
          <p className="text-sm font-medium text-slate-800">{result.sourceFilename}</p>
          <p className="text-xs text-slate-500">
            {result.sectionTitle ? `Section: ${result.sectionTitle}` : 'Section unavailable'}
            {result.pageNumber != null ? ` · Page ${result.pageNumber}` : ''}
          </p>
          <p className="mt-2 text-sm text-slate-700">{result.snippet}</p>
          <p className="mt-1 text-xs text-slate-400">Referenced source chunk — verify before use.</p>
        </li>
      ))}
    </ul>
  )
}
