// components/subject/clinical-profile/ClinicalProfileTabs.tsx
// Unified coordinator-facing clinical profile workspace.
// Consolidates: medical history, ConMeds, allergies, surgical history, lifestyle.

'use client'

import { useState } from 'react'
import type { ClinicalProfileSectionTab } from '@/lib/subject/clinical-profile/types'
import { MedicalHistorySection } from './MedicalHistorySection'
import { ConMedsSection } from './ConMedsSection'
import { AllergiesSection } from './AllergiesSection'
import { SurgicalHistorySection } from './SurgicalHistorySection'
import { LifestyleSection } from './LifestyleSection'
import type { SubjectClinicalProfile } from '@/lib/subject/clinical-profile/types'

const TABS: {
  key: ClinicalProfileSectionTab
  label: string
  badge?: (profile: SubjectClinicalProfile) => number
  emphasize?: boolean
}[] = [
  {
    key: 'conmeds',
    label: 'ConMeds',
    badge: (p) => p.conmeds.filter((r) => r.status === 'active').length,
    emphasize: true,
  },
  {
    key: 'medical_history',
    label: 'Medical History',
    badge: (p) => p.medical_history.filter((r) => r.status === 'active').length,
  },
  {
    key: 'allergies',
    label: 'Allergies',
    badge: (p) => p.allergies.filter((r) => r.status === 'active').length,
  },
  { key: 'surgical_history', label: 'Surgical History' },
  { key: 'lifestyle', label: 'Lifestyle' },
]

type ClinicalProfileTabsProps = {
  profile: SubjectClinicalProfile
  studySubjectId: string
  canVerify?: boolean
  actorRole?: string
  initialSection?: ClinicalProfileSectionTab
}

export function ClinicalProfileTabs({
  profile,
  studySubjectId,
  canVerify = false,
  actorRole = 'coordinator',
  initialSection = 'medical_history',
}: ClinicalProfileTabsProps) {
  const [activeTab, setActiveTab] = useState<ClinicalProfileSectionTab>(initialSection)

  return (
    <div className="space-y-4">
      {/* Tab bar */}
      <div className="flex gap-1 border-b">
        {TABS.map((tab) => {
          const count = tab.badge?.(profile)
          const isActive = activeTab === tab.key
          return (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={[
                'relative flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium transition-colors',
                isActive
                  ? 'border-b-2 border-primary text-foreground'
                  : 'text-muted-foreground hover:text-foreground',
                tab.emphasize && !isActive ? 'text-primary' : '',
              ].join(' ')}
            >
              {tab.label}
              {count !== undefined && count > 0 ? (
                <span
                  className={[
                    'inline-flex h-5 min-w-5 items-center justify-center rounded-full px-1.5 text-[10px] font-semibold',
                    isActive
                      ? 'bg-primary text-primary-foreground'
                      : 'bg-muted text-muted-foreground',
                  ].join(' ')}
                >
                  {count}
                </span>
              ) : null}
            </button>
          )
        })}
      </div>

      {/* Tab panels */}
      <div>
        {activeTab === 'medical_history' && (
          <MedicalHistorySection
            studySubjectId={studySubjectId}
            rows={profile.medical_history}
            canVerify={canVerify}
            actorRole={actorRole}
          />
        )}
        {activeTab === 'conmeds' && (
          <ConMedsSection
            studySubjectId={studySubjectId}
            rows={profile.conmeds}
            medicalHistory={profile.medical_history}
            canVerify={canVerify}
            actorRole={actorRole}
          />
        )}
        {activeTab === 'allergies' && (
          <AllergiesSection
            studySubjectId={studySubjectId}
            rows={profile.allergies}
            canVerify={canVerify}
            actorRole={actorRole}
          />
        )}
        {activeTab === 'surgical_history' && (
          <SurgicalHistorySection
            studySubjectId={studySubjectId}
            rows={profile.surgical_history}
            canVerify={canVerify}
            actorRole={actorRole}
          />
        )}
        {activeTab === 'lifestyle' && (
          <LifestyleSection
            studySubjectId={studySubjectId}
            lifestyle={profile.lifestyle}
          />
        )}
      </div>
    </div>
  )
}
