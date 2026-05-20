import SubjectDetailPage from '@/app/(ops)/subjects/[subjectId]/page'

type StudySubjectDetailPageProps = {
  params: Promise<{ studyId: string; subjectId: string }>
  searchParams: Promise<{ tab?: string }>
}

export default function StudySubjectDetailPage(props: StudySubjectDetailPageProps) {
  return <SubjectDetailPage {...props} />
}
