"use client";

import React, { useState, useEffect } from "react";
import { SourceFormBlueprint } from "../../lib/source-studio/source-studio-types";
import { VisitState } from "../../lib/visit-execution/visit-execution-types";
import { saveFieldValue, updateVisitRuntimeState, loadVisitRuntime } from "../../lib/visit-execution/visit-persistence-actions";
import { ESourceFormRenderer } from "./eSourceFormRenderer";
import { CoordinatorCommandBar } from "./CoordinatorCommandBar";
import { StudySubjectRail } from "./StudySubjectRail";
import { SubjectTimelineNavigator } from "./SubjectTimelineNavigator";
import { VisitProcedureNavigator } from "./VisitProcedureNavigator";
import { RuntimeAlertsPanel } from "./RuntimeAlertsPanel";
import { generateDeliverableAction, getDeliverableDownloadUrl } from "../../lib/deliverables/actions";

type VisitFieldValue = string | number | boolean | null;
type RuntimeAlert = {
  id: string;
  type: "MISSING_DATA" | "VALIDATION_ERROR" | "REVIEW_NEEDED" | "BLOCKED";
  message: string;
  targetFieldId?: string;
};

interface Props {
  visitId: string;
  publishedBlueprint: SourceFormBlueprint;
}

export function VisitExecutionWorkspace({ visitId, publishedBlueprint }: Props) {
  const [state, setState] = useState<VisitState>("NOT_STARTED");
  const [values, setValues] = useState<Record<string, VisitFieldValue>>({});
  const [isSaving, setIsSaving] = useState(false);
  const [isLoaded, setIsLoaded] = useState(false);
  const [activeProcedureId, setActiveProcedureId] = useState<string>(publishedBlueprint.procedures[0]?.id || "");
  const [alerts, setAlerts] = useState<RuntimeAlert[]>([]);
  const [isGeneratingDeliverable, setIsGeneratingDeliverable] = useState(false);
  const [deliverableUrl, setDeliverableUrl] = useState<string | undefined>();

  useEffect(() => {
    async function loadData() {
      const session = await loadVisitRuntime("ST-1", "SUBJ-1", visitId);
      if (session.visit) setState(session.visit.state);
      setValues(Object.fromEntries(
        Object.entries(session.formValues || {}).map(([fieldId, record]) => [fieldId, record.value]),
      ));
      setIsLoaded(true);
    }
    loadData();
  }, [visitId]);

  const handleFieldChange = async (fieldId: string, newValue: VisitFieldValue) => {
    const oldValue = values[fieldId];
    setValues(prev => ({ ...prev, [fieldId]: newValue }));
    
    setIsSaving(true);
    await saveFieldValue(visitId, publishedBlueprint.id, fieldId, newValue, oldValue, "CRC-001");
    if (state === "NOT_STARTED") setState("IN_PROGRESS");
    
    // Clear alerts dynamically
    setAlerts(prev => prev.filter(a => a.targetFieldId !== fieldId));
    setIsSaving(false);
  };

  if (!isLoaded) return <div className="p-8 text-gray-500">Loading secure visit session...</div>;

  const isReadOnly = state === "READY_FOR_REVIEW" || state === "FINALIZED";

  const handleGenerateSourcePacket = async () => {
    try {
      setIsGeneratingDeliverable(true);
      const res = await generateDeliverableAction({
        systemCode: 'printable_source_packet',
        organizationId: '00000000-0000-0000-0000-000000000000', // Mock for workspace
        userId: '00000000-0000-0000-0000-000000000000',
        audience: 'cra',
        scope: 'visit',
        filters: { studyId: publishedBlueprint.study_id, subjectId: 'SUBJ-1', visitInstanceId: visitId }
      });

      if (res.success && 'storagePath' in res && res.storagePath) {
        const urlRes = await getDeliverableDownloadUrl(res.storagePath);
        if (urlRes.success && urlRes.signedUrl) {
          setDeliverableUrl(urlRes.signedUrl);
        } else {
          alert('Failed to get download link: ' + urlRes.error);
        }
      } else {
        alert('Generation failed: ' + ('error' in res ? res.error : 'Unknown error'));
      }
    } catch (e) {
      alert('Generation error: ' + (e instanceof Error ? e.message : 'Unknown error'));
    } finally {
      setIsGeneratingDeliverable(false);
    }
  };

  return (
    <div className="flex flex-col h-screen bg-gray-100 overflow-hidden">
      <CoordinatorCommandBar 
        studyName="VILO-ONC-001"
        selectedSubjectId="SUBJ-1"
        selectedVisitId={visitId}
        progressPercent={45}
        saveStatus={isSaving ? "SAVING" : "SAVED"}
        isReadOnly={isReadOnly}
        onSubjectChange={() => {}}
        onVisitChange={() => {}}
        onGenerateDeliverable={handleGenerateSourcePacket}
        isGeneratingDeliverable={isGeneratingDeliverable}
        deliverableUrl={deliverableUrl}
      />
      
      <div className="flex flex-1 overflow-hidden">
        <StudySubjectRail 
          subjects={[{ id: "SUBJ-1", status: "Active" }, { id: "SUBJ-2", status: "Screening" }]} 
          selectedSubjectId="SUBJ-1" 
          onSelect={() => {}} 
        />
        
        <div className="flex flex-col flex-1 overflow-hidden">
          <SubjectTimelineNavigator 
            visits={[{ id: "V-1", name: "Screening", state: "FINALIZED" }, { id: visitId, name: publishedBlueprint.name, state }]}
            selectedVisitId={visitId}
            onSelect={() => {}}
          />
          
          <RuntimeAlertsPanel alerts={alerts} onJumpToField={() => {}} />

          <div className="flex flex-1 overflow-hidden">
            <VisitProcedureNavigator 
              procedures={publishedBlueprint.procedures.map(p => ({ id: p.id, name: p.name, status: "INCOMPLETE" }))}
              activeProcedureId={activeProcedureId}
              onSelect={(id) => setActiveProcedureId(id)}
            />
            
            <div className="flex-1 overflow-y-auto p-8 relative">
              <div className="max-w-4xl mx-auto w-full">
                <ESourceFormRenderer 
                  fields={publishedBlueprint.fields}
                  values={values}
                  onFieldChange={handleFieldChange}
                  readOnly={isReadOnly}
                />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
