import { readFileSync, existsSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..')

function applyEnvFile(path, { override }) {
  if (!existsSync(path)) return
  const text = readFileSync(path, 'utf8')
  for (const line of text.split('\n')) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue
    const eq = trimmed.indexOf('=')
    if (eq === -1) continue
    const key = trimmed.slice(0, eq).trim()
    let value = trimmed.slice(eq + 1).trim()
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1)
    }
    if (override || process.env[key] === undefined) process.env[key] = value
  }
}

/**
 * Load `.env` then `.env.local`.
 * `.env.local` always wins so IDE/shell placeholders do not override real staging keys.
 */
export function loadEnvFiles() {
  applyEnvFile(resolve(root, '.env'), { override: false })
  applyEnvFile(resolve(root, '.env.local'), { override: true })
}

export function requireEnv(names) {
  loadEnvFiles()
  const missing = names.filter((n) => !process.env[n]?.trim())
  if (missing.length) {
    throw new Error(
      `Missing required environment variables: ${missing.join(', ')}\n` +
        `Copy .env.example → .env.local and fill Supabase staging values.`,
    )
  }
}

export const projectRoot = root
