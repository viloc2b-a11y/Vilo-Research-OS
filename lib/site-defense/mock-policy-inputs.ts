import { VIPPolicyInput } from "../vip-policy/vip-policy-types";

export const mockPolicyInputs: VIPPolicyInput[] = [
  {
    pattern_id: "VIP_PAT_001",
    category: "Critical Risks",
    signal_source: "EDC",
    severity: "HARD_STOP",
    basis_candidates: ["CONSENT_AFTER_PROCEDURE"],
    is_trend_only: false,
    medical_judgment_required: false,
    financial_data_available: true,
    cta_available: true,
    evidence_status: "MISSING",
    user_role: "CRC",
    blinding_exposure_risk: "NONE"
  },
  {
    pattern_id: "VIP_PAT_002",
    category: "Human Review Required",
    signal_source: "LAB_PORTAL",
    severity: "CRITICAL",
    basis_candidates: ["SUBJECT_SAFETY"],
    is_trend_only: false,
    medical_judgment_required: true,
    financial_data_available: false,
    cta_available: false,
    evidence_status: "COMPLETE",
    user_role: "CRC",
    blinding_exposure_risk: "NONE"
  },
  {
    pattern_id: "VIP_PAT_003",
    category: "Missing Evidence",
    signal_source: "PHARMACY_LOG",
    severity: "HIGH",
    basis_candidates: ["INVESTIGATIONAL_PRODUCT_CONTROL"],
    is_trend_only: false,
    medical_judgment_required: false,
    financial_data_available: false,
    cta_available: false,
    evidence_status: "CONFLICTING",
    user_role: "CRC",
    blinding_exposure_risk: "NONE"
  },
  {
    pattern_id: "VIP_PAT_004",
    category: "Revenue Risk",
    signal_source: "TREND_ENGINE",
    severity: "MEDIUM",
    basis_candidates: ["FINANCIAL_UNCERTAINTY_BOUNDARY"],
    is_trend_only: true,
    medical_judgment_required: false,
    financial_data_available: false,
    cta_available: false,
    evidence_status: "COMPLETE",
    user_role: "CRC",
    blinding_exposure_risk: "NONE"
  },
  {
    pattern_id: "VIP_PAT_005",
    category: "Coordinator Burden",
    signal_source: "RUNTIME_EVENT",
    severity: "LOW",
    basis_candidates: ["MONITORING_RISK"],
    is_trend_only: true,
    medical_judgment_required: false,
    financial_data_available: false,
    cta_available: false,
    evidence_status: "COMPLETE",
    user_role: "CRC",
    blinding_exposure_risk: "NONE"
  }
];
