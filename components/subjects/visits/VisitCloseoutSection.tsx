import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { CoordinatorSignatureCard } from '@/components/subjects/visits/CoordinatorSignatureCard'
import { InvestigatorSignatureCard } from '@/components/subjects/visits/InvestigatorSignatureCard'
import { ProgressNoteEditor } from '@/components/subjects/visits/ProgressNoteEditor'
import { VisitCloseoutTimeline } from '@/components/subjects/visits/VisitCloseoutTimeline'
import { VisitReviewStatusBadge } from '@/components/subjects/visits/VisitReviewStatusBadge'
import type { VisitCloseoutBundle } from '@/lib/subject/visits/progress-note/types'

type VisitCloseoutSectionProps = {
  bundle: VisitCloseoutBundle
  /**
   * F-07: whether the current viewer has investigator signing authority.
   * Derived server-side from canSignClinicalSource (pi_sub_i / admin / owner).
   */
  canInvestigatorSign?: boolean
}

export function VisitCloseoutSection({ bundle, canInvestigatorSign = false }: VisitCloseoutSectionProps) {
  const { model, events, guards, noteLocked, closeoutLocked } = bundle

  return (
    <div className="space-y-4">
      <Card className={closeoutLocked ? 'border-emerald-200/80 bg-emerald-50/30 dark:border-emerald-900/50 dark:bg-emerald-950/20' : ''}>
        <CardHeader>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <CardTitle className="text-lg">Visit closeout</CardTitle>
              <CardDescription>
                Coordinator documents, signs, then investigator reviews. Operational attestation
                only.
              </CardDescription>
            </div>
            <VisitReviewStatusBadge status={model.visitReviewStatus} />
          </div>
          {closeoutLocked ? (
            <p className="text-xs font-medium text-emerald-800 dark:text-emerald-200">
              Closeout locked — investigator signature recorded.
            </p>
          ) : null}
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="rounded-lg border bg-muted/10 p-4">
            <p className="mb-3 text-sm font-medium">Operational timeline</p>
            <VisitCloseoutTimeline events={events} />
          </div>

          {guards.ipCaptureWarning ? (
            <p className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
              {guards.ipCaptureWarning} Complete the applicable eSource before closeout signature.
            </p>
          ) : null}

          <div className={closeoutLocked ? 'pointer-events-none opacity-60' : ''}>
            <ProgressNoteEditor model={model} readOnly={noteLocked || closeoutLocked} locked={noteLocked} />
            <CoordinatorSignatureCard model={model} guards={guards} disabled={closeoutLocked} />
            <div className="mt-6">
              {/* F-07: canSign prop routes investigator role authority to the card */}
              <InvestigatorSignatureCard
                model={model}
                guards={guards}
                disabled={closeoutLocked}
                canSign={canInvestigatorSign}
              />
            </div>
          </div>

          {!closeoutLocked && guards.visitCompletionBlocked ? (
            <p className="text-xs text-amber-800 dark:text-amber-200">
              Visit will remain in progress after investigator sign until:{' '}
              {guards.visitCompletionBlockReasons.join(' ')}
            </p>
          ) : null}
        </CardContent>
      </Card>
    </div>
  )
}
