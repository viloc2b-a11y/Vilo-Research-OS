import Link from 'next/link'
import { Pill } from 'lucide-react'
import { subjectConMedsTabPath } from '@/lib/ops/paths'
import { summarizeConMeds } from '@/lib/subject/clinical-profile/conmed-summary'
import type { SubjectConMed } from '@/lib/subject/clinical-profile/types'

type ClinicalProfileConMedsPromoProps = {
  rows: SubjectConMed[]
  studyId: string | null
  studySubjectId: string
}

export function ClinicalProfileConMedsPromo({
  rows,
  studyId,
  studySubjectId,
}: ClinicalProfileConMedsPromoProps) {
  const counts = summarizeConMeds(rows)
  const href = subjectConMedsTabPath(studyId, studySubjectId)

  return (
    <div
      className="flex flex-wrap items-center justify-between gap-3 rounded-lg border px-4 py-3"
      style={{ borderColor: '#c5e8e4', backgroundColor: '#f0faf8' }}
    >
      <div className="flex items-start gap-3 min-w-0">
        <div
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg"
          style={{ backgroundColor: '#34a090' }}
        >
          <Pill className="h-4 w-4 text-white" />
        </div>
        <div className="min-w-0">
          <p className="text-sm font-semibold" style={{ color: '#10253e' }}>
            Concomitant medications
          </p>
          <p className="text-xs" style={{ color: '#2a8577' }}>
            {counts.active} active · {counts.discontinued} discontinued
            {counts.onHold > 0 ? ` · ${counts.onHold} on hold` : ''}
            {counts.missingDocumentation > 0
              ? ` · ${counts.missingDocumentation} need documentation`
              : ''}
          </p>
        </div>
      </div>
      <Link
        href={href}
        className="shrink-0 rounded-lg px-3 py-2 text-xs font-semibold text-white transition-opacity hover:opacity-90"
        style={{ backgroundColor: '#34a090' }}
      >
        Open ConMeds tab
      </Link>
    </div>
  )
}
