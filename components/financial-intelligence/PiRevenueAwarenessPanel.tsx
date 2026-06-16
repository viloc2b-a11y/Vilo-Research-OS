import { AlertTriangle, CheckCircle2, PenTool } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import Link from 'next/link'

type PendingSignatureItem = {
  id: string
  procedureLabel: string
  visitLabel: string
  subjectIdentifier: string
  signHref: string
}

type Props = {
  pendingSignatures: PendingSignatureItem[]
}

export function PiRevenueAwarenessPanel({ pendingSignatures }: Props) {
  return (
    <div className="space-y-4">
      <div className="px-1">
        <h1 className="text-xl font-semibold text-foreground">PI Revenue Awareness</h1>
        <p className="text-sm text-muted-foreground mt-0.5">
          Your signature is required on these completed procedures to unlock earned revenue.
        </p>
      </div>

      {pendingSignatures.length === 0 ? (
        <Card>
          <CardContent className="flex items-center gap-3 px-4 py-6">
            <CheckCircle2 className="size-5 text-green-600 shrink-0" />
            <div>
              <p className="text-sm font-medium text-foreground">No pending procedure signatures</p>
              <p className="text-xs text-muted-foreground">All completed procedures have your signature.</p>
            </div>
          </CardContent>
        </Card>
      ) : (
        <Card className="border-amber-200">
          <CardHeader className="pb-2 pt-3 px-4">
            <CardTitle className="flex items-center gap-2 text-sm font-semibold text-amber-800">
              <PenTool className="size-4" />
              Procedures Awaiting Your Signature
              <span className="ml-auto rounded-full bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-800">
                {pendingSignatures.length}
              </span>
            </CardTitle>
          </CardHeader>
          <CardContent className="px-4 pb-3">
            <ul className="space-y-1.5">
              {pendingSignatures.map((item) => (
                <li key={item.id}>
                  <Link
                    href={item.signHref}
                    className="flex items-start gap-2 rounded-md border border-amber-200 bg-amber-50/50 px-3 py-2.5 text-sm hover:bg-amber-50"
                  >
                    <AlertTriangle className="size-3.5 text-amber-600 mt-0.5 shrink-0" />
                    <div className="min-w-0 flex-1">
                      <p className="font-medium text-foreground">{item.procedureLabel}</p>
                      <p className="text-xs text-muted-foreground">
                        {item.subjectIdentifier} · {item.visitLabel}
                      </p>
                    </div>
                    <span className="ml-2 shrink-0 self-center text-xs font-medium text-primary">Sign →</span>
                  </Link>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}

      <p className="flex items-center gap-2 px-1 text-xs text-muted-foreground">
        <CheckCircle2 className="size-3 shrink-0 text-primary" />
        Signing completes the earn chain. Invoice readiness and billing are managed by Finance.
      </p>
    </div>
  )
}
