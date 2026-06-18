import { describe, it, expect } from 'vitest';
import {
  calculateBHR,
  calculateChargemaster,
  getNegotiationResponse,
  generateChargemasterSummary,
  formatAmount,
  NEGOTIATION_SCENARIOS,
  SiteRates,
  StartupHours,
  VisitModel,
  OpsModel,
  CloseoutModel,
  StudyParameters
} from './negotiation-engine';

describe('Negotiation Engine', () => {
  it('1. calculateBHR — known inputs', () => {
    // salary=28, benefits=30, overhead=28, margin=15
    const result = calculateBHR(28, 30, 28, 15);
    // 28 * 1.30 * 1.28 * 1.15 = 53.58 (rounded)
    expect(result).toBe(53.58);
  });

  const validRates: SiteRates = {
    pi_hourly_salary: 100,
    crc_hourly_salary: 28,
    rn_hourly_salary: 35,
    benefits_pct: 30,
    overhead_pct: 28,
    margin_pct: 15,
    billable_time_pct: 20,
    inflation_pct: 5
  };

  const validStartup: StartupHours = {
    irb_hrs: 10, proto_pi_hrs: 5, proto_crc_hrs: 10, pharmacy_hrs: 5,
    lab_hrs: 5, docs_hrs: 10, vendor_count: 3, vendor_hrs_each: 2,
    bca_hrs: 5, mock_hrs: 5, gcp_hrs: 2
  };

  const validVisit: VisitModel = {
    pi_hrs: 1, crc_hrs: 4, rn_hrs: 2, room_fee: 50, supply_cost: 20
  };

  const validOps: OpsModel = {
    amend_pi_hrs: 2, amend_crc_hrs: 4, reconsent_crc_hrs: 1,
    cra_change_crc_hrs: 5, sae_pi_hrs: 1, unscheduled_crc_hrs: 1,
    helpdesk_monthly_hrs: 2, remote_monthly_hrs: 2
  };

  const validCloseout: CloseoutModel = {
    closeout_crc_hrs: 10, irb_close_hrs: 2, pharmacy_close_hrs: 2,
    packaging_hrs: 5, storage_annual: 100, retention_years: 15,
    destruction_hrs: 2, destruction_ext_cost: 50, unexpected_fund: 500,
    retrieval_hrs: 2
  };

  const validStudy: StudyParameters = {
    total_visits: 5, total_patients: 10, study_years: 2,
    expected_amendments: 2, expected_screen_failures: 2,
    expected_cra_changes: 2, cta_available: true
  };

  it('2. calculateChargemaster with cta_available: false', () => {
    const studyNoCta = { ...validStudy, cta_available: false };
    const cm = calculateChargemaster(validRates, validStartup, validVisit, validOps, validCloseout, studyNoCta, 0, 0);
    expect(cm.certainty).toBe('REQUIRES_CTA');
    expect(cm.study.total_minimum_budget).toBeNull();
  });

  it('3. calculateChargemaster with a rate field set to NaN', () => {
    const invalidRates = { ...validRates, benefits_pct: NaN };
    const cm = calculateChargemaster(invalidRates, validStartup, validVisit, validOps, validCloseout, validStudy, 0, 0);
    expect(cm.certainty).toBe('REQUIRES_CLINIQ');
    expect(cm.events.visit_cost).toBeNull();
  });

  it('4. calculateChargemaster with full valid inputs', () => {
    const cm = calculateChargemaster(validRates, validStartup, validVisit, validOps, validCloseout, validStudy, 0, 0);
    
    expect(cm.certainty).toBe('CONFIRMED');
    expect(cm.startup.total).toBe(
      (cm.startup.irb_prep || 0) + (cm.startup.protocol_review || 0) + (cm.startup.pharmacy_setup || 0) +
      (cm.startup.lab_setup || 0) + (cm.startup.source_doc_dev || 0) + (cm.startup.vendor_integrations || 0) +
      (cm.startup.billing_coverage_analysis || 0) + (cm.startup.mock_subject_qa || 0) + (cm.startup.duplicate_gcp_training || 0)
    );

    const minBudget = cm.study.total_minimum_budget || 0;
    expect(cm.study.ask_price).toBeCloseTo(minBudget * 1.20, 2);
    expect(cm.study.batna_floor).toBeCloseTo(minBudget * 0.80, 2);
    expect(cm.study.cro_typical_offer).toBeCloseTo(minBudget * 0.55, 2);
  });

  it('5. getNegotiationResponse(startup, chargemaster_with_REQUIRES_CTA)', () => {
    const studyNoCta = { ...validStudy, cta_available: false };
    const cm = calculateChargemaster(validRates, validStartup, validVisit, validOps, validCloseout, studyNoCta, 0, 0);
    
    const response = getNegotiationResponse('startup', cm);
    expect(response.warning).not.toBeNull();
    expect(response.risk_priority).toBe('blocked');
    expect(response.negotiation_position).toContain('Do not finalize');
    expect(response.script).toContain('CTA');
  });

  it('6. getNegotiationResponse(lowball, confirmed_chargemaster)', () => {
    const cm = calculateChargemaster(validRates, validStartup, validVisit, validOps, validCloseout, validStudy, 0, 0);
    const response = getNegotiationResponse('lowball', cm);
    expect(response.amounts.ask_price).toBe(cm.study.ask_price);
    expect(response.amounts.ask_price).not.toBeNull();
  });

  it('7. generateChargemasterSummary with REQUIRES_CTA chargemaster', () => {
    const studyNoCta = { ...validStudy, cta_available: false };
    const cm = calculateChargemaster(validRates, validStartup, validVisit, validOps, validCloseout, studyNoCta, 0, 0);
    
    const summary = generateChargemasterSummary(cm, 'Site X');
    expect(summary.startsWith('⚠')).toBe(true);
    expect(summary).toContain('CTA data missing');
  });

  it('8. generateChargemasterSummary with CONFIRMED chargemaster', () => {
    const cm = calculateChargemaster(validRates, validStartup, validVisit, validOps, validCloseout, validStudy, 0, 0);
    const summary = generateChargemasterSummary(cm, 'Site Y');
    
    expect(summary).toContain('BATNA');
    expect(summary).toContain('Net 30');
  });

  it('9. formatAmount handles nullish and finite values safely', () => {
    expect(formatAmount(null)).toBe('—');
    expect(formatAmount(undefined)).toBe('—');
    expect(formatAmount(Number.NaN)).toBe('Not available');
    expect(formatAmount(0)).toBe('$0.00');
  });

  it('10. negotiation scenarios stay on the canonical 14-item list', () => {
    expect(NEGOTIATION_SCENARIOS).toHaveLength(14);
    expect(NEGOTIATION_SCENARIOS.map((scenario) => scenario.id)).toContain('fmv');
    expect(NEGOTIATION_SCENARIOS.map((scenario) => scenario.id)).toContain('storage');
  });

  it('11. getNegotiationResponse avoids $null placeholders', () => {
    const studyNoCta = { ...validStudy, cta_available: false };
    const cm = calculateChargemaster(validRates, validStartup, validVisit, validOps, validCloseout, studyNoCta, 0, 0);

    const response = getNegotiationResponse('startup', cm);
    expect(response.script).not.toContain('$null');
    expect(response.script).not.toContain('Standard response');
    expect(response.cro_tactic).not.toBe('Tactic');
    expect(response.site_response).not.toBe('Response');
    expect(response.fallback).not.toBe('Fallback');
  });

  it('12. getNegotiationResponse flags sponsor offers below internal cost', () => {
    const cm = calculateChargemaster(validRates, validStartup, validVisit, validOps, validCloseout, validStudy, 0, 0);
    const sponsorOffer = (cm.study.total_minimum_budget ?? 0) - 500;

    const response = getNegotiationResponse('lowball', cm, {
      sponsorOfferAmount: sponsorOffer,
      evidenceReferences: ['Budget workbook row 12'],
    });

    expect(response.risk_priority).toBe('high');
    expect(response.amounts.sponsor_offer).toBe(sponsorOffer);
    expect(response.amounts.gap_to_minimum).toBe(500);
    expect(response.evidence_references).toEqual(['Budget workbook row 12']);
    expect(response.site_response).toContain('below our documented cost basis');
  });

  it('13. getNegotiationResponse requests a complete sponsor offer when offer amount is missing', () => {
    const cm = calculateChargemaster(validRates, validStartup, validVisit, validOps, validCloseout, validStudy, 0, 0);

    const response = getNegotiationResponse('lowball', cm);

    expect(response.risk_priority).toBe('medium');
    expect(response.negotiation_position).toContain('Request a complete sponsor offer');
    expect(response.site_response).toContain('Please provide the complete proposed budget');
  });

  it('14. getNegotiationResponse blocks acceptance when critical items are unfunded', () => {
    const cm = calculateChargemaster(validRates, validStartup, validVisit, validOps, validCloseout, validStudy, 0, 0);

    const response = getNegotiationResponse('template', cm, {
      unfundedCriticalItems: ['screen-fail labs', 'pass-through imaging'],
    });

    expect(response.risk_priority).toBe('high');
    expect(response.negotiation_position).toContain('critical required work remains unfunded');
    expect(response.site_response).toContain('screen-fail labs');
    expect(response.site_response).toContain('pass-through imaging');
  });

  it('15. getNegotiationResponse anchors to accepted terms when present', () => {
    const cm = calculateChargemaster(validRates, validStartup, validVisit, validOps, validCloseout, validStudy, 0, 0);

    const response = getNegotiationResponse('fmv', cm, {
      acceptedTerm: {
        summary: 'Accepted procedure payment schedule v2',
        amount: 1200,
        evidenceReferences: ['Signed CTA section 4.2'],
      },
    });

    expect(response.risk_priority).toBe('low');
    expect(response.amounts.accepted_term_amount).toBe(1200);
    expect(response.negotiation_position).toContain('accepted term');
    expect(response.script).toContain('Signed CTA section 4.2');
  });

  it('16. getNegotiationResponse provides amendment-related adjustment guidance', () => {
    const cm = calculateChargemaster(validRates, validStartup, validVisit, validOps, validCloseout, validStudy, 0, 0);

    const response = getNegotiationResponse('amendment', cm);

    expect(response.risk_priority).toBe('high');
    expect(response.amounts.amendment_fee).toBe(cm.events.amendment_fee);
    expect(response.negotiation_position).toContain('billable adjustment');
    expect(response.site_response).toContain('protocol amendment');
  });

  it('17. getNegotiationResponse marks neutral offers as acceptable with contract checks', () => {
    const cm = calculateChargemaster(validRates, validStartup, validVisit, validOps, validCloseout, validStudy, 0, 0);
    const sponsorOffer = cm.study.total_minimum_budget ?? 0;

    const response = getNegotiationResponse('fmv', cm, {
      sponsorOfferAmount: sponsorOffer,
    });

    expect(response.risk_priority).toBe('low');
    expect(response.amounts.margin_above_minimum).toBe(0);
    expect(response.negotiation_position).toContain('financially acceptable');
    expect(response.fallback).toContain('final CTA');
  });
});
