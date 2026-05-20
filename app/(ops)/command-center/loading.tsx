import { Card, CardContent } from '@/components/ui/card'

export default function CommandCenterLoading() {
  return (
    <div className="space-y-6 p-6">
      <div>
        <div className="h-7 w-72 rounded bg-muted" />
        <div className="mt-2 h-4 w-96 rounded bg-muted" />
      </div>
      <div className="grid gap-3 md:grid-cols-3 xl:grid-cols-6">
        {Array.from({ length: 6 }).map((_, index) => (
          <Card key={index}>
            <CardContent className="pt-6">
              <div className="h-8 w-12 rounded bg-muted" />
              <div className="mt-2 h-3 w-24 rounded bg-muted" />
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  )
}
