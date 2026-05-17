/**
 * Phase 5.2E — Load capture + read-contract TS modules from .mjs harness (via jiti).
 */

import { createJiti } from 'jiti'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = join(fileURLToPath(new URL('.', import.meta.url)), '..', '..')

let _cache = null

export function loadCaptureModules() {
  if (_cache) return _cache

  const jiti = createJiti(import.meta.url, {
    alias: { '@': ROOT },
    interopDefault: true,
  })

  const captureNormalize = jiti('@/lib/source/capture/normalize-capture-fields.ts')
  const captureParse = jiti('@/lib/source/capture/parse-form.ts')
  const readNormalize = jiti('@/lib/source/read-contract/normalize.ts')
  const readErrors = jiti('@/lib/source/read-contract/errors.ts')

  _cache = {
    normalizeCaptureFields: captureNormalize.normalizeCaptureFields,
    resolveCaptureFieldKind: captureNormalize.resolveCaptureFieldKind,
    parseCaptureFormToResponses: captureParse.parseCaptureFormToResponses,
    normalizeResponseSetDetail: readNormalize.normalizeResponseSetDetail,
    normalizeManifest: readNormalize.normalizeManifest,
    normalizeHistoryTimeline: readNormalize.normalizeHistoryTimeline,
    normalizeFindingsPanel: readNormalize.normalizeFindingsPanel,
    normalizeEnvelopeToPanelResult: readErrors.normalizeEnvelopeToPanelResult,
    ROOT,
  }
  return _cache
}
