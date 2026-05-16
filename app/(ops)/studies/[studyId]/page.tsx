import Link from 'next/link'
import { notFound } from 'next/navigation'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { createServerClient } from '@/lib/supabase/server'

type StudyDetailPageProps = {
  params: Promise<{ studyId: string }>
}

export default async function StudyDetailPage({ params }: StudyDetailPageProps) {
  const { studyId } = await params

  const supabase = await createServerClient()

  const { data: study, error: studyErr } = await supabase
    .from('studies')
    .select('id, name, slug, status')
    .eq('id', studyId)
    .maybeSingle()

  if (studyErr || !study) {
    notFound()
  }

  const { data: subjects, error: subErr } = await supabase
    .from('study_subjects')
    .select('id, subject_identifier, enrollment_status')
    .eq('study_id', studyId)
    .order('subject_identifier', { ascending: true })

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <p className="text-sm text-muted-foreground">
          <Link href="/studies" className="hover:underline">
            Studies
          </Link>
          <span aria-hidden className="px-2">
            /
          </span>
          <span className="text-foreground">{study.name}</span>
        </p>
        <h1 className="text-2xl font-semibold tracking-tight">{study.name}</h1>
        <p className="text-sm text-muted-foreground">
          Status{' '}
          <span className="font-medium text-foreground">{study.status}</span>
          {study.slug ? (
            <>
              {' '}
              · Slug{' '}
              <span className="font-medium text-foreground">{study.slug}</span>
            </>
          ) : null}
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Subjects</CardTitle>
          <CardDescription>Enrollment identifiers are synthetic staging only.</CardDescription>
        </CardHeader>
        <CardContent>
          {subErr ? (
            <p className="text-sm text-destructive">{subErr.message}</p>
          ) : !subjects?.length ? (
            <p className="text-sm text-muted-foreground">No subjects in this study.</p>
          ) : (
            <ul className="divide-y divide-border rounded-md border">
              {subjects.map((s) => (
                <li key={s.id} className="flex items-center justify-between gap-4 px-3 py-2 text-sm">
                  <Link
                    href={`/subjects/${s.id}`}
                    className="font-medium text-primary hover:underline"
                  >
                    {s.subject_identifier}
                  </Link>
                  <span className="text-muted-foreground">{s.enrollment_status}</span>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
