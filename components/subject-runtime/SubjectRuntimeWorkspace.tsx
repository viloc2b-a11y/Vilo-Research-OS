"use client";

import React, { useState, useEffect } from "react";
import { SubjectSection, ControlledTermValue } from "../../lib/subject-runtime/subject-runtime-types";
import { 
  loadSubjectSection, 
  searchMedicalConditionTerms,
  searchMedicationTerms,
  searchAllergyTerms,
  searchSurgicalProcedureTerms,
  searchAeControlledTerms,
  saveSubjectMedicalCondition,
  saveSubjectConcomitantMedication,
  saveSubjectAllergy,
  saveSubjectSurgicalHistory,
  saveSubjectAdverseEvent
} from "../../lib/subject-runtime/subject-persistence-actions";

interface Props {
  studyId: string;
  subjectId: string;
  userRole: "CRC" | "PI" | "ADMIN";
}

type TermSearchResponse = unknown[] | { results?: unknown[] };

function normalizeTermResults(response: TermSearchResponse): unknown[] {
  return Array.isArray(response) ? response : response.results ?? [];
}

function readTermValue(result: unknown, keys: string[]): string | null {
  if (!result || typeof result !== "object") return null;
  const row = result as Record<string, unknown>;
  for (const key of keys) {
    const value = row[key];
    if (typeof value === "string" && value.trim()) return value;
  }
  return null;
}

function TermSelector({ placeholder, searchFn, onSelect }: { placeholder: string, searchFn: (q: string) => Promise<TermSearchResponse>, onSelect: (val: ControlledTermValue) => void }) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<unknown[]>([]);
  const [selected, setSelected] = useState(false);

  useEffect(() => {
    if (query.length > 1 && !selected) {
      searchFn(query).then(response => setResults(normalizeTermResults(response)));
    } else {
      setResults([]);
    }
  }, [query, selected]);

  return (
    <div className="relative">
      <input
        className="w-full border p-2 text-sm rounded focus:ring focus:border-blue-300"
        placeholder={placeholder}
        value={query}
        onChange={e => { setQuery(e.target.value); setSelected(false); }}
      />
      {results.length > 0 && !selected && (
        <ul className="absolute z-10 w-full bg-white border mt-1 max-h-40 overflow-y-auto rounded shadow-lg">
          {results.map((r, i) => {
            const label = readTermValue(r, ["label", "common_name", "medication_name", "display_name"]) ?? "Unnamed term";
            const code = readTermValue(r, ["code", "pathology_id", "medication_id", "vocabulary_id", "id"]);
            return (
              <li key={code || i} className="p-2 hover:bg-gray-100 cursor-pointer text-sm" onClick={() => {
                onSelect({ code, label, sourceLibrary: "LIBRARY", freeTextOverride: false });
                setQuery(label);
                setSelected(true);
                setResults([]);
              }}>
                {label} <span className="text-gray-400 text-xs ml-2">{code}</span>
              </li>
            );
          })}
        </ul>
      )}
      {query.length > 2 && results.length === 0 && !selected && (
        <div className="absolute z-10 w-full bg-white border mt-1 p-2 rounded shadow-lg">
           <button type="button" onClick={() => {
              onSelect({ code: null, label: query, sourceLibrary: "UNLISTED", freeTextOverride: true });
              setSelected(true);
              setResults([]);
           }} className="text-blue-600 text-sm font-medium hover:underline">
             + Use Unlisted / Other: &quot;{query}&quot;
           </button>
        </div>
      )}
    </div>
  );
}

