import { SubjectRuntimeWorkspace } from "@/components/subject-runtime/SubjectRuntimeWorkspace";

type SubjectRuntimePreviewPageProps = {
  params: Promise<{ studyId: string; subjectId: string }>;
};

export default async function SubjectRuntimePreviewPage({
  params,
}: SubjectRuntimePreviewPageProps) {
  const { studyId, subjectId } = await params;

  // Legacy preview surface. The canonical subject chart lives at
  // /studies/[studyId]/subjects/[subjectId].
  return (
    <SubjectRuntimeWorkspace
      studyId={studyId}
      subjectId={subjectId}
      userRole="CRC"
    />
  );
}
