import { VisitExecutionWorkspace } from "@/components/visit-execution/VisitExecutionWorkspace";
import { SourceFormBlueprint } from "@/lib/source-studio/source-studio-types";

export default async function VisitExecutionPage({ params }: { params: { studyId: string, subjectId: string, visitId: string } }) {
  // In production, fetch the PUBLISHED blueprint bound to this visit
  const publishedMock: SourceFormBlueprint = {
    id: "PUB-BP-001",
    study_id: params.studyId,
    name: "Randomization Visit",
    visit_type: "RANDOMIZATION",
    status: "PUBLISHED",
    version: 2,
    updated_at: new Date().toISOString(),
    procedures: [
      { id: "P1", name: "Informed Consent Verification", order: 0 },
      { id: "P2", name: "Vital Signs", order: 1 },
      { id: "P3", name: "Eligibility Confirmation", order: 2 }
    ],
    fields: [
      { id: "F1", label: "Systolic BP", type: "NUMBER", required: true, instructions: "mmHg", order: 0 },
      { id: "F2", label: "Diastolic BP", type: "NUMBER", required: true, instructions: "mmHg", order: 1 },
      { id: "F3", label: "Subject Meets All Eligibility Criteria?", type: "BOOLEAN", required: true, order: 2 }
    ]
  };

  return (
    <div className="h-screen w-full">
      <VisitExecutionWorkspace visitId={params.visitId} publishedBlueprint={publishedMock} />
    </div>
  );
}
