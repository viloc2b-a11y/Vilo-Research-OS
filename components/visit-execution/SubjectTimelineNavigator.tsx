import React from "react";

interface VisitTimelineInfo {
  id: string;
  name: string;
  state: string;
}

interface Props {
  visits: VisitTimelineInfo[];
  selectedVisitId: string;
  onSelect: (id: string) => void;
}

export function SubjectTimelineNavigator({ visits, selectedVisitId, onSelect }: Props) {
  return (
    <div className="bg-white border-b border-gray-200 px-6 py-3 flex items-center gap-2 overflow-x-auto">
      {visits.map((visit, index) => (
        <React.Fragment key={visit.id}>
          <button 
            onClick={() => onSelect(visit.id)}
            className={`flex flex-col items-center justify-center py-2 px-4 rounded transition-all min-w-[120px] ${selectedVisitId === visit.id ? 'bg-blue-50 ring-1 ring-blue-200 shadow-sm' : 'hover:bg-gray-50'}`}
          >
            <span className={`text-xs font-bold mb-1 ${selectedVisitId === visit.id ? 'text-blue-700' : 'text-gray-700'}`}>
              {visit.name}
            </span>
            <span className={`text-[10px] font-semibold uppercase px-2 py-0.5 rounded-full ${visit.state === 'FINALIZED' ? 'bg-green-100 text-green-700' : visit.state === 'IN_PROGRESS' ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-500'}`}>
              {visit.state.replace("_", " ")}
            </span>
          </button>
          {index < visits.length - 1 && (
            <div className="w-8 h-px bg-gray-300 shrink-0"></div>
          )}
        </React.Fragment>
      ))}
    </div>
  );
}
