import Link from 'next/link'
import { ConMedsSection } from '@/components/subject/clinical-profile/ConMedsSection'
import { SubjectConMedsSummary } from '@/components/subject/clinical-profile/SubjectConMedsSummary'
import { subjectChartTabPath, subjectClinicalProfilePath } from '@/lib/ops/paths'
import type { SubjectClinicalProfile } from '@/lib/subject/clinical-profile/types'

type SubjectConMedsSurfaceProps = {
  profile: SubjectClinicalProfile
  studySubjectId: string
  studyId: string | null
  canVerify: boolean
  actorRole: string
  /** When on dedicated ConMeds tab, link to full clinical profile. */
  variant: 'dedicated' | 'embedded'
}

export function SubjectConMedsSurface({
  profile,
  studySubjectId,
  studyId,
  canVerify,
  actorRole,
  variant,
}: SubjectConMedsSurfaceProps) {
  const conmedsTabHref = subjectChartTabPath(studyId, studySubjectId, 'conmeds')
  const clinicalProfileHref = subjectClinicalProfilePath(studyId, studySubjectId)

  return (
    <div className="space-y-4">
      {variant === 'dedicated' ? (
        <div>
          <h2 className="text-lg font-semibold" style={{ color: '#10253e' }}>
            Concomitant medications
          </h2>
          <p className="text-sm" style={{ color: '#98a5ad' }}>
            Subject-level medication list — same data as Clinical Profile, optimized for coordinator
            review.
          </p>
        </div>
      ) : null}

      <SubjectConMedsSummary rows={profile.conmeds} />

      <div
        className="rounded-lg border bg-white p-4"
        style={{ borderColor: '#e5e5e5' }}
      >
        <ConMedsSection
          studySubjectId={studySubjectId}
          rows={profile.conmeds}
          medicalHistory={profile.medical_history}
          canVerify={canVerify}
          actorRole={actorRole}
        />
      </div>

      <p className="text-xs" style={{ color: '#98a5ad' }}>
        {variant === 'dedicated' ? (
          <>
            Medical history, allergies, and lifestyle are in{' '}
            <Link href={clinicalProfileHref} className="font-medium text-[#34a090] hover:underline">
              Clinical Profile
            </Link>
            .
          </>
        ) : (
          <>
            Dedicated view:{' '}
            <Link href={conmedsTabHref} className="font-medium text-[#34a090] hover:underline">
              ConMeds tab
            </Link>
            .
          </>
        )}
      </p>
    </div>
  )
}
