"use client";
import React, { useState } from "react";
import { PIReviewItem, PIReviewStatus } from "../../lib/pi-review/pi-review-types";

interface Props {
  item: PIReviewItem;
  onAdjudicate: (id: string, status: PIReviewStatus, rationale: string, missingEvidence?: string) => void;
}

export function PIAdjudicationPanel({ item, onAdjudicate }: Props) {
  const [status, setStatus] = useState<PIReviewStatus>("CS");
  const [rationale, setRationale] = useState("");
  const [missingEvidence, setMissingEvidence] = useState("");

  const handleSubmit = () => {
    if (!rationale.trim()) return alert("Rationale is legally required for adjudication.");
    if (status === "MORE_INFO_REQUIRED" && !missingEvidence.trim()) return alert("Must specify what evidence is missing.");
    onAdjudicate(item.review_id, status, rationale, missingEvidence);
  };

  if (item.current_status === "CS" || item.current_status === "NCS" || item.current_status === "ESCALATED_TO_MEDICAL_MONITOR" || item.current_status === "RESOLVED") {
    return (
      <div className="bg-gray-100 p-4 rounded mt-4 text-sm text-gray-700 border">
        <strong>Adjudicated:</strong> {item.current_status} <br/>
        <strong>Rationale:</strong> {item.adjudication_data?.rationale} <br/>
        <strong>By:</strong> {item.adjudication_data?.reviewer_id} ({item.adjudication_data?.reviewer_role}) at {item.adjudication_data?.reviewed_at}
      </div>
    );
  }

  return (
    <div className="bg-blue-50 p-4 rounded mt-4 border border-blue-200">
      <h4 className="font-bold text-blue-800 mb-2">Medical Adjudication Decision</h4>
      <div className="flex flex-wrap gap-2 mb-3">
        {["CS", "NCS", "MORE_INFO_REQUIRED", "ESCALATED_TO_MEDICAL_MONITOR"].map((s) => (
          <label key={s} className="flex items-center space-x-1 text-sm bg-white px-2 py-1 border rounded cursor-pointer">
            <input type="radio" name={`adj-${item.review_id}`} value={s} checked={status === s} onChange={() => setStatus(s as PIReviewStatus)} />
            <span className="font-mono">{s}</span>
          </label>
        ))}
      </div>
      
      {status === "MORE_INFO_REQUIRED" && (
        <input 
          type="text" 
          value={missingEvidence} 
          onChange={e => setMissingEvidence(e.target.value)} 
          placeholder="Specify missing evidence/labs required..." 
          className="w-full border p-2 mb-2 text-sm rounded"
        />
      )}

      <textarea 
        value={rationale} 
        onChange={e => setRationale(e.target.value)} 
        placeholder="Enter medical rationale for this decision. Required for audit trail." 
        className="w-full border p-2 mb-2 text-sm rounded h-20"
      />
      
      <button onClick={handleSubmit} className="bg-blue-600 text-white px-4 py-2 rounded text-sm font-bold hover:bg-blue-700">
        Sign & Adjudicate
      </button>
    </div>
  );
}
