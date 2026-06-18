export type FinancialCertaintyLevel = "CONFIRMED" | "ESTIMATED" | "REQUIRES_CTA" | "REQUIRES_CLINIQ"

export interface SiteRates {
  pi_hourly_salary: number
  crc_hourly_salary: number
  rn_hourly_salary: number
  benefits_pct: number
  overhead_pct: number
  margin_pct: number
  billable_time_pct: number
  inflation_pct: number
}

export interface StudyParameters {
  total_visits: number
  total_patients: number
  study_years: number
  expected_amendments: number
  expected_screen_failures: number
  expected_cra_changes: number
  cta_available: boolean
}

export interface StartupHours {
  irb_hrs: number
  proto_pi_hrs: number
  proto_crc_hrs: number
  pharmacy_hrs: number
  lab_hrs: number
  docs_hrs: number
  vendor_count: number
  vendor_hrs_each: number
  bca_hrs: number
  mock_hrs: number
  gcp_hrs: number
}

export interface VisitModel {
  pi_hrs: number
  crc_hrs: number
  rn_hrs: number
  room_fee: number
  supply_cost: number
}

export interface OpsModel {
  amend_pi_hrs: number
  amend_crc_hrs: number
  reconsent_crc_hrs: number
  cra_change_crc_hrs: number
  sae_pi_hrs: number
  unscheduled_crc_hrs: number
  helpdesk_monthly_hrs: number
  remote_monthly_hrs: number
}

export interface CloseoutModel {
  closeout_crc_hrs: number
  irb_close_hrs: number
  pharmacy_close_hrs: number
  packaging_hrs: number
  storage_annual: number
  retention_years: number
  destruction_hrs: number
  destruction_ext_cost: number
  unexpected_fund: number
  retrieval_hrs: number
}

export interface SiteChargemaster {
  certainty: FinancialCertaintyLevel

  bhr_pi: number | null
  bhr_crc: number | null
  bhr_rn: number | null
  crc_true_cost: number | null

  third_party_invoice_fee: number | null

  startup: {
    irb_prep: number | null
    protocol_review: number | null
    pharmacy_setup: number | null
    lab_setup: number | null
    source_doc_dev: number | null
    vendor_integrations: number | null
    billing_coverage_analysis: number | null
    mock_subject_qa: number | null
    duplicate_gcp_training: number | null
    total: number | null
  }

  events: {
    visit_cost: number | null
    visit_cost_with_overhead: number | null
    amendment_fee: number | null
    reconsent_per_patient: number | null
    cra_change_fee: number | null
    sae_review_fee: number | null
    unscheduled_query_fee: number | null
    helpdesk_monthly: number | null
    remote_file_monthly: number | null
    screen_failure_cost: number | null
  }

  closeout: {
    closeout_labor: number | null
    record_packaging: number | null
    storage_total: number | null
    destruction_fee: number | null
    unexpected_fund: number | null
    post_close_retrieval: number | null
    total: number | null
  }

  study: {
    visit_revenue: number | null
    screen_failure_revenue: number | null
    amendment_revenue: number | null
    reconsent_revenue: number | null
    cra_revenue: number | null
    monthly_ops_revenue: number | null
    inflation_adjustment: number | null
    total_minimum_budget: number | null
    cost_per_patient: number | null
    cost_per_visit: number | null
    ask_price: number | null
    batna_floor: number | null
    cro_typical_offer: number | null
  }
}

export interface NegotiationScenarioResponse {
  id: string
  certainty: FinancialCertaintyLevel
  negotiation_position: string
  rationale: string
  cro_tactic: string
  site_response: string
  script: string
  fallback: string
  risk_priority: 'blocked' | 'high' | 'medium' | 'low'
  evidence_references: string[]
  warning: string | null
  amounts: Record<string, number | null>
}

export interface NegotiationScenarioContext {
  sponsorOfferAmount?: number | null
  acceptedTerm?: {
    summary: string
    amount?: number | null
    evidenceReferences?: string[]
  } | null
  unfundedCriticalItems?: string[]
  evidenceReferences?: string[]
}

