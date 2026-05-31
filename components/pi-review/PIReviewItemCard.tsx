"use client";
import React from "react";
import { PIReviewItem, PIReviewStatus } from "../../lib/pi-review/pi-review-types";
import { PIAdjudicationPanel } from "./PIAdjudicationPanel";

interface Props {
  item: PIReviewItem;
  onAdjudicate: (id: string, status: PIReviewStatus, rationale: string, missingEvidence?: string) => void;
}

export function PIReviewItemCard({ item, onAdjudicate }: Props) {
  return (
    <div className="bg-white border rounded shadow-sm p-5 mb-4">
      <div className="flex justify-between items-start mb-3">
        <div>
          <h3 className="font-bold text-gray-800 text-lg">Subject: {item.subject_id} | Visit: {item.visit_id}</h3>
          <p className="text-gray-500 text-sm">Review ID: {item.review_id} | Created: {new Date(item.created_at).toLocaleString()}</p>
        </div>
        <span className={`px-3 py-1 rounded text-xs font-bold ${item.current_status === "PENDING_PI_REVIEW" ? "bg-yellow-100 text-yellow-800" : "bg-green-100 text-green-800"}`}>
          {item.current_status.replace(/_/g, " ")}
        </span>
      </div>

      <div className="grid grid-cols-2 gap-4 text-sm text-gray-700 bg-gray-50 p-3 rounded mb-4">
        <div><strong>Clinical Domain:</strong> {item.clinical_domain}</div>
        <div><strong>Source:</strong> {item.source_type} ({item.source_reference})</div>
        <div className="col-span-2"><strong>Trigger Reason:</strong> <span className="text-red-700 font-semibold">{item.trigger_reason}</span></div>
        <div className="col-span-2 text-gray-500"><strong>Evidence Context:</strong> {item.evidence_summary}</div>
      </div>

      <PIAdjudicationPanel item={item} onAdjudicate={onAdjudicate} />
    </div>
  );
}
