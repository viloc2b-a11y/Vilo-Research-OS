import React from "react";

interface SubjectInfo {
  id: string;
  status: string;
}

interface Props {
  subjects: SubjectInfo[];
  selectedSubjectId: string;
  onSelect: (id: string) => void;
}

export function StudySubjectRail({ subjects, selectedSubjectId, onSelect }: Props) {
  return (
    <div className="w-48 bg-gray-50 border-r border-gray-200 flex flex-col h-full">
      <div className="p-3 border-b border-gray-200">
        <input 
          type="text" 
          placeholder="Find Subject..." 
          className="w-full text-xs p-1.5 border border-gray-300 rounded focus:border-blue-500 focus:ring-0" 
        />
      </div>
      <div className="flex-1 overflow-y-auto">
        {subjects.map(subj => (
          <button 
            key={subj.id}
            onClick={() => onSelect(subj.id)}
            className={`w-full text-left px-4 py-3 border-b border-gray-100 flex flex-col gap-1 hover:bg-white transition-colors ${selectedSubjectId === subj.id ? 'bg-white border-l-4 border-l-blue-600' : ''}`}
          >
            <span className={`text-sm font-semibold ${selectedSubjectId === subj.id ? 'text-blue-700' : 'text-gray-700'}`}>
              {subj.id}
            </span>
            <span className="text-[10px] uppercase font-bold text-gray-500">{subj.status}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