export function SubjectRuntimeWorkspace({ studyId, subjectId, userRole }: Props) {
  const [activeSection, setActiveSection] = useState<SubjectSection>("GENERAL");
  const [isNavigating, setIsNavigating] = useState(false);

  const sections: { id: SubjectSection; label: string; roles: string[] }[] = [
    { id: "GENERAL", label: "General", roles: ["CRC", "PI", "ADMIN"] },
    { id: "VISITS", label: "Visits", roles: ["CRC", "PI", "ADMIN"] },
    { id: "ADVERSE_EVENTS", label: "Adverse Events", roles: ["CRC", "PI", "ADMIN"] },
    { id: "MEDICAL_CONDITIONS", label: "Medical Conditions", roles: ["CRC", "PI", "ADMIN"] },
    { id: "CONCOMITANT_MEDICATIONS", label: "Concomitant Medications", roles: ["CRC", "PI", "ADMIN"] },
    { id: "ALLERGIES", label: "Allergies", roles: ["CRC", "PI", "ADMIN"] },
    { id: "SURGICAL_HISTORY", label: "Surgical History", roles: ["CRC", "PI", "ADMIN"] },
    { id: "PROGRESS_NOTES", label: "Progress Notes", roles: ["CRC", "PI", "ADMIN"] },
    { id: "DOCUMENTS", label: "Documents & Labs", roles: ["CRC", "PI", "ADMIN"] },
    { id: "PROTOCOL_DEVIATIONS", label: "Protocol Deviations", roles: ["CRC", "PI", "ADMIN"] },
    { id: "EMERGENCY_CONTACTS", label: "Emergency Contacts", roles: ["CRC", "PI", "ADMIN"] },
    { id: "AUDIT_TRAIL", label: "Audit Trail", roles: ["PI", "ADMIN"] }
  ];

  const allowedSections = sections.filter(s => s.roles.includes(userRole));

  const handleOpenVisit = (visitId: string) => {
    setIsNavigating(true);
    window.location.href = `/studies/${studyId}/subjects/${subjectId}/visits/${visitId}`;
  };

  const [termState, setTermState] = useState<Record<string, ControlledTermValue>>({});

  const handleSave = async (domain: string) => {
    alert(`Saved ${domain} to Subject Runtime with ALCOA+ Audit!`);
    console.log("Saved terms:", termState);
  };

  return (
    <div className="flex h-screen bg-gray-50 overflow-hidden">
      
      {/* Subject Section Sidebar */}
      <div className="w-64 bg-white border-r border-gray-200 flex flex-col h-full shadow-sm z-10">
        <div className="p-4 border-b border-gray-100 bg-blue-900 text-white">
          <h2 className="text-xs font-bold uppercase tracking-wider text-blue-300">Subject</h2>
          <h1 className="text-lg font-bold">{subjectId}</h1>
          <select className="mt-2 text-xs bg-blue-800 text-white border-none p-1 rounded cursor-pointer">
            <option>Switch Subject (≤ 2 clicks)</option>
          </select>
        </div>
        <div className="flex-1 overflow-y-auto px-2 space-y-1 py-4">
          {allowedSections.map(s => (
            <button
              key={s.id}
              onClick={() => setActiveSection(s.id)}
              className={`w-full text-left px-3 py-2 text-sm rounded transition-colors ${activeSection === s.id ? 'bg-blue-100 text-blue-800 font-bold' : 'text-gray-700 hover:bg-gray-100 font-medium'}`}
            >
              {s.label}
            </button>
          ))}
        </div>
      </div>

      {/* Main Workspace */}
      <div className="flex-1 overflow-y-auto flex flex-col">
        {/* Header */}
        <div className="bg-white px-8 py-4 border-b border-gray-200 shadow-sm sticky top-0 z-10">
          <h2 className="text-xl font-bold text-gray-900">{sections.find(s => s.id === activeSection)?.label}</h2>
        </div>

        {/* Content Area */}
        <div className="p-8 max-w-5xl mx-auto w-full">
          
          {activeSection === "GENERAL" && (
            <div className="bg-white p-6 rounded shadow-sm border border-gray-200 grid grid-cols-2 gap-4">
              <div><span className="text-xs font-bold text-gray-500 uppercase">Screening Number</span><p className="font-semibold text-gray-800">SCR-001</p></div>
              <div><span className="text-xs font-bold text-gray-500 uppercase">Arm</span><p className="font-semibold text-gray-800">Placebo</p></div>
            </div>
          )}

          {activeSection === "VISITS" && (
            <div className="bg-white p-4 rounded shadow-sm border border-gray-200 flex justify-between items-center">
              <div>
                <h3 className="font-bold text-gray-800">Visit 1: Randomization</h3>
                <p className="text-xs text-gray-500">Scheduled: Oct 12, 2026</p>
              </div>
              <button onClick={() => handleOpenVisit("V-1")} className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded hover:bg-blue-700">
                {isNavigating ? "Opening..." : "Open Visit Runtime"}
              </button>
            </div>
          )}

          {activeSection === "MEDICAL_CONDITIONS" && (
            <div className="bg-white p-6 rounded shadow-sm border border-gray-200 space-y-4">
              <h3 className="font-bold text-gray-800">Add Medical Condition</h3>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Diagnosis Term</label>
                <TermSelector placeholder="Search Pathology Library..." searchFn={searchMedicalConditionTerms} onSelect={val => setTermState(p => ({...p, condition: val}))} />
              </div>
              <button onClick={() => saveSubjectMedicalCondition(subjectId, { diagnosis: termState.condition }).then(() => handleSave('Medical Condition'))} className="px-4 py-2 bg-blue-600 text-white text-sm rounded">Save Condition</button>
            </div>
          )}

          {activeSection === "CONCOMITANT_MEDICATIONS" && (
            <div className="bg-white p-6 rounded shadow-sm border border-gray-200 space-y-4">
              <h3 className="font-bold text-gray-800">Add Medication</h3>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Medication Term</label>
                <TermSelector placeholder="Search Medication Library..." searchFn={searchMedicationTerms} onSelect={val => setTermState(p => ({...p, medication: val}))} />
              </div>
              <button onClick={() => saveSubjectConcomitantMedication(subjectId, { medication: termState.medication }).then(() => handleSave('Concomitant Medication'))} className="px-4 py-2 bg-blue-600 text-white text-sm rounded">Save Medication</button>
            </div>
          )}

          {activeSection === "ALLERGIES" && (
            <div className="bg-white p-6 rounded shadow-sm border border-gray-200 space-y-4">
              <h3 className="font-bold text-gray-800">Add Allergy</h3>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Allergen Term</label>
                <TermSelector placeholder="Search Allergy Library..." searchFn={searchAllergyTerms} onSelect={val => setTermState(p => ({...p, allergen: val}))} />
              </div>
              <button onClick={() => saveSubjectAllergy(subjectId, { allergen: termState.allergen }).then(() => handleSave('Allergy'))} className="px-4 py-2 bg-blue-600 text-white text-sm rounded">Save Allergy</button>
            </div>
          )}

          {activeSection === "SURGICAL_HISTORY" && (
            <div className="bg-white p-6 rounded shadow-sm border border-gray-200 space-y-4">
              <h3 className="font-bold text-gray-800">Add Procedure</h3>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Surgical Procedure</label>
                <TermSelector placeholder="Search Surgical Procedures..." searchFn={searchSurgicalProcedureTerms} onSelect={val => setTermState(p => ({...p, procedure: val}))} />
              </div>
              <button onClick={() => saveSubjectSurgicalHistory(subjectId, { procedure: termState.procedure }).then(() => handleSave('Surgical History'))} className="px-4 py-2 bg-blue-600 text-white text-sm rounded">Save Procedure</button>
            </div>
          )}

          {activeSection === "ADVERSE_EVENTS" && (
            <div className="bg-white p-6 rounded shadow-sm border border-gray-200 space-y-4">
              <h3 className="font-bold text-gray-800">Add Adverse Event</h3>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Event Term</label>
                <TermSelector placeholder="Search Pathology Library..." searchFn={searchMedicalConditionTerms} onSelect={val => setTermState(p => ({...p, aeTerm: val}))} />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Severity</label>
                  <TermSelector placeholder="Search Severity..." searchFn={q => searchAeControlledTerms('AE_SEVERITY', q)} onSelect={val => setTermState(p => ({...p, aeSeverity: val}))} />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Relatedness</label>
                  <TermSelector placeholder="Search Relatedness..." searchFn={q => searchAeControlledTerms('AE_RELATEDNESS', q)} onSelect={val => setTermState(p => ({...p, aeRelatedness: val}))} />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Action Taken</label>
                  <TermSelector placeholder="Search Action Taken..." searchFn={q => searchAeControlledTerms('AE_ACTION_TAKEN', q)} onSelect={val => setTermState(p => ({...p, aeAction: val}))} />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Outcome</label>
                  <TermSelector placeholder="Search Outcome..." searchFn={q => searchAeControlledTerms('AE_OUTCOME', q)} onSelect={val => setTermState(p => ({...p, aeOutcome: val}))} />
                </div>
              </div>
              <button onClick={() => saveSubjectAdverseEvent(subjectId, { eventTerm: termState.aeTerm, severity: termState.aeSeverity, relatedness: termState.aeRelatedness, actionTaken: termState.aeAction, outcome: termState.aeOutcome }).then(() => handleSave('Adverse Event'))} className="px-4 py-2 bg-blue-600 text-white text-sm rounded mt-4">Save Adverse Event</button>
            </div>
          )}

          {!["GENERAL", "VISITS", "MEDICAL_CONDITIONS", "CONCOMITANT_MEDICATIONS", "ALLERGIES", "SURGICAL_HISTORY", "ADVERSE_EVENTS"].includes(activeSection) && (
            <div className="bg-white rounded shadow-sm border border-gray-200">
              <div className="p-4 border-b border-gray-100 flex justify-between items-center">
                <h3 className="font-bold text-gray-800">Active Records</h3>
                <button className="text-sm font-medium text-blue-600 hover:underline">+ Add Record</button>
              </div>
              <div className="p-8 text-center text-gray-400 text-sm">No active records in this section.</div>
            </div>
          )}

        </div>
      </div>
    </div>
  );
}