export const NEGOTIATION_SCENARIOS = [
  { id: 'fmv', label: 'CRO says my rates exceed Fair Market Value' },
  { id: 'holdback', label: 'Contract has a holdback clause' },
  { id: 'template', label: 'CRO will not modify their Excel template' },
  { id: 'deadline', label: 'CRO is pressuring me with a deadline' },
  { id: 'junior', label: 'CRO negotiator has no authority' },
  { id: 'cluster', label: 'CRO paying flat rate for complex visits' },
  { id: 'startup', label: 'CRO wants startup fees conditional on enrollment' },
  { id: 'overhead', label: 'CRO is challenging my overhead %' },
  { id: 'amendment', label: 'Protocol amendment - CRO will not pay' },
  { id: 'remote', label: 'CRO expects free portal management' },
  { id: 'cra_change', label: 'CRO changed the monitor mid-study' },
  { id: 'lowball', label: 'CRO first offer is far below my cost' },
  { id: 'cancel', label: 'Sponsor cancelled before first patient' },
  { id: 'storage', label: 'CRO contract restricts record destruction' },
] as const

export type NegotiationScenarioId = (typeof NEGOTIATION_SCENARIOS)[number]['id']

const NEGOTIATION_SCENARIO_ID_SET = new Set<string>(
  NEGOTIATION_SCENARIOS.map((scenario) => scenario.id),
)

export function isNegotiationScenarioId(value: unknown): value is NegotiationScenarioId {
  return typeof value === 'string' && NEGOTIATION_SCENARIO_ID_SET.has(value)
}

export function formatAmount(value: number | null | undefined): string {
  if (value === null || value === undefined) return '—'
  if (!Number.isFinite(value)) return 'Not available'
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value)
}

// --- Core calculation ---

export function calculateBHR(
  salary: number,
  benefits_pct: number,
  overhead_pct: number,
  margin_pct: number
): number {
  const bhr = salary * (1 + benefits_pct / 100) * (1 + overhead_pct / 100) * (1 + margin_pct / 100);
  return Math.round(bhr * 100) / 100;
}

function roundToTwo(num: number): number {
  return Math.round(num * 100) / 100;
}

