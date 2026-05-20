import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'

export function SponsorSnapshot() {
  return (
    <Card className="border-dashed">
      <CardHeader>
        <CardTitle>Sponsor snapshot</CardTitle>
        <CardDescription>
          Sponsor-level rollups will appear here once sponsor and site dimensions exist in Vilo
          OS.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-2 text-sm text-muted-foreground">
        <p>
          This section is a read-only placeholder for protocol-level enrollment pace, query
          aging, and monitoring visit readiness.
        </p>
        {/* TODO: wire sponsor entity mapping and site-level aggregates when available */}
      </CardContent>
    </Card>
  )
}
