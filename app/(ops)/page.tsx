import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'

export default function OpsDashboardPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Dashboard</h1>
        <p className="text-sm text-muted-foreground">
          Clinical Research Operations — visit-centric workflows will appear here.
        </p>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Scaffold ready</CardTitle>
          <CardDescription>
            Auth shell is active. Study, subject, and visit modules are not implemented yet.
          </CardDescription>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground">
          <ul className="list-inside list-disc space-y-1">
            <li>Apply Supabase migrations when approved (see supabase/migrations/).</li>
            <li>Provision staff users in Supabase Auth — no public signup.</li>
            <li>Use synthetic data only on staging until BAA is in place.</li>
          </ul>
        </CardContent>
      </Card>
    </div>
  )
}