export function calculateChargemaster(
  rates: SiteRates,
  startup_hours: StartupHours,
  visit_model: VisitModel,
  ops_model: OpsModel,
  closeout_model: CloseoutModel,
  study: StudyParameters,
  tpi_hrs: number,
  tpi_avg_amount: number
): SiteChargemaster {
  if (!study.cta_available) {
    return _buildEmptyChargemaster("REQUIRES_CTA");
  }

  const rateValues = [
    rates.pi_hourly_salary, rates.crc_hourly_salary, rates.rn_hourly_salary,
    rates.benefits_pct, rates.overhead_pct, rates.margin_pct,
    rates.billable_time_pct, rates.inflation_pct
  ];

  if (rateValues.some(v => v == null || Number.isNaN(v))) {
    return _buildEmptyChargemaster("REQUIRES_CLINIQ");
  }

  const certainty: FinancialCertaintyLevel = "CONFIRMED";

  const bhr_pi = calculateBHR(rates.pi_hourly_salary, rates.benefits_pct, rates.overhead_pct, rates.margin_pct);
  const bhr_crc = calculateBHR(rates.crc_hourly_salary, rates.benefits_pct, rates.overhead_pct, rates.margin_pct);
  const bhr_rn = calculateBHR(rates.rn_hourly_salary, rates.benefits_pct, rates.overhead_pct, rates.margin_pct);
  
  const crc_true_cost = roundToTwo(bhr_crc / (rates.billable_time_pct / 100));
  const third_party_invoice_fee = roundToTwo((tpi_hrs * bhr_crc) + (tpi_avg_amount * (0.06 / 12) * 2));

  // Events
  const visit_cost = roundToTwo((visit_model.pi_hrs * bhr_pi) + (visit_model.crc_hrs * bhr_crc) + (visit_model.rn_hrs * bhr_rn) + visit_model.room_fee + visit_model.supply_cost);
  const visit_cost_with_overhead = roundToTwo(visit_cost * (1 + rates.overhead_pct / 100));
  const screen_failure_cost = roundToTwo(visit_cost * 0.60);

  const amendment_fee = roundToTwo((ops_model.amend_pi_hrs * bhr_pi) + (ops_model.amend_crc_hrs * bhr_crc));
  const reconsent_per_patient = roundToTwo(ops_model.reconsent_crc_hrs * bhr_crc);
  const cra_change_fee = roundToTwo(ops_model.cra_change_crc_hrs * bhr_crc);
  const sae_review_fee = roundToTwo(ops_model.sae_pi_hrs * bhr_pi);
  const unscheduled_query_fee = roundToTwo(ops_model.unscheduled_crc_hrs * bhr_crc);
  const helpdesk_monthly = roundToTwo(ops_model.helpdesk_monthly_hrs * bhr_crc);
  const remote_file_monthly = roundToTwo(ops_model.remote_monthly_hrs * bhr_crc);

  // Startup
  const irb_prep = roundToTwo(startup_hours.irb_hrs * bhr_crc);
  const protocol_review = roundToTwo((startup_hours.proto_pi_hrs * bhr_pi) + (startup_hours.proto_crc_hrs * bhr_crc));
  const pharmacy_setup = roundToTwo(startup_hours.pharmacy_hrs * bhr_crc);
  const lab_setup = roundToTwo(startup_hours.lab_hrs * bhr_crc);
  const source_doc_dev = roundToTwo(startup_hours.docs_hrs * bhr_crc);
  const vendor_integrations = roundToTwo(startup_hours.vendor_count * startup_hours.vendor_hrs_each * bhr_crc);
  const billing_coverage_analysis = roundToTwo(startup_hours.bca_hrs * bhr_crc);
  const mock_subject_qa = roundToTwo(startup_hours.mock_hrs * bhr_crc);
  const duplicate_gcp_training = roundToTwo(startup_hours.gcp_hrs * bhr_crc);
  
  const startup_total = roundToTwo(irb_prep + protocol_review + pharmacy_setup + lab_setup + 
                                   source_doc_dev + vendor_integrations + billing_coverage_analysis + 
                                   mock_subject_qa + duplicate_gcp_training);

  // Closeout
  const closeout_labor = roundToTwo((closeout_model.closeout_crc_hrs + closeout_model.irb_close_hrs + closeout_model.pharmacy_close_hrs) * bhr_crc);
  const record_packaging = roundToTwo(closeout_model.packaging_hrs * bhr_crc);
  const storage_total = roundToTwo(closeout_model.storage_annual * closeout_model.retention_years);
  const destruction_fee = roundToTwo((closeout_model.destruction_hrs * bhr_crc) + closeout_model.destruction_ext_cost);
  const unexpected_fund = roundToTwo(closeout_model.unexpected_fund);
  const post_close_retrieval = roundToTwo(closeout_model.retrieval_hrs * bhr_crc);
  const closeout_total = roundToTwo(closeout_labor + record_packaging + storage_total + destruction_fee + unexpected_fund + post_close_retrieval);

  // Study
  const visit_revenue = roundToTwo(visit_cost * study.total_visits * study.total_patients);
  const screen_failure_revenue = roundToTwo(screen_failure_cost * study.expected_screen_failures);
  const amendment_revenue = roundToTwo(amendment_fee * study.expected_amendments);
  const reconsent_revenue = roundToTwo(reconsent_per_patient * study.expected_amendments * study.total_patients);
  const cra_revenue = roundToTwo(cra_change_fee * Math.max(0, study.expected_cra_changes - 1));
  const monthly_ops_revenue = roundToTwo((helpdesk_monthly + remote_file_monthly) * 12 * study.study_years);

  const r = rates.inflation_pct / 100;
  const inflation_adjustment = roundToTwo(visit_revenue * ((Math.pow(1 + r, study.study_years) - 1) - study.study_years * r) * 0.5);

  const total_minimum_budget = roundToTwo(startup_total + visit_revenue + screen_failure_revenue +
                                          amendment_revenue + reconsent_revenue + cra_revenue +
                                          monthly_ops_revenue + inflation_adjustment + closeout_total);

  const cost_per_patient = roundToTwo(total_minimum_budget / study.total_patients);
  const cost_per_visit = visit_cost;
  const ask_price = roundToTwo(total_minimum_budget * 1.20);
  const batna_floor = roundToTwo(total_minimum_budget * 0.80);
  const cro_typical_offer = roundToTwo(total_minimum_budget * 0.55);

  return {
    certainty,
    bhr_pi, bhr_crc, bhr_rn, crc_true_cost, third_party_invoice_fee,
    startup: { irb_prep, protocol_review, pharmacy_setup, lab_setup, source_doc_dev, vendor_integrations, billing_coverage_analysis, mock_subject_qa, duplicate_gcp_training, total: startup_total },
    events: { visit_cost, visit_cost_with_overhead, amendment_fee, reconsent_per_patient, cra_change_fee, sae_review_fee, unscheduled_query_fee, helpdesk_monthly, remote_file_monthly, screen_failure_cost },
    closeout: { closeout_labor, record_packaging, storage_total, destruction_fee, unexpected_fund, post_close_retrieval, total: closeout_total },
    study: { visit_revenue, screen_failure_revenue, amendment_revenue, reconsent_revenue, cra_revenue, monthly_ops_revenue, inflation_adjustment, total_minimum_budget, cost_per_patient, cost_per_visit, ask_price, batna_floor, cro_typical_offer }
  };
}

