"use client";
import React, { useState, useEffect } from "react";
import { mockPolicyInputs } from "@/lib/site-defense/mock-policy-inputs";
import { adaptInputsToDefenseItems } from "@/lib/site-defense/site-defense-policy-adapter";
import { SiteDefenseItem, SiteDefenseStatus } from "@/lib/site-defense/site-defense-types";
import { SiteDefenseSummary } from "@/components/site-defense/SiteDefenseSummary";
import { SiteDefenseSection } from "@/components/site-defense/SiteDefenseSection";

export default function SiteDefenseCommandCenter() {
  const [items, setItems] = useState<SiteDefenseItem[]>([]);

  useEffect(() => {
    // Generate evaluations strictly from VIP Policy Output, not raw AI patterns
    setItems(adaptInputsToDefenseItems(mockPolicyInputs));
  }, []);

  const handleUpdateStatus = (id: string, newStatus: string, reason?: string) => {
    setItems(prev => prev.map(item => 
      item.id === id ? { ...item, status: newStatus as SiteDefenseStatus, dismissal_reason: reason } : item
    ));
  };

  const criticalRisks = items.filter(i => i.category === "Critical Risks");
  const humanReview = items.filter(i => i.category === "Human Review Required");
  const missingEvid = items.filter(i => i.category === "Missing Evidence");
  const revenueRisk = items.filter(i => i.category === "Revenue Risk");
  const coordBurden = items.filter(i => i.category === "Coordinator Burden");

  return (
    <div className="p-8 max-w-6xl mx-auto bg-gray-50 min-h-screen">
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-gray-900">Site Defense Command Center</h1>
        <p className="text-gray-600">Strictly rendering evaluated VIPPolicyOutput.</p>
      </div>

      <SiteDefenseSummary items={items} />

      <SiteDefenseSection title="Critical Risks" items={criticalRisks} onUpdateStatus={handleUpdateStatus} />
      <SiteDefenseSection title="Human Review Required" items={humanReview} onUpdateStatus={handleUpdateStatus} />
      <SiteDefenseSection title="Missing Evidence" items={missingEvid} onUpdateStatus={handleUpdateStatus} />
      <SiteDefenseSection title="Revenue Risk" items={revenueRisk} onUpdateStatus={handleUpdateStatus} />
      <SiteDefenseSection title="Coordinator Burden" items={coordBurden} onUpdateStatus={handleUpdateStatus} />
    </div>
  );
}
