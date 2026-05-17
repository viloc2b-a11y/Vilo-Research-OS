/**
 * Phase 5.4B — Load addendum + read-contract TS modules from .mjs harness (via jiti).
 */

import { createJiti } from 'jiti'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { loadCaptureModules } from './capture-shell-import.mjs'

const ROOT = join(fileURLToPath(new URL('.', import.meta.url)), '..', '..')

let _cache = null

export function loadAddendumModules() {
  if (_cache) return _cache

  const jiti = createJiti(import.meta.url, {
    alias: { '@': ROOT },
    interopDefault: true,
  })

  const parseAddendum = jiti('@/lib/source/addendum/parse-addendum-value.ts')

  _cache = {
    capture: loadCaptureModules(),
    parseAddendumValueInput: parseAddendum.parseAddendumValueInput,
    ROOT,
  }
  return _cache
}
