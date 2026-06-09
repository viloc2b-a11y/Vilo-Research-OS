import { describe, expect, it } from 'vitest'
import { POST } from './route'

const validPayload = {
  rates: {
    pi_hourly_salary: 100,
    crc_hourly_salary: 28,
    rn_hourly_salary: 35,
    benefits_pct: 30,
    overhead_pct: 28,
    margin_pct: 15,
    billable_time_pct: 20,
    inflation_pct: 5,
  },
  startup_hours: {
    irb_hrs: 10,
    proto_pi_hrs: 5,
    proto_crc_hrs: 10,
    pharmacy_hrs: 5,
    lab_hrs: 5,
    docs_hrs: 10,
    vendor_count: 3,
    vendor_hrs_each: 2,
    bca_hrs: 5,
    mock_hrs: 5,
    gcp_hrs: 2,
  },
  visit_model: {
    pi_hrs: 1,
    crc_hrs: 4,
    rn_hrs: 2,
    room_fee: 50,
    supply_cost: 20,
  },
  ops_model: {
    amend_pi_hrs: 2,
    amend_crc_hrs: 4,
    reconsent_crc_hrs: 1,
    cra_change_crc_hrs: 5,
    sae_pi_hrs: 1,
    unscheduled_crc_hrs: 1,
    helpdesk_monthly_hrs: 2,
    remote_monthly_hrs: 2,
  },
  closeout_model: {
    closeout_crc_hrs: 10,
    irb_close_hrs: 2,
    pharmacy_close_hrs: 2,
    packaging_hrs: 5,
    storage_annual: 100,
    retention_years: 15,
    destruction_hrs: 2,
    destruction_ext_cost: 50,
    unexpected_fund: 500,
    retrieval_hrs: 2,
  },
  study: {
    total_visits: 5,
    total_patients: 10,
    study_years: 2,
    expected_amendments: 2,
    expected_screen_failures: 2,
    expected_cra_changes: 2,
    cta_available: true,
  },
  tpi_hrs: 0,
  tpi_avg_amount: 0,
}

describe('negotiation chargemaster route', () => {
  it('returns 400 for malformed payloads', async () => {
    const response = await POST(new Request('http://localhost/api/negotiation/chargemaster', {
      method: 'POST',
      body: JSON.stringify({
        ...validPayload,
        study: { ...validPayload.study, cta_available: 'yes' },
      }),
    }))

    expect(response.status).toBe(400)
    await expect(response.json()).resolves.toMatchObject({
      error: 'REQUIRES_CLINIQ',
      message: 'Missing required rate inputs',
    })
  })

  it('returns a chargemaster payload for valid inputs', async () => {
    const response = await POST(new Request('http://localhost/api/negotiation/chargemaster', {
      method: 'POST',
      body: JSON.stringify(validPayload),
    }))

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toMatchObject({
      certainty: 'CONFIRMED',
      study: {
        total_minimum_budget: expect.any(Number),
      },
    })
  })
})
