import React from "react";
import { SiteDefenseItem } from "../../lib/site-defense/site-defense-types";

interface Props {
  items: SiteDefenseItem[];
}

export function SiteDefenseSummary({ items }: Props) {
  const total = items.length;
  const open = items.filter(i => i.status === "OPEN").length;
  const hardStops = items.filter(i => i.policy.enforcement_level === "HARD_STOP").length;
  const requireAdjudication = items.filter(i => i.policy.ui_actions.includes("REQUIRE_ADJUDICATION")).length;

  return (
    <div className="flex space-x-4 mb-6">
      <div className="p-4 bg-gray-100 rounded flex-1">
        <h3 className="text-gray-500 text-sm uppercase font-bold">Total Risks</h3>
        <p className="text-2xl font-mono">{total}</p>
      </div>
      <div className="p-4 bg-blue-100 rounded flex-1">
        <h3 className="text-blue-700 text-sm uppercase font-bold">Open Items</h3>
        <p className="text-2xl font-mono">{open}</p>
      </div>
      <div className="p-4 bg-red-100 rounded flex-1">
        <h3 className="text-red-700 text-sm uppercase font-bold">Hard Stops</h3>
        <p className="text-2xl font-mono">{hardStops}</p>
      </div>
      <div className="p-4 bg-purple-100 rounded flex-1">
        <h3 className="text-purple-700 text-sm uppercase font-bold">Pending PI Review</h3>
        <p className="text-2xl font-mono">{requireAdjudication}</p>
      </div>
    </div>
  );
}
