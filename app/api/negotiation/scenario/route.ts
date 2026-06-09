import { NextResponse } from 'next/server';
import { z } from 'zod';
import {
  getNegotiationResponse,
  isNegotiationScenarioId,
  type SiteChargemaster,
} from '@/lib/cliniq-core/analysis/negotiation-engine';

const ScenarioRequestSchema = z.object({
  scenario_id: z.string().min(1),
  chargemaster: z.object({}).passthrough(),
}).strict();

export async function POST(req: Request) {
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

    if (!isNegotiationScenarioId(scenario_id)) {
      return NextResponse.json(
        { error: "Bad Request", message: "Invalid scenario_id" },
        { status: 400 }
      );
    }

    const response = getNegotiationResponse(scenario_id, chargemaster);

    return NextResponse.json(response);
  } catch {
    return NextResponse.json(
      { error: "Bad Request", message: "Invalid request payload" },
      { status: 400 }
    );
  }
}
