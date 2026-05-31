import React from "react";

interface Props {
  studyName: string;
  selectedSubjectId: string;
  selectedVisitId: string;
  progressPercent: number;
  saveStatus: "SAVED" | "SAVING" | "UNSAVED";
  onSubjectChange: (id: string) => void;
  onVisitChange: (id: string) => void;
}

export function CoordinatorCommandBar({ studyName, selectedSubjectId, selectedVisitId, progressPercent, saveStatus, onSubjectChange, onVisitChange }: Props) {
  return (
    <div className="sticky top-0 z-50 flex items-center justify-between bg-blue-900 text-white px-4 py-3 shadow-md">
      <div className="flex items-center gap-6">
        <h1 className="font-bold text-lg tracking-tight">{studyName}</h1>
        
        <div className="flex items-center gap-2 bg-blue-800 rounded px-3 py-1">
          <span className="text-xs text-blue-300 uppercase tracking-wider font-semibold">Subject</span>
          <select 
            value={selectedSubjectId} 
            onChange={e => onSubjectChange(e.target.value)}
            className="bg-transparent border-none text-white font-medium text-sm focus:ring-0 p-0 pr-4"
          >
            <option value="SUBJ-001" className="text-black">SUBJ-001 (Active)</option>
            <option value="SUBJ-002" className="text-black">SUBJ-002 (Screening)</option>
          </select>
        </div>

        <div className="flex items-center gap-2 bg-blue-800 rounded px-3 py-1">
          <span className="text-xs text-blue-300 uppercase tracking-wider font-semibold">Visit</span>
          <select 
            value={selectedVisitId} 
            onChange={e => onVisitChange(e.target.value)}
            className="bg-transparent border-none text-white font-medium text-sm focus:ring-0 p-0 pr-4"
          >
            <option value="V-1" className="text-black">Screening</option>
            <option value="V-2" className="text-black">Baseline</option>
            <option value="V-3" className="text-black">Randomization</option>
          </select>
        </div>
      </div>

      <div className="flex items-center gap-6">
        <div className="flex items-center gap-3">
          <div className="w-32 h-2 bg-blue-800 rounded-full overflow-hidden">
            <div className="h-full bg-green-400" style={{ width: `${progressPercent}%` }}></div>
          </div>
          <span className="text-xs font-bold">{progressPercent}%</span>
        </div>
        <div className="text-xs font-medium flex items-center gap-2">
          {saveStatus === "SAVING" && <span className="text-blue-300 animate-pulse">Saving...</span>}
          {saveStatus === "SAVED" && <span className="text-green-400">✓ Saved</span>}
          {saveStatus === "UNSAVED" && <span className="text-yellow-400">Unsaved Changes</span>}
        </div>
      </div>
    </div>
  );
}
