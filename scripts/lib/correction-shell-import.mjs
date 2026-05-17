/**
 * Phase 5.3B — Load correction + read-contract TS modules from .mjs harness (via jiti).
 */

import { createJiti } from 'jiti'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { loadCaptureModules } from './capture-shell-import.mjs'

const ROOT = join(fileURLToPath(new URL('.', import.meta.url)), '..', '..')

let _correctionCache = null

export function loadCorrectionModules() {
  if (_correctionCache) return _correctionCache

  const jiti = createJiti(import.meta.url, {
    alias: { '@': ROOT },
    interopDefault: true,
  })

  const parseCorrected = jiti('@/lib/source/correction/parse-corrected-value.ts')

  _correctionCache = {
    capture: loadCaptureModules(),
    parseCorrectedValueInput: parseCorrected.parseCorrectedValueInput,
    ROOT,
  }
  return _correctionCache
}
