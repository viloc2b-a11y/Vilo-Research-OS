'use client'

import { AlertTriangle } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import Link from 'next/link'

type PiSignatureItem = {
  id: string
  procedureLabel: string
  visitLabel: string
  signHref: string
}

type Props = {
  unsignedItems: PiSignatureItem[]
  hasAmendmentBudgetImpact: boolean
}

export function SubjectPiRevenueAwareness({ unsignedItems, hasAmendmentBudgetImpact }: Props) {
  if (unsignedItems.length === 0 && !hasAmendmentBudgetImpact) return null

  return (
    <Card className="border-amber-200 bg-amber-50/50">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base text-amber-800">
          <AlertTriangle className="size-4" />
          PI Financial Awareness
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {unsignedItems.length > 0 && (
          <div>
            <p className="text-sm font-medium text-amber-900 mb-2">
              Your signature is blocking earned revenue for {unsignedItems.length} procedure{unsignedItems.length > 1 ? 's' : ''}:
            </p>
            <ul className="space-y-1.5">
              {unsignedItems.map((item) => (
                <li key={item.id} className="rounded-md border border-amber-200 bg-white px-3 py-2 text-sm">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-medium text-foreground">{item.procedureLabel}</span>
                    <Link href={item.signHref} className="shrink-0 text-xs font-medium text-primary hover:underline">
                      Sign →
                    </Link>
                  </div>
                  <p className="text-xs text-muted-foreground">{item.visitLabel}</p>
                </li>
              ))}
            </ul>
          </div>
        )}
        {hasAmendmentBudgetImpact && (
          <p className="text-sm text-amber-800">
            This subject has an amendment with potential budget impact. Review is assigned to Finance or Site Director.
          </p>
        )}
      </CardContent>
    </Card>
  )
}
