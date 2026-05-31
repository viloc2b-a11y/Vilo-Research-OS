import React from "react";

interface FormProcedureInfo {
  id: string;
  name: string;
  status: "COMPLETE" | "INCOMPLETE" | "WARNING" | "REVIEW_NEEDED" | "BLOCKED";
}

interface Props {
  procedures: FormProcedureInfo[];
  activeProcedureId: string;
  onSelect: (id: string) => void;
}

export function VisitProcedureNavigator({ procedures, activeProcedureId, onSelect }: Props) {
  const getStatusColor = (status: string) => {
    switch (status) {
      case "COMPLETE": return "bg-green-500";
      case "INCOMPLETE": return "bg-gray-300";
      case "WARNING": return "bg-yellow-500";
      case "REVIEW_NEEDED": return "bg-orange-500";
      case "BLOCKED": return "bg-red-500";
      default: return "bg-gray-300";
    }
  };

  return (
    <div className="w-64 bg-white border-r border-gray-200 flex flex-col h-full">
      <div className="p-4 border-b border-gray-100">
        <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider">Required Forms</h3>
      </div>
      <div className="flex-1 overflow-y-auto p-2 space-y-1">
        {procedures.map(proc => (
          <button 
            key={proc.id}
            onClick={() => onSelect(proc.id)}
            className={`w-full text-left px-3 py-2 rounded flex items-center gap-3 text-sm transition-colors ${activeProcedureId === proc.id ? 'bg-blue-50 text-blue-700 font-medium' : 'text-gray-600 hover:bg-gray-50'}`}
          >
            <div className={`w-2.5 h-2.5 rounded-full shrink-0 ${getStatusColor(proc.status)}`}></div>
            <span className="truncate">{proc.name}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
