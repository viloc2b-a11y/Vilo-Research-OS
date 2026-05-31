"use client";
import React, { useState, useEffect } from "react";
import { filterPIInboxItems } from "../../lib/pi-review/pi-review-policy-adapter";
import { mockPolicyOutputsForPI } from "../../lib/pi-review/mock-pi-review-items";
import { PIReviewItem, PIReviewStatus } from "../../lib/pi-review/pi-review-types";
import { PIReviewItemCard } from "./PIReviewItemCard";

export function PIReviewInbox() {
  const [items, setItems] = useState<PIReviewItem[]>([]);

  useEffect(() => {
    // Adapter automatically filters out HARD_STOPs that are just coordinator fixes (e.g. Missing Preg Test)
    setItems(filterPIInboxItems(mockPolicyOutputsForPI));
  }, []);

  const handleAdjudicate = (id: string, status: PIReviewStatus, rationale: string, missingEvidence?: string) => {
    setItems(prev => prev.map(item => {
      if (item.review_id === id) {
        return {
          ...item,
          current_status: status,
          adjudication_data: {
            adjudication: status,
            rationale,
            reviewer_id: "Dr. Gregory House",
            reviewer_role: "PI",
            reviewed_at: new Date().toISOString(),
            requires_follow_up: status === "MORE_INFO_REQUIRED",
            missing_evidence: missingEvidence
          }
        };
      }
      return item;
    }));
  };

  const pendingCount = items.filter(i => i.current_status === "PENDING_PI_REVIEW").length;

  return (
    <div className="p-8 max-w-4xl mx-auto min-h-screen">
      <div className="mb-6 flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">PI Medical Review Inbox</h1>
          <p className="text-gray-600">Secure adjudications for Clinical Significance and Medical Authority Boundaries.</p>
        </div>
        <div className="bg-purple-100 text-purple-800 px-4 py-2 rounded font-bold">
          {pendingCount} Pending Reviews
        </div>
      </div>

      {items.length === 0 ? (
        <div className="p-8 text-center text-gray-500 bg-white rounded border">Inbox is empty. All intelligence resolved.</div>
      ) : (
        items.map(item => (
          <PIReviewItemCard key={item.review_id} item={item} onAdjudicate={handleAdjudicate} />
        ))
      )}
    </div>
  );
}
