import { describe, expect, it, vi } from 'vitest'
import { POST } from './route'
import {
  calculateChargemaster,
  type CloseoutModel,
  type OpsModel,
  type SiteRates,
  type StartupHours,
  type StudyParameters,
  type VisitModel,
} from '@/lib/cliniq-core/analysis/negotiation-engine'

vi.mock('@/lib/supabase/server', () => ({
  createServerClient: vi.fn(async () => ({
    auth: {
      getUser: vi.fn(async () => ({
        data: { user: { id: 'user-1' } },
      })),
    },
  })),
}))

const validRates: SiteRates = {
  pi_hourly_salary: 100,
  crc_hourly_salary: 28,
  rn_hourly_salary: 35,
  benefits_pct: 30,
  overhead_pct: 28,
  margin_pct: 15,
  billable_time_pct: 20,
  inflation_pct: 5,
}

const validStartup: StartupHours = {
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
}

const validVisit: VisitModel = {
  pi_hrs: 1,
  crc_hrs: 4,
  rn_hrs: 2,
  room_fee: 50,
  supply_cost: 20,
}

const validOps: OpsModel = {
  amend_pi_hrs: 2,
  amend_crc_hrs: 4,
  reconsent_crc_hrs: 1,
  cra_change_crc_hrs: 5,
  sae_pi_hrs: 1,
  unscheduled_crc_hrs: 1,
  helpdesk_monthly_hrs: 2,
  remote_monthly_hrs: 2,
}

const validCloseout: CloseoutModel = {
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
}

const validStudy: StudyParameters = {
  total_visits: 5,
  total_patients: 10,
  study_years: 2,
  expected_amendments: 2,
  expected_screen_failures: 2,
  expected_cra_changes: 2,
  cta_available: true,
}

const chargemaster = calculateChargemaster(
  validRates,
  validStartup,
  validVisit,
  validOps,
  validCloseout,
  validStudy,
  0,
  0,
)

describe('negotiation scenario route', () => {
  it('returns 400 for unsupported scenarios', async () => {
    const response = await POST(new Request('http://localhost/api/negotiation/scenario', {
      method: 'POST',
      body: JSON.stringify({
        scenario_id: 'unsupported',
        chargemaster,
      }),
    }))

    expect(response.status).toBe(400)
    await expect(response.json()).resolves.toMatchObject({
      error: 'Bad Request',
      message: 'Invalid scenario_id',
    })
  })

  it('returns scenario guidance for supported scenarios', async () => {
    const response = await POST(new Request('http://localhost/api/negotiation/scenario', {
      method: 'POST',
      body: JSON.stringify({
        scenario_id: 'startup',
        chargemaster,
        scenario_context: {
          evidenceReferences: ['Budget workbook row 8'],
        },
      }),
    }))

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toMatchObject({
      id: 'startup',
      certainty: 'CONFIRMED',
      negotiation_position: expect.stringContaining('startup fees'),
      rationale: expect.stringContaining('Startup work'),
      risk_priority: 'medium',
      evidence_references: ['Budget workbook row 8'],
    })
  })
})
