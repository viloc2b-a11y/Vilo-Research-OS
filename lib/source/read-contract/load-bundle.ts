/**
 * Phase 5.2B — Fetch canonical read APIs and normalize to review bundle view-model.
 */

import { fetchResponseSetReadBundle } from '@/lib/api/source/read-client'
import type { FindingsListFilters } from '@/lib/api/source/read-types'
import { normalizeEnvelopeToPanelResult } from '@/lib/source/read-contract/errors'
import {
  normalizeFindingsPanel,
  normalizeHistoryTimeline,
  normalizeManifest,
  normalizeResponseSetDetail,
} from '@/lib/source/read-contract/normalize'
import type { ResponseSetReviewBundleViewModel } from '@/lib/source/read-contract/view-models'

export async function loadResponseSetReviewBundle(
  responseSetId: string,
  organizationId: string,
  findingsFilters: FindingsListFilters = {},
): Promise<ResponseSetReviewBundleViewModel> {
  const raw = await fetchResponseSetReadBundle(responseSetId, organizationId, findingsFilters)

  return {
    responseSetId,
    organizationId,
    detail: normalizeEnvelopeToPanelResult(
      raw.detail,
      normalizeResponseSetDetail,
      'Response set detail',
    ),
    manifest: normalizeEnvelopeToPanelResult(raw.manifest, normalizeManifest, 'Manifest'),
    history: normalizeEnvelopeToPanelResult(raw.history, normalizeHistoryTimeline, 'History'),
    findings: normalizeEnvelopeToPanelResult(
      raw.findings,
      (data) => normalizeFindingsPanel(data, responseSetId, organizationId, findingsFilters),
      'Findings',
    ),
  }
}
