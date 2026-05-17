import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import type { ReadPanelError } from '@/lib/source/read-contract/view-models'

type ReadPanelErrorCardProps = {
  error: ReadPanelError
}

export function ReadPanelErrorCard({ error }: ReadPanelErrorCardProps) {
  return (
    <Card className="border-destructive/40">
      <CardHeader>
        <CardTitle className="text-base text-destructive">{error.title}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-2 text-sm">
        <p>
          <span className="text-muted-foreground">Code:</span>{' '}
          <span className="font-medium">{error.code}</span>
        </p>
        {error.isAuthError ? (
          <p className="text-muted-foreground">Authentication required to load this panel.</p>
        ) : null}
        {error.isForbidden ? (
          <p className="text-muted-foreground">You do not have access to this organization or study.</p>
        ) : null}
        <ul className="list-disc space-y-1 pl-5">
          {error.messages.map((message, i) => (
            <li key={`${error.code}-${i}`}>{message}</li>
          ))}
        </ul>
        {error.requestId ? (
          <p className="text-xs text-muted-foreground">Request {error.requestId}</p>
        ) : null}
      </CardContent>
    </Card>
  )
}
