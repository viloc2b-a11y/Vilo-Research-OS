import Link from 'next/link'
import { notFound } from 'next/navigation'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { CoordinatorPageScroll } from '@/components/runtime-ui/CoordinatorPageScroll'
import { CoordinatorSafeErrorPanel } from '@/components/runtime-ui/CoordinatorSafeErrorPanel'
import { VisitDocumentUploader } from '@/components/subjects/visit-documents/VisitDocumentUploader'
import { coordinatorMessageFromError } from '@/lib/runtime-errors/coordinator-facing'
import { VisitDocumentsTable } from '@/components/subjects/visit-documents/VisitDocumentsTable'
import { listVisitDocuments } from '@/lib/subject/visit-documents/actions'
import { createServerClient } from '@/lib/supabase/server'

type VisitDocumentsPageProps = {
  params: Promise<{ studyId: string; subjectId: string; visitId: string }>
}

export default async function VisitDocumentsPage({ params }: VisitDocumentsPageProps) {
  const { studyId, subjectId, visitId } = await params
  const supabase = await createServerClient()

  const { data: visit, error } = await supabase
    .from('visits')
    .select(
      `
      id,
      scheduled_date,
      visit_status,
      study_id,
      study_subject_id,
      visit_definitions(code,label),
      study_subjects(subject_identifier),
      studies(name)
    `,
    )
    .eq('id', visitId)
    .eq('study_id', studyId)
    .eq('study_subject_id', subjectId)
    .maybeSingle()

  if (error || !visit) {
    notFound()
  }

  const visitDef = Array.isArray(visit.visit_definitions)
    ? visit.visit_definitions[0]
    : visit.visit_definitions
  const subject = Array.isArray(visit.study_subjects)
    ? visit.study_subjects[0]
    : visit.study_subjects
  const study = Array.isArray(visit.studies) ? visit.studies[0] : visit.studies

  const documentsResult = await listVisitDocuments({ studyId, subjectId, visitId })
  const documents = documentsResult.ok ? documentsResult.data : []

  const visitPath = `/visits/${visitId}`

  return (
    <CoordinatorPageScroll contentClassName="p-6">
    <div className="mx-auto max-w-5xl space-y-6">
      <div className="space-y-2">
        <p className="text-sm text-muted-foreground">
          <Link href="/studies" className="hover:underline">
            Studies
          </Link>
          <span aria-hidden className="px-2">/</span>
          <Link href={`/studies/${studyId}`} className="hover:underline">
            {study?.name ?? 'Study'}
          </Link>
          <span aria-hidden className="px-2">/</span>
          <Link href={`/studies/${studyId}/subjects/${subjectId}`} className="hover:underline">
            {subject?.subject_identifier ?? 'Subject'}
          </Link>
          <span aria-hidden className="px-2">/</span>
          <Link href={`/visits/${visitId}`} className="hover:underline">
            {visitDef?.label ?? visitDef?.code ?? 'Visit'}
          </Link>
          <span aria-hidden className="px-2">/</span>
          <span className="text-foreground">Documents</span>
        </p>
        <h1 className="text-2xl font-semibold tracking-tight">Visit Documents</h1>
        <p className="text-sm text-muted-foreground">
          {visitDef?.label ?? visitDef?.code ?? 'Visit'} · {visit.scheduled_date ?? 'No date'} ·{' '}
          {visit.visit_status}
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Upload supporting document</CardTitle>
          <CardDescription>
            Store coordinator visit documents such as ICFs, lab reports, imaging reports, ECGs,
            external records, and scanned source support.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <VisitDocumentUploader studyId={studyId} subjectId={subjectId} visitId={visitId} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Document repository</CardTitle>
          <CardDescription>
            Operational visit files only. This is not eTMF, sponsor exchange, OCR, or automated
            classification.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {!documentsResult.ok ? (
            <div className="mb-4">
              <CoordinatorSafeErrorPanel
                title="Documents unavailable"
                detail={coordinatorMessageFromError(new Error(documentsResult.error), {
                  context: 'visit-documents',
                })}
                retryHref={`/studies/${studyId}/subjects/${subjectId}/visits/${visitId}/documents`}
                backHref={visitPath}
                backLabel="Back to visit"
              />
            </div>
          ) : null}
          <VisitDocumentsTable
            studyId={studyId}
            subjectId={subjectId}
            visitId={visitId}
            documents={documents}
          />
        </CardContent>
      </Card>
    </div>
    </CoordinatorPageScroll>
  )
}

