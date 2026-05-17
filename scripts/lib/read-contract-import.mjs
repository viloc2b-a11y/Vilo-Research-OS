/**
 * Phase 5.2C — Load read-contract TypeScript modules from .mjs harness (via jiti).
 */

import { createJiti } from 'jiti'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = join(fileURLToPath(new URL('.', import.meta.url)), '..', '..')

let _cache = null

export function loadReadContract() {
  if (_cache) return _cache

  const jiti = createJiti(import.meta.url, {
    alias: { '@': ROOT },
    interopDefault: true,
  })

  const normalize = jiti('@/lib/source/read-contract/normalize.ts')
  const errors = jiti('@/lib/source/read-contract/errors.ts')
  const format = jiti('@/lib/source/read-contract/format.ts')

  _cache = { normalize, errors, format, ROOT }
  return _cache
}
