import { SourceStudioWorkspace } from "@/components/source-studio/SourceStudioWorkspace";
import { SourceFormBlueprint } from "@/lib/source-studio/source-studio-types";

// Server Component simulating fetch from DB
export default async function SourceStudioPage({ params }: { params: { studyId: string } }) {
  
  // Simulated initial payload from AI Parser (Document Intake)
  const initialBlueprints: SourceFormBlueprint[] = [
    {
      id: "FRM-001",
      study_id: params.studyId,
      name: "Screening Visit",
      visit_type: "SCREENING",
      status: "DRAFT",
      version: 1,
      updated_at: new Date().toISOString(),
      procedures: [
        { id: "P-1", name: "Informed Consent", order: 0 },
        { id: "P-2", name: "Vital Signs", order: 1 }
      ],
      fields: [
        { id: "F-1", label: "Date of Consent", type: "DATE", required: true, order: 0 },
        { id: "F-2", label: "Heart Rate", type: "NUMBER", required: true, instructions: "Beats per minute", order: 1 }
      ]
    },
    {
      id: "FRM-002",
      study_id: params.studyId,
      name: "Baseline Visit",
      visit_type: "BASELINE",
      status: "DRAFT",
      version: 1,
      updated_at: new Date().toISOString(),
      procedures: [
        { id: "P-3", name: "Randomization", order: 0 }
      ],
      fields: [
        { id: "F-3", label: "Randomization ID", type: "TEXT", required: true, order: 0 }
      ]
    }
  ];

  return (
    <div className="h-screen w-full">
      <SourceStudioWorkspace studyId={params.studyId} initialForms={initialBlueprints} />
    </div>
  );
}
