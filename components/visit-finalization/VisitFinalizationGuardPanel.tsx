import React from "react";
import { VisitFinalizationResult } from "../../lib/visit-finalization/visit-finalization-types";

interface Props {
  result: VisitFinalizationResult;
  onFinalize: () => void;
}

export function VisitFinalizationGuardPanel({ result, onFinalize }: Props) {
  // Guard against exposing technical IDs or internal governance scores.
  // Render based ONLY on the 4 operational states.

  const isAllowed = result.decision === "ALLOW" || result.decision === "ALLOW_WITH_WARNINGS";

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 flex flex-col gap-6 max-w-2xl mx-auto mt-8">
      
      {/* State: ALLOW */}
      {result.decision === "ALLOW" && (
        <div className="flex items-center gap-4 text-green-700 bg-green-50 p-4 rounded border border-green-200">
          <div className="w-8 h-8 rounded-full bg-green-500 flex items-center justify-center text-white font-bold">✓</div>
          <div className="font-semibold text-lg">Ready For Finalization</div>
        </div>
      )}

      {/* State: ALLOW_WITH_WARNINGS */}
      {result.decision === "ALLOW_WITH_WARNINGS" && (
        <div className="flex flex-col gap-3 text-yellow-800 bg-yellow-50 p-4 rounded border border-yellow-200">
          <div className="flex items-center gap-4">
            <div className="w-8 h-8 rounded-full bg-yellow-500 flex items-center justify-center text-white font-bold">!</div>
            <div className="font-semibold text-lg">Ready For Finalization (Warnings Present)</div>
          </div>
          <ul className="list-disc pl-14 text-sm font-medium space-y-1">
            {result.warnings.map(w => <li key={w.id}>{w.description}</li>)}
          </ul>
        </div>
      )}

      {/* State: REQUIRES_REVIEW */}
      {result.decision === "REQUIRES_REVIEW" && (
        <div className="flex flex-col gap-3 text-orange-800 bg-orange-50 p-4 rounded border border-orange-200">
          <div className="flex items-center gap-4">
            <div className="w-8 h-8 rounded-full bg-orange-500 flex items-center justify-center text-white font-bold">⚠</div>
            <div className="font-semibold text-lg">Review Required</div>
          </div>
          <div className="pl-14 text-sm font-medium space-y-2">
            {result.requiredReviews.filter(r => r.status === "PENDING").map((r, i) => (
              <div key={i} className="flex gap-2 items-center">
                <span className="bg-orange-200 text-orange-900 px-2 py-0.5 rounded-full text-xs">Pending Reviewer: {r.authorityRequired}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* State: BLOCK */}
      {result.decision === "BLOCK" && (
        <div className="flex flex-col gap-3 text-red-800 bg-red-50 p-4 rounded border border-red-200">
          <div className="flex items-center gap-4">
            <div className="w-8 h-8 rounded-full bg-red-600 flex items-center justify-center text-white font-bold">✕</div>
            <div className="font-semibold text-lg">Blocked</div>
          </div>
          <div className="pl-14">
            <div className="text-xs font-bold uppercase tracking-wider mb-2">Blocking Items</div>
            <ul className="list-disc pl-4 text-sm font-medium space-y-1">
              {result.blockingReasons.map(r => <li key={r.id}>{r.description}</li>)}
            </ul>
          </div>
        </div>
      )}

      {/* Action Area */}
      <div className="border-t border-gray-100 pt-4 flex justify-end">
        <button
          disabled={!isAllowed}
          onClick={onFinalize}
          className="px-6 py-2 bg-blue-600 text-white rounded font-medium disabled:opacity-50 disabled:cursor-not-allowed hover:bg-blue-700 transition-colors"
        >
          Finalize Visit
        </button>
      </div>
    </div>
  );
}
