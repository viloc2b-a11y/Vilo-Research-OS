import { VIPPolicyOutput } from "../vip-policy/vip-policy-types";

export type SiteDefenseStatus =
  | "OPEN"
  | "ACKNOWLEDGED"
  | "IN_PROGRESS"
  | "RESOLVED"
  | "DISMISSED_WITH_REASON";

export interface SiteDefenseItem {
  id: string;
  input_id: string; // ID of the raw VIP pattern
  category: string;
  title: string;
  status: SiteDefenseStatus;
  dismissal_reason?: string;
  policy: VIPPolicyOutput;
}