function _buildEmptyChargemaster(certainty: FinancialCertaintyLevel): SiteChargemaster {
  return {
    certainty,
    bhr_pi: null, bhr_crc: null, bhr_rn: null, crc_true_cost: null, third_party_invoice_fee: null,
    startup: { irb_prep: null, protocol_review: null, pharmacy_setup: null, lab_setup: null, source_doc_dev: null, vendor_integrations: null, billing_coverage_analysis: null, mock_subject_qa: null, duplicate_gcp_training: null, total: null },
    events: { visit_cost: null, visit_cost_with_overhead: null, amendment_fee: null, reconsent_per_patient: null, cra_change_fee: null, sae_review_fee: null, unscheduled_query_fee: null, helpdesk_monthly: null, remote_file_monthly: null, screen_failure_cost: null },
    closeout: { closeout_labor: null, record_packaging: null, storage_total: null, destruction_fee: null, unexpected_fund: null, post_close_retrieval: null, total: null },
    study: { visit_revenue: null, screen_failure_revenue: null, amendment_revenue: null, reconsent_revenue: null, cra_revenue: null, monthly_ops_revenue: null, inflation_adjustment: null, total_minimum_budget: null, cost_per_patient: null, cost_per_visit: null, ask_price: null, batna_floor: null, cro_typical_offer: null }
  };
}

// --- Negotiation response ---

