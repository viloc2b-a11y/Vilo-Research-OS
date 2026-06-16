import { AlertTriangle, CheckCircle2, FileText, PenTool } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import Link from 'next/link'

type CoachingItem = {
  id: string
  title: string
  detail: string
  href: string
  severity: 'warning' | 'info'
}

type Props = {
  signatureItems: CoachingItem[]
  sourceItems: CoachingItem[]
}

export function CoordinatorRevenueProtectionPanel({ signatureItems, sourceItems }: Props) {
  const allItems = [
    ...signatureItems.map((i) => ({ ...i, type: 'signature' as const })),
    ...sourceItems.map((i) => ({ ...i, type: 'source' as const })),
  ]

  return (
    <div className="space-y-4">
      <div className="px-1">
        <h1 className="text-xl font-semibold text-foreground">Revenue Protection</h1>
        <p className="text-sm text-muted-foreground mt-0.5">
          Operational actions that affect earned revenue. Fix these to advance invoice readiness.
        </p>
      </div>

      {allItems.length === 0 ? (
        <Card>
          <CardContent className="flex items-center gap-3 px-4 py-6">
            <CheckCircle2 className="size-5 text-green-600 shrink-0" />
            <div>
              <p className="text-sm font-medium text-foreground">No revenue blockers detected</p>
              <p className="text-xs text-muted-foreground">All completed procedures have source and signatures.</p>
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {signatureItems.length > 0 && (
            <Card>
              <CardHeader className="pb-2 pt-3 px-4">
                <CardTitle className="flex items-center gap-2 text-sm font-semibold">
                  <PenTool className="size-4 text-amber-600" />
                  PI Signatures Blocking Earned Revenue
                  <span className="ml-auto rounded-full bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-800">
                    {signatureItems.length}
                  </span>
                </CardTitle>
              </CardHeader>
              <CardContent className="px-4 pb-3">
                <ul className="space-y-1.5">
                  {signatureItems.map((item) => (
                    <li key={item.id}>
                      <Link
                        href={item.href}
                        className="flex items-start gap-2 rounded-md border border-amber-200 bg-amber-50/50 px-3 py-2 text-sm hover:bg-amber-50"
                      >
                        <AlertTriangle className="size-3.5 text-amber-600 mt-0.5 shrink-0" />
                        <div className="min-w-0">
                          <p className="font-medium text-foreground truncate">{item.title}</p>
                          <p className="text-xs text-muted-foreground truncate">{item.detail}</p>
                        </div>
                        <span className="ml-auto shrink-0 text-xs font-medium text-primary">Fix →</span>
                      </Link>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          )}

          {sourceItems.length > 0 && (
            <Card>
              <CardHeader className="pb-2 pt-3 px-4">
                <CardTitle className="flex items-center gap-2 text-sm font-semibold">
                  <FileText className="size-4 text-blue-600" />
                  Incomplete Source Blocking Invoice Readiness
                  <span className="ml-auto rounded-full bg-blue-100 px-2 py-0.5 text-xs font-semibold text-blue-800">
                    {sourceItems.length}
                  </span>
                </CardTitle>
              </CardHeader>
              <CardContent className="px-4 pb-3">
                <ul className="space-y-1.5">
                  {sourceItems.map((item) => (
                    <li key={item.id}>
                      <Link
                        href={item.href}
                        className="flex items-start gap-2 rounded-md border px-3 py-2 text-sm hover:bg-muted"
                      >
                        <FileText className="size-3.5 text-blue-500 mt-0.5 shrink-0" />
                        <div className="min-w-0">
                          <p className="font-medium text-foreground truncate">{item.title}</p>
                          <p className="text-xs text-muted-foreground truncate">{item.detail}</p>
                        </div>
                        <span className="ml-auto shrink-0 text-xs font-medium text-primary">Complete →</span>
                      </Link>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          )}
        </div>
      )}

      <p className="flex items-center gap-2 px-1 text-xs text-muted-foreground">
        <CheckCircle2 className="size-3 shrink-0 text-primary" />
        Resolve these items through operational screens. Invoice readiness is managed by Finance.
      </p>
    </div>
  )
}
