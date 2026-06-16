import { NextResponse } from 'next/server';
import { z } from 'zod';
import { createServerClient } from '@/lib/supabase/server';
import { calculateChargemaster } from '@/lib/cliniq-core/analysis/negotiation-engine';
import { linkChargemasterAsEvidence } from '@/lib/study-workspace/link-chargemaster-evidence';

const numericField = z.number().finite();

const RatesSchema = z.object({
  pi_hourly_salary: numericField,
  crc_hourly_salary: numericField,
  rn_hourly_salary: numericField,
  benefits_pct: numericField,
  overhead_pct: numericField,
  margin_pct: numericField,
  billable_time_pct: numericField,
  inflation_pct: numericField,
}).strict();

const StartupHoursSchema = z.object({
  irb_hrs: numericField,
  proto_pi_hrs: numericField,
  proto_crc_hrs: numericField,
  pharmacy_hrs: numericField,
  lab_hrs: numericField,
  docs_hrs: numericField,
  vendor_count: numericField,
  vendor_hrs_each: numericField,
  bca_hrs: numericField,
  mock_hrs: numericField,
  gcp_hrs: numericField,
}).strict();

const VisitModelSchema = z.object({
  pi_hrs: numericField,
  crc_hrs: numericField,
  rn_hrs: numericField,
  room_fee: numericField,
  supply_cost: numericField,
}).strict();

const OpsModelSchema = z.object({
  amend_pi_hrs: numericField,
  amend_crc_hrs: numericField,
  reconsent_crc_hrs: numericField,
  cra_change_crc_hrs: numericField,
  sae_pi_hrs: numericField,
  unscheduled_crc_hrs: numericField,
  helpdesk_monthly_hrs: numericField,
  remote_monthly_hrs: numericField,
}).strict();

const CloseoutModelSchema = z.object({
  closeout_crc_hrs: numericField,
  irb_close_hrs: numericField,
  pharmacy_close_hrs: numericField,
  packaging_hrs: numericField,
  storage_annual: numericField,
  retention_years: numericField,
  destruction_hrs: numericField,
  destruction_ext_cost: numericField,
  unexpected_fund: numericField,
  retrieval_hrs: numericField,
}).strict();

const StudySchema = z.object({
  total_visits: numericField,
  total_patients: numericField,
  study_years: numericField,
  expected_amendments: numericField,
  expected_screen_failures: numericField,
  expected_cra_changes: numericField,
  cta_available: z.boolean(),
}).strict();

const ChargemasterRequestSchema = z.object({
  rates: RatesSchema,
  startup_hours: StartupHoursSchema,
  visit_model: VisitModelSchema,
  ops_model: OpsModelSchema,
  closeout_model: CloseoutModelSchema,
  study: StudySchema,
  tpi_hrs: numericField,
  tpi_avg_amount: numericField,
  study_id: z.string().uuid().optional(),
  organization_id: z.string().uuid().optional(),
}).strict();

function badRequest() {
  return NextResponse.json(
    { error: "REQUIRES_CLINIQ", message: "Missing required rate inputs" },
    { status: 400 },
  );
}

export async function POST(req: Request) {
  const supabase = await createServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const body = await req.json().catch(() => null);
    const parsed = ChargemasterRequestSchema.safeParse(body);

    if (!parsed.success) {
      return badRequest();
    }

    const chargemaster = calculateChargemaster(
      parsed.data.rates,
      parsed.data.startup_hours,
      parsed.data.visit_model,
      parsed.data.ops_model,
      parsed.data.closeout_model,
      parsed.data.study,
      parsed.data.tpi_hrs,
      parsed.data.tpi_avg_amount
    );

    if (chargemaster.certainty === 'REQUIRES_CLINIQ') {
      return badRequest();
    }

    if (parsed.data.study_id && parsed.data.organization_id) {
      linkChargemasterAsEvidence({
        supabase,
        organizationId: parsed.data.organization_id,
        studyId: parsed.data.study_id,
        actorUserId: user.id,
        chargemasterSummary: {
          visitRevenue: chargemaster.study.visit_revenue ?? 0,
          totalMinimumBudget: chargemaster.study.total_minimum_budget ?? 0,
          askPrice: chargemaster.study.ask_price ?? 0,
          batnaFloor: chargemaster.study.batna_floor ?? 0,
          certaintyLevel: chargemaster.certainty,
        },
        studyParameters: {
          totalVisits: parsed.data.study.total_visits,
          totalPatients: parsed.data.study.total_patients,
        },
      }).catch(() => undefined)
    }

    return NextResponse.json(chargemaster);
  } catch {
    return badRequest();
  }
}
