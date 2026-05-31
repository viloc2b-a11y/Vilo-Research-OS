import { SubjectRuntimeWorkspace } from "@/components/subject-runtime/SubjectRuntimeWorkspace";

export default function SubjectRuntimePage({ params }: { params: { studyId: string, subjectId: string } }) {
  // In a real environment, the user role would be derived from the auth session.
  return <SubjectRuntimeWorkspace studyId={params.studyId} subjectId={params.subjectId} userRole="CRC" />;
}
