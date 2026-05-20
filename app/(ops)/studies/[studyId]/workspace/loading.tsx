import { Card, CardContent } from '@/components/ui/card'

export default function StudyWorkspaceLoading() {
  return (
    <div className="space-y-6 p-6">
      <div className="h-7 w-80 rounded bg-muted" />
      <div className="grid gap-3 md:grid-cols-5">
        {Array.from({ length: 5 }).map((_, index) => (
          <Card key={index}>
            <CardContent className="pt-6">
              <div className="h-8 w-10 rounded bg-muted" />
              <div className="mt-2 h-3 w-24 rounded bg-muted" />
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  )
}
