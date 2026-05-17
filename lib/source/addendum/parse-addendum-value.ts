/**
 * Phase 5.4A — Shape-only parsing for addendum value input (RPC remains authority).
 */

import { parseCorrectedValueInput } from '@/lib/source/correction/parse-corrected-value'

export function parseAddendumValueInput(
  raw: string,
  widgetHint: string | null | undefined,
): { ok: true; value: Record<string, unknown> } | { ok: false; message: string } {
  return parseCorrectedValueInput(raw, widgetHint)
}
