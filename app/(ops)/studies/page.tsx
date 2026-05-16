import Link from 'next/link'
import { Card, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { createServerClient } from '@/lib/supabase/server'

export default async function StudiesListPage() {
  const supabase = await createServerClient()
  const { data: studies, error } = await supabase
    .from('studies')
    .select('id, name, slug, status')
    .order('name', { ascending: true })

  if (error) {
    return (
      <div className="space-y-4">
        <h1 className="text-2xl font-semibold tracking-tight">Studies</h1>
        <p className="text-sm text-destructive">Could not load studies: {error.message}</p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Studies</h1>
        <p className="text-sm text-muted-foreground">
          Read-only list — tenant and study roster enforced by Row Level Security.
        </p>
      </div>
      {!studies?.length ? (
        <Card>
          <CardHeader>
            <CardTitle>No studies visible</CardTitle>
            <CardDescription>
              You may not belong to any study roster yet, or no studies exist in your organization.
            </CardDescription>
          </CardHeader>
        </Card>
      ) : (
        <ul className="space-y-3">
          {studies.map((study) => (
            <li key={study.id}>
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-base">
                    <Link
                      href={`/studies/${study.id}`}
                      className="text-primary hover:underline"
                    >
                      {study.name}
                    </Link>
                  </CardTitle>
                  <CardDescription>
                    Status:{' '}
                    <span className="font-medium text-foreground">{study.status}</span>
                    {study.slug ? (
                      <>
                        {' '}
                        · Slug{' '}
                        <span className="font-medium text-foreground">{study.slug}</span>
                      </>
                    ) : null}
                  </CardDescription>
                </CardHeader>
              </Card>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
