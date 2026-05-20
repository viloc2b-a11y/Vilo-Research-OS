'use client'

import { CaptureForm } from '@/components/source/capture-form'
import { SourceEngineAdvisoryPanel } from '@/components/source/SourceEngineAdvisoryPanel'
import { VisitActionToolbar } from '@/components/subjects/visits/VisitActionToolbar'
import { VisitScheduleSelector } from '@/components/subjects/visits/VisitScheduleSelector'
import type { CaptureShellViewModel } from '@/lib/source/capture/types'
import type { VisitRuntimeToolbarModel } from '@/lib/subject/visit-runtime/types'
import type { SubjectVisitScheduleItem } from '@/lib/visits/types'

type VisitRuntimeShellProps = {
  model: CaptureShellViewModel
  toolbar: VisitRuntimeToolbarModel
  scheduleVisits?: SubjectVisitScheduleItem[]
}

export function VisitRuntimeShell({ model, toolbar, scheduleVisits = [] }: VisitRuntimeShellProps) {
  const fieldsDisabled = Boolean(toolbar.fieldsDisabledAt)
  const sectionDisabled = Boolean(toolbar.sectionDisabledAt)
  const operationallyDisabled = fieldsDisabled || sectionDisabled || toolbar.isLocked
  const { context } = model

  return (
    <div className="space-y-6">
      <VisitScheduleSelector
        visits={scheduleVisits}
        subjectVisitsHref={`${context.subjectPath}/visits`}
      />
      <VisitActionToolbar
        toolbar={toolbar}
        fieldsDisabled={fieldsDisabled}
        sectionDisabled={sectionDisabled}
      />
      {sectionDisabled ? (
        <div className="rounded-md border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          <p className="font-medium">Procedure section disabled</p>
          <p>
            Editing and signing are blocked for this section.
            {toolbar.sectionDisabledReason ? ` Reason: ${toolbar.sectionDisabledReason}` : ''}
          </p>
        </div>
      ) : fieldsDisabled ? (
        <div className="rounded-md border border-slate-300 bg-slate-50 px-4 py-3 text-sm text-slate-800">
          <p className="font-medium">Pending fields disabled</p>
          <p>
            Editable fields are read-only until fields are enabled.
            {toolbar.fieldsDisabledReason ? ` Reason: ${toolbar.fieldsDisabledReason}` : ''}
          </p>
        </div>
      ) : null}
      <SourceEngineAdvisoryPanel snapshot={model.engineSnapshot} />
      <CaptureForm model={{ ...model, canEdit: model.canEdit && !toolbar.isLocked }} disabledOverride={operationallyDisabled} />
    </div>
  )
}