export function getNegotiationResponse(
  scenario_id: string,
  chargemaster: SiteChargemaster,
  context: NegotiationScenarioContext = {}
): NegotiationScenarioResponse {
  const amounts: Record<string, number | null> = {};
  const evidenceReferences = [
    ...(context.evidenceReferences ?? []),
    ...(context.acceptedTerm?.evidenceReferences ?? []),
  ].filter((value, index, values) => value.trim() && values.indexOf(value) === index)
  const sponsorOfferAmount =
    typeof context.sponsorOfferAmount === 'number' && Number.isFinite(context.sponsorOfferAmount)
      ? context.sponsorOfferAmount
      : null
  const internalMinimum = chargemaster.study.total_minimum_budget
  const acceptedTermAmount =
    typeof context.acceptedTerm?.amount === 'number' && Number.isFinite(context.acceptedTerm.amount)
      ? context.acceptedTerm.amount
      : null
  const unfundedCriticalItems = context.unfundedCriticalItems?.filter((item) => item.trim()) ?? []

  let negotiationPosition = 'Use the site cost basis to request documented, line-item terms.'
  let rationale = 'The advisor uses the chargemaster values and provided negotiation context to keep the counteroffer tied to operational cost.'
  let sponsorFacingResponse =
    'Please update the budget so the final terms align with the documented site cost basis and identify each billable item separately.'
  let fallbackPosition =
    'Escalate internally before accepting any term that is not supported by the cost basis or written contract evidence.'
  let riskPriority: NegotiationScenarioResponse['risk_priority'] = 'medium'
  let warning: string | null = null

  if (chargemaster.certainty === "REQUIRES_CTA") {
    negotiationPosition = 'Do not finalize sponsor-facing financial terms until the CTA is available or signed.'
    rationale = 'The chargemaster is blocked because CTA availability is required before amounts can be treated as confirmed.'
    sponsorFacingResponse =
      'We can continue operational review, but final budget acceptance is pending CTA review and confirmation of invoiceable terms.'
    fallbackPosition =
      'Keep the negotiation open and request the CTA or written budget terms before committing to amounts.'
    riskPriority = 'blocked'
    warning = 'Financial amounts unavailable — CTA data required before sharing this script with a CRO'
  } else if (chargemaster.certainty === "REQUIRES_CLINIQ") {
    negotiationPosition = 'Do not send financial amounts until required rate inputs are complete.'
    rationale = 'The chargemaster cannot calculate confirmed site costs without the required internal rate inputs.'
    sponsorFacingResponse =
      'We are validating internal cost inputs and will provide a documented budget response once the cost basis is complete.'
    fallbackPosition = 'Collect missing internal rate inputs before sending a counteroffer.'
    riskPriority = 'blocked'
    warning = 'Financial amounts unavailable — ClinIQ/site rate inputs required before sharing this script with a CRO'
  } else if (context.acceptedTerm) {
    amounts.accepted_term_amount = acceptedTermAmount
    negotiationPosition = 'Use the accepted term as the current pricing anchor.'
    rationale = `An accepted term exists: ${context.acceptedTerm.summary}. New negotiation language should preserve or explicitly amend that accepted basis.`
    sponsorFacingResponse =
      `Our current position is based on the accepted term: ${context.acceptedTerm.summary}. Any change should be documented as an amendment or approved adjustment before it affects invoiceable pricing.`
    fallbackPosition = 'If the sponsor disputes the accepted term, pause invoice impact and route the change through amendment review.'
    riskPriority = 'low'
  } else if (unfundedCriticalItems.length > 0) {
    amounts.total_budget = internalMinimum
    negotiationPosition = 'Do not accept the offer while critical required work remains unfunded.'
    rationale = `The sponsor offer does not explicitly fund: ${unfundedCriticalItems.join(', ')}. Required operational work must stay visible in the budget.`
    sponsorFacingResponse =
      `The current budget does not separately fund ${unfundedCriticalItems.join(', ')}. Please add these as explicit billable items or provide written confirmation that they are covered elsewhere.`
    fallbackPosition = 'Escalate to finance/operations and hold acceptance until each critical item has written coverage.'
    riskPriority = 'high'
  } else if (sponsorOfferAmount === null && scenario_id === 'lowball') {
    amounts.total_budget = internalMinimum
    amounts.ask_price = chargemaster.study.ask_price
    negotiationPosition = 'Request a complete sponsor offer before calculating concession room.'
    rationale = 'No sponsor offer amount was provided, so the advisor cannot compare the offer against the site minimum.'
    sponsorFacingResponse =
      `Please provide the complete proposed budget, including visit, procedure, startup, screen-fail, pass-through, and payment terms. Our internal minimum is ${formatAmount(internalMinimum)} and our opening ask is ${formatAmount(chargemaster.study.ask_price)}.`
    fallbackPosition = 'Do not negotiate concessions until the complete offer is received and mapped to the SOA.'
    riskPriority = 'medium'
  } else if (
    sponsorOfferAmount !== null &&
    internalMinimum !== null &&
    sponsorOfferAmount < internalMinimum
  ) {
    amounts.sponsor_offer = sponsorOfferAmount
    amounts.total_budget = internalMinimum
    amounts.gap_to_minimum = roundToTwo(internalMinimum - sponsorOfferAmount)
    amounts.ask_price = chargemaster.study.ask_price
    negotiationPosition = 'Counter the sponsor offer because it is below the internal minimum cost basis.'
    rationale = `The sponsor offer is ${formatAmount(sponsorOfferAmount)}, which is ${formatAmount(amounts.gap_to_minimum)} below the site minimum of ${formatAmount(internalMinimum)}.`
    sponsorFacingResponse =
      `The current offer of ${formatAmount(sponsorOfferAmount)} is below our documented cost basis. We can continue if the budget is revised to at least ${formatAmount(internalMinimum)}, with an opening position of ${formatAmount(chargemaster.study.ask_price)} to cover operational risk.`
    fallbackPosition =
      `If the sponsor cannot reach the site minimum, hold at the walk-away floor of ${formatAmount(chargemaster.study.batna_floor)} and escalate before acceptance.`
    riskPriority = 'high'
  } else if (
    sponsorOfferAmount !== null &&
    internalMinimum !== null &&
    sponsorOfferAmount >= internalMinimum
  ) {
    amounts.sponsor_offer = sponsorOfferAmount
    amounts.total_budget = internalMinimum
    amounts.margin_above_minimum = roundToTwo(sponsorOfferAmount - internalMinimum)
    negotiationPosition = 'The offer is financially acceptable if contract terms preserve invoiceability and payment timing.'
    rationale = `The sponsor offer is ${formatAmount(sponsorOfferAmount)}, which meets or exceeds the internal minimum of ${formatAmount(internalMinimum)}.`
    sponsorFacingResponse =
      'The proposed amount is within an acceptable range pending confirmation of invoiceable procedures, pass-through handling, screen-fail terms, and payment timing.'
    fallbackPosition = 'Accept only after the final CTA/budget language matches the approved financial terms.'
    riskPriority = 'low'
  } else if (scenario_id === 'startup') {
    amounts.startup_total = chargemaster.startup.total;
    negotiationPosition = 'Keep startup fees non-refundable and payable at signature.'
    rationale = `Startup work creates site cost before enrollment; the calculated startup total is ${formatAmount(chargemaster.startup.total)}.`
    sponsorFacingResponse = `Our non-refundable startup fee is ${formatAmount(chargemaster.startup.total)}, payable at contract signature because these activities occur before enrollment revenue exists.`
    fallbackPosition = 'If the sponsor resists, separate minimum startup activation from enrollment-dependent visit revenue.'
    riskPriority = 'medium'
  } else if (scenario_id === 'cluster') {
    amounts.visit_cost = chargemaster.events.visit_cost;
    negotiationPosition = 'Reject flat visit bundling when it hides procedure-level work.'
    rationale = `The calculated per-visit cost is ${formatAmount(chargemaster.events.visit_cost)} before separately negotiated procedure and pass-through terms.`
    sponsorFacingResponse = `A flat visit rate does not show the execution burden. The visit component is ${formatAmount(chargemaster.events.visit_cost)}, and procedure-level items should remain separately invoiceable.`
    fallbackPosition = 'Accept a flat structure only if the written budget states which procedures and pass-throughs remain separately billable.'
    riskPriority = 'medium'
  } else if (scenario_id === 'amendment') {
    amounts.amendment_fee = chargemaster.events.amendment_fee;
    negotiationPosition = 'Treat amendment work as a billable adjustment, not free study administration.'
    rationale = `The amendment model calculates ${formatAmount(chargemaster.events.amendment_fee)} for PI/CRC review and operational update time.`
    sponsorFacingResponse = `The protocol amendment requires additional PI/CRC review and operational updates. Please add an amendment fee of ${formatAmount(chargemaster.events.amendment_fee)} or provide written confirmation of equivalent coverage.`
    fallbackPosition = 'If the sponsor refuses a fee, require written scope limits and escalate before absorbing amendment labor.'
    riskPriority = 'high'
  } else if (scenario_id === 'cra_change') {
    amounts.cra_change_fee = chargemaster.events.cra_change_fee;
    negotiationPosition = 'Bill monitor transition work after the first CRA change.'
    rationale = `The calculated change-of-monitor fee is ${formatAmount(chargemaster.events.cra_change_fee)} for coordinator transition time.`
    sponsorFacingResponse = `Additional monitor transitions create site reorientation work. Please include a change-of-monitor fee of ${formatAmount(chargemaster.events.cra_change_fee)} from the second change onward.`
    fallbackPosition = 'Document the transition burden and escalate repeated CRA churn as a budget amendment.'
    riskPriority = 'medium'
  } else if (scenario_id === 'fmv') {
    amounts.ask_price = chargemaster.study.ask_price;
    negotiationPosition = 'Anchor FMV discussion to documented site cost and consistent institutional policy.'
    rationale = `The opening ask is ${formatAmount(chargemaster.study.ask_price)}, derived from the site cost basis plus risk margin.`
    sponsorFacingResponse = `Our ask of ${formatAmount(chargemaster.study.ask_price)} reflects documented site cost, overhead, and consistent institutional policy. Please identify the specific line item you believe exceeds FMV so we can compare it to the underlying work.`
    fallbackPosition = `Do not go below the documented floor of ${formatAmount(chargemaster.study.batna_floor)} without finance approval.`
    riskPriority = 'medium'
  } else if (scenario_id === 'holdback') {
    amounts.batna_floor = chargemaster.study.batna_floor;
    negotiationPosition = 'Limit or remove holdback that pushes realized revenue below the walk-away floor.'
    rationale = `The walk-away floor is ${formatAmount(chargemaster.study.batna_floor)}; holdback terms can create cash-flow and earned-revenue leakage.`
    sponsorFacingResponse = `We cannot accept holdback language that reduces realized payment below our documented floor of ${formatAmount(chargemaster.study.batna_floor)}. Please remove the holdback or cap it with clear release timing.`
    fallbackPosition = 'If holdback remains, require milestone-based release dates and finance approval.'
    riskPriority = 'high'
  } else {
    negotiationPosition = 'Keep the response tied to documented operational cost and written terms.'
    rationale = 'No specialized scenario rule changed the financial position, so the safest response is to preserve line-item clarity and contract evidence.'
    sponsorFacingResponse =
      'Please keep visit, procedure, startup, pass-through, screen-fail, and payment terms explicit in the budget so both parties can reconcile work performed to payment owed.'
    fallbackPosition = 'Escalate if the sponsor requests bundled, undocumented, or non-invoiceable terms.'
    riskPriority = 'medium'
  }

  const script = [
    `Position: ${negotiationPosition}`,
    `Rationale: ${rationale}`,
    `Sponsor-facing response: ${sponsorFacingResponse}`,
    `Fallback: ${fallbackPosition}`,
    `Priority: ${riskPriority}`,
    evidenceReferences.length > 0
      ? `Evidence: ${evidenceReferences.join('; ')}`
      : 'Evidence: No source reference provided.',
  ].join('\n');

  return {
    id: scenario_id,
    certainty: chargemaster.certainty,
    negotiation_position: negotiationPosition,
    rationale,
    cro_tactic: negotiationPosition,
    site_response: sponsorFacingResponse,
    script,
    fallback: fallbackPosition,
    risk_priority: riskPriority,
    evidence_references: evidenceReferences,
    warning,
    amounts
  };
}

