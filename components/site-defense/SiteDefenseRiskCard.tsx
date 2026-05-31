"use client";
import React, { useState } from "react";
import { SiteDefenseItem } from "../../lib/site-defense/site-defense-types";

interface Props {
  item: SiteDefenseItem;
  onUpdateStatus: (id: string, newStatus: string, reason?: string) => void;
}

export function SiteDefenseRiskCard({ item, onUpdateStatus }: Props) {
  const [showDismiss, setShowDismiss] = useState(false);
  const [dismissReason, setDismissReason] = useState("");
  const p = item.policy;

  const handleDismiss = () => {
    if (!dismissReason.trim()) return alert("Reason required to dismiss.");
    onUpdateStatus(item.id, "DISMISSED_WITH_REASON", dismissReason);
    setShowDismiss(false);
  };

  const getBorderColor = () => {
    if (p.enforcement_level === "HARD_STOP") return "border-red-600 border-l-4";
    if (p.enforcement_level === "WARNING") return "border-yellow-500 border-l-4";
    return "border-blue-400 border-l-4";
  };

  return (
    <div className={`p-4 mb-4 bg-white rounded shadow ${getBorderColor()}`}>
      <div className="flex justify-between items-start mb-2">
        <h4 className="text-lg font-semibold text-gray-800">{item.title}</h4>
        <span className="text-sm font-mono text-gray-500">Status: {item.status}</span>
      </div>

      <div className="grid grid-cols-2 gap-4 text-sm text-gray-700 mb-4">
        <div><strong>Severity:</strong> <span className={p.severity === "HARD_STOP" ? "text-red-600 font-bold" : ""}>{p.severity}</span></div>
        <div><strong>Enforcement:</strong> {p.enforcement_level.replace("_", " ")}</div>
        <div><strong>Basis:</strong> {p.policy_basis.join(", ")}</div>
        <div><strong>Authority:</strong> {p.authority_boundary}</div>
        <div><strong>Actionability:</strong> {p.actionability}</div>
        <div><strong>Evidence:</strong> {p.evidence_status}</div>
        
        {p.financial_certainty === "REQUIRES_CTA" && p.policy_basis.includes("FINANCIAL_UNCERTAINTY_BOUNDARY") && (
          <div className="col-span-2 text-orange-600 font-semibold bg-orange-50 p-2 rounded">
            Financial impact unknown — CTA/ClinIQ required
          </div>
        )}
        
        {p.ui_actions.includes("REQUIRE_ADJUDICATION") && (
          <div className="col-span-2 text-purple-700 font-semibold bg-purple-50 p-2 rounded">
            Human Review Required: Routing to {p.escalation_target}
          </div>
        )}
      </div>

      <div className="text-xs text-gray-500 mb-4 border-t pt-2">
        <strong>Allowed Actions:</strong> {p.allowed_actions.join(", ")} | <strong>Forbidden:</strong> {p.forbidden_actions.join(", ")}<br />
        <strong>Escalation:</strong> {p.escalation_target} (within {p.escalation_due_within_hours}h) | <strong>Confidence:</strong> {p.confidence_band}<br/>
        <strong>Reason:</strong> {p.reason} <br/>
        <strong>Note:</strong> {p.uncertainty_note}
      </div>

      {item.status === "OPEN" && (
        <div className="flex space-x-2">
          <button onClick={() => onUpdateStatus(item.id, "ACKNOWLEDGED")} className="px-3 py-1 bg-blue-600 text-white rounded hover:bg-blue-700 text-sm">
            Acknowledge
          </button>
          {!showDismiss ? (
            <button onClick={() => setShowDismiss(true)} className="px-3 py-1 bg-gray-200 text-gray-700 rounded hover:bg-gray-300 text-sm">
              Dismiss
            </button>
          ) : (
            <div className="flex space-x-2 items-center">
              <input type="text" value={dismissReason} onChange={e => setDismissReason(e.target.value)} placeholder="Reason required..." className="border rounded px-2 py-1 text-sm" />
              <button onClick={handleDismiss} className="px-3 py-1 bg-red-600 text-white rounded hover:bg-red-700 text-sm">Confirm</button>
              <button onClick={() => setShowDismiss(false)} className="px-3 py-1 bg-gray-200 rounded text-sm">Cancel</button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
