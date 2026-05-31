import React from "react";
import { SiteDefenseItem } from "../../lib/site-defense/site-defense-types";
import { SiteDefenseRiskCard } from "./SiteDefenseRiskCard";

interface Props {
  title: string;
  items: SiteDefenseItem[];
  onUpdateStatus: (id: string, newStatus: string, reason?: string) => void;
}

export function SiteDefenseSection({ title, items, onUpdateStatus }: Props) {
  if (items.length === 0) return null;

  return (
    <div className="mb-8">
      <h2 className="text-xl font-bold text-gray-800 mb-4 border-b pb-2">{title}</h2>
      {items.map(item => (
        <SiteDefenseRiskCard key={item.id} item={item} onUpdateStatus={onUpdateStatus} />
      ))}
    </div>
  );
}