// --- Chargemaster summary for sponsor packet ---

export function generateChargemasterSummary(
  cm: SiteChargemaster,
  site_name: string
): string {
  if (cm.certainty === "REQUIRES_CTA" || cm.certainty === "REQUIRES_CLINIQ") {
    const reason = cm.certainty === "REQUIRES_CTA" ? "CTA data missing" : "ClinIQ data missing";
    return `⚠ Financial summary unavailable — [${reason}]`;
  }

  return `SITE COST SUMMARY — [${site_name}]
Certainty level: [${cm.certainty}]
─────────────────────────────────────
PHASE 1 — STARTUP (NON-REFUNDABLE, PAYABLE AT SIGNATURE)
  IRB/regulatory prep:         ${formatAmount(cm.startup.irb_prep)}
  Protocol review (PI + CRC):  ${formatAmount(cm.startup.protocol_review)}
  Pharmacy setup:              ${formatAmount(cm.startup.pharmacy_setup)}
  Lab setup:                   ${formatAmount(cm.startup.lab_setup)}
  Source document development: ${formatAmount(cm.startup.source_doc_dev)}
  Vendor/tech integrations:    ${formatAmount(cm.startup.vendor_integrations)}
  Billing coverage analysis:   ${formatAmount(cm.startup.billing_coverage_analysis)}
  Mock subject QA:             ${formatAmount(cm.startup.mock_subject_qa)}
  Duplicate GCP training:      ${formatAmount(cm.startup.duplicate_gcp_training)}
  STARTUP TOTAL:               ${formatAmount(cm.startup.total)}

PHASE 2 — PER-EVENT INVOICEABLE RATES
  Standard visit cost:         ${formatAmount(cm.events.visit_cost)}
  Protocol amendment:          ${formatAmount(cm.events.amendment_fee)} per amendment
  Re-consent per patient:      ${formatAmount(cm.events.reconsent_per_patient)} per patient
  Change of monitor:           ${formatAmount(cm.events.cra_change_fee)} per change (from 2nd change)
  SAE/safety report review:    ${formatAmount(cm.events.sae_review_fee)} per report
  Unscheduled query:           ${formatAmount(cm.events.unscheduled_query_fee)} per occurrence
  Subject helpdesk (tech):     ${formatAmount(cm.events.helpdesk_monthly)}/month
  Remote file management:      ${formatAmount(cm.events.remote_file_monthly)}/month

PHASE 3 — CLOSE-OUT & POST-STUDY
  Close-out labor:             ${formatAmount(cm.closeout.closeout_labor)}
  Record packaging:            ${formatAmount(cm.closeout.record_packaging)}
  Record storage:              ${formatAmount(cm.closeout.storage_total)} (X years)
  Destruction & e-waste:       ${formatAmount(cm.closeout.destruction_fee)}
  Unexpected cost fund:        ${formatAmount(cm.closeout.unexpected_fund)}
  CLOSEOUT TOTAL:              ${formatAmount(cm.closeout.total)}

─────────────────────────────────────
FULL STUDY FINANCIAL POSITION
  Minimum budget required:     ${formatAmount(cm.study.total_minimum_budget)}
  Cost per patient:            ${formatAmount(cm.study.cost_per_patient)}
  Site opening position (ask): ${formatAmount(cm.study.ask_price)}
  Walk-away floor (BATNA):     ${formatAmount(cm.study.batna_floor)}
  Typical CRO first offer:     ${formatAmount(cm.study.cro_typical_offer)} (benchmark: ~55% of real cost)
─────────────────────────────────────
All fees are institutional policy. Rates apply equally to all sponsors.
Startup fees are non-refundable and payable at contract signature.
Payment terms: Net 30, EDC-triggered, 0% holdback.`;
}
