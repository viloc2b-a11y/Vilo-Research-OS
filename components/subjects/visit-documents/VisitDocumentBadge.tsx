import type { VisitDocumentType } from '@/lib/subject/visit-documents/types'

const tones: Partial<Record<VisitDocumentType, string>> = {
  ICF: 'bg-sky-100 text-sky-900 dark:bg-sky-950 dark:text-sky-100',
  Labs: 'bg-emerald-100 text-emerald-900 dark:bg-emerald-950 dark:text-emerald-100',
  Imaging: 'bg-violet-100 text-violet-900 dark:bg-violet-950 dark:text-violet-100',
  ECG: 'bg-amber-100 text-amber-900 dark:bg-amber-950 dark:text-amber-100',
  'Source Document': 'bg-muted text-muted-foreground',
}

export function VisitDocumentBadge({ type }: { type: VisitDocumentType }) {
  return (
    <span className={`rounded px-2 py-1 text-xs font-medium ${tones[type] ?? 'bg-muted text-muted-foreground'}`}>
      {type}
    </span>
  )
}
