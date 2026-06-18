import { NextResponse } from 'next/server';
import { z } from 'zod';
import { createServerClient } from '@/lib/supabase/server';
import {
  getNegotiationResponse,
  isNegotiationScenarioId,
  type NegotiationScenarioContext,
  type SiteChargemaster,
} from '@/lib/cliniq-core/analysis/negotiation-engine';

const ScenarioContextSchema = z.object({
  sponsorOfferAmount: z.number().finite().nullable().optional(),
  acceptedTerm: z.object({
    summary: z.string().min(1),
    amount: z.number().finite().nullable().optional(),
    evidenceReferences: z.array(z.string()).optional(),
  }).nullable().optional(),
  unfundedCriticalItems: z.array(z.string()).optional(),
  evidenceReferences: z.array(z.string()).optional(),
}).strict();

const ScenarioRequestSchema = z.object({
  scenario_id: z.string().min(1),
  chargemaster: z.object({}).passthrough(),
  scenario_context: ScenarioContextSchema.optional(),
}).strict();

export async function POST(req: Request) {
  const supabase = await createServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const body = await req.json().catch(() => null);
    const parsed = ScenarioRequestSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Bad Request", message: "Missing scenario_id or chargemaster" },
        { status: 400 }
      );
    }

    const { scenario_id } = parsed.data;
    const chargemaster = parsed.data.chargemaster as unknown as SiteChargemaster;
    const scenarioContext = parsed.data.scenario_context as NegotiationScenarioContext | undefined;

    if (!isNegotiationScenarioId(scenario_id)) {
      return NextResponse.json(
        { error: "Bad Request", message: "Invalid scenario_id" },
        { status: 400 }
      );
    }

    const response = getNegotiationResponse(scenario_id, chargemaster, scenarioContext);

    return NextResponse.json(response);
  } catch {
    return NextResponse.json(
      { error: "Bad Request", message: "Invalid request payload" },
      { status: 400 }
    );
  }
}
