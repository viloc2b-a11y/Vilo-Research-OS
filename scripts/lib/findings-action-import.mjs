/**
 * Phase 5.5B — Load findings + read-contract TS modules from .mjs harness (via jiti).
 */

import { createJiti } from 'jiti'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { loadCaptureModules } from './capture-shell-import.mjs'

const ROOT = join(fileURLToPath(new URL('.', import.meta.url)), '..', '..')

let _cache = null

export function loadFindingsActionModules() {
  if (_cache) return _cache

  const jiti = createJiti(import.meta.url, {
    alias: { '@': ROOT },
    interopDefault: true,
  })

  const eligibility = jiti('@/lib/source/findings/eligibility.ts')

  _cache = {
    capture: loadCaptureModules(),
    findingActionEligibility: eligibility.findingActionEligibility,
    ROOT,
  }
  return _cache
}
