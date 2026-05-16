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

type SubjectDetailPageProps = {
  params: Promise<{ subjectId: string }>
}

export default async function SubjectDetailPage({ params }: SubjectDetailPageProps) {
  const { subjectId } = await params
  const supabase = await createServerClient()

  const { data: subject, error: subErr } = await supabase
    .from('study_subjects')
    .select(
      `
      id,
      subject_identifier,
      enrollment_status,
      study_id,
      studies(id, name, slug)
    `,
    )
    .eq('id', subjectId)
    .maybeSingle()

  if (subErr || !subject) {
    notFound()
  }

  const nestedStudy = Array.isArray(subject.studies) ? subject.studies[0] : subject.studies
  const study = nestedStudy as { id: string; name: string; slug: string | null } | null

  const { data: visits, error: visErr } = await supabase
    .from('visits')
    .select(`
      id,
      scheduled_date,
      visit_status,
      visit_definitions(code,label)
    `)
    .eq('study_subject_id', subjectId)
    .order('scheduled_date', { ascending: false })

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <p className="text-sm text-muted-foreground">
          {study ? (
            <>
              <Link href="/studies" className="hover:underline">
                Studies
              </Link>
              <span aria-hidden className="px-2">
                /
              </span>
              <Link href={`/studies/${study.id}`} className="hover:underline">
                {study.name}
              </Link>
              <span aria-hidden className="px-2">
                /
              </span>
            </>
          ) : null}
          <span className="text-foreground">{subject.subject_identifier}</span>
        </p>
        <h1 className="text-2xl font-semibold tracking-tight">{subject.subject_identifier}</h1>
        <p className="text-sm text-muted-foreground">
          Enrollment{' '}
          <span className="font-medium text-foreground">{subject.enrollment_status}</span>
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Visits</CardTitle>
          <CardDescription>Scheduled or performed encounters for this subject.</CardDescription>
        </CardHeader>
        <CardContent>
          {visErr ? (
            <p className="text-sm text-destructive">{visErr.message}</p>
          ) : !visits?.length ? (
            <p className="text-sm text-muted-foreground">No visits scheduled.</p>
          ) : (
            <ul className="divide-y divide-border rounded-md border">
              {visits.map((v) => {
                const vd = Array.isArray(v.visit_definitions)
                  ? v.visit_definitions[0]
                  : v.visit_definitions
                const def = vd as { code?: string; label?: string } | null
                return (
                  <li key={v.id} className="flex flex-wrap items-center justify-between gap-3 px-3 py-2 text-sm">
                    <Link href={`/visits/${v.id}`} className="font-medium text-primary hover:underline">
                      {def?.label ?? def?.code ?? 'Visit'} ·{' '}
                      {v.scheduled_date ?? 'pending date'}
                    </Link>
                    <span className="text-muted-foreground">{v.visit_status}</span>
                  </li>
                )
              })}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
