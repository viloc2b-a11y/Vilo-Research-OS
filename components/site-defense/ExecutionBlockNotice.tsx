"use client";
import React from "react";
import { ExecutionGuardOutput } from "../../lib/site-defense/execution-guard-types";

interface Props {
  guardOutput: ExecutionGuardOutput;
}

export function ExecutionBlockNotice({ guardOutput }: Props) {
  if (guardOutput.allowed) return null;

  return (
    <div className="bg-red-50 border-l-4 border-red-600 p-4 mb-6 shadow-sm">
      <div className="flex items-start">
        <div className="flex-shrink-0">
          <span className="text-red-600 font-bold text-lg">⚠️ ACTION BLOCKED</span>
        </div>
        <div className="ml-3 w-full">
          <h3 className="text-red-800 font-semibold mb-2">Vilo OS Site Defense Guard</h3>
          <ul className="list-disc pl-5 text-red-700 text-sm mb-3">
            {guardOutput.blocking_reasons.map((r, i) => <li key={i}>{r}</li>)}
          </ul>

          {guardOutput.override_allowed ? (
            <div className="bg-white p-3 rounded border border-red-200 mt-2">
              <p className="text-xs font-bold text-gray-700 uppercase mb-1">Override Available</p>
              <p className="text-sm text-gray-600 mb-2">
                This action can be overridden by: <span className="font-mono">{guardOutput.override_roles_allowed.join(", ")}</span>
              </p>
              {/* Future override injection point */}
            </div>
          ) : (
            <div className="bg-red-100 p-2 rounded text-red-800 text-xs font-bold uppercase">
              Strict Enforcement. No overrides permitted.
            </div>
          )}

          {guardOutput.authority_boundary !== "SITE_CAN_ACT" && (
            <p className="text-xs text-purple-700 font-bold mt-2 uppercase">
              Authority Required: {guardOutput.authority_boundary}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
