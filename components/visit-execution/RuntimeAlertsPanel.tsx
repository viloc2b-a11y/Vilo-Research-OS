import React from "react";

interface Alert {
  id: string;
  type: "MISSING_DATA" | "VALIDATION_ERROR" | "REVIEW_NEEDED" | "BLOCKED";
  message: string;
  targetFieldId?: string;
}

interface Props {
  alerts: Alert[];
  onJumpToField: (fieldId: string) => void;
}

export function RuntimeAlertsPanel({ alerts, onJumpToField }: Props) {
  if (alerts.length === 0) return null;

  return (
    <div className="bg-red-50 border-b border-red-100 p-3 px-6 flex flex-col gap-2">
      <div className="text-xs font-bold text-red-800 uppercase tracking-wider">Action Items ({alerts.length})</div>
      <div className="flex flex-col gap-1">
        {alerts.map(alert => (
          <div key={alert.id} className="flex items-center justify-between bg-white rounded p-2 text-sm shadow-sm border border-red-100">
            <span className="text-red-700 font-medium">{alert.message}</span>
            {alert.targetFieldId && (
              <button 
                onClick={() => onJumpToField(alert.targetFieldId!)}
                className="text-xs font-bold text-blue-600 hover:underline"
              >
                Jump to Field →
              </button>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
