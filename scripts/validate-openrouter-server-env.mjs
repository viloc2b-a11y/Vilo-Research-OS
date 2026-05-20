import fs from 'node:fs'
import path from 'node:path'

const root = process.cwd()
const publicOpenRouterEnv = ['NEXT', 'PUBLIC', 'OPENROUTER', 'API', 'KEY'].join('_')
const realSecretPattern = /sk-or-v1-[A-Za-z0-9]{20,}/g

const filesToCheck = [
  '.env.example',
  'docs/DEPLOYMENT-READINESS.md',
  'lib/openrouter/server.ts',
  'scripts/validate-openrouter-server-env.mjs',
]

const failures = []

for (const rel of filesToCheck) {
  const absolute = path.join(root, rel)
  if (!fs.existsSync(absolute)) {
    failures.push(`${rel}: missing file`)
    continue
  }

  const text = fs.readFileSync(absolute, 'utf8')
  if (text.includes(publicOpenRouterEnv)) {
    failures.push(`${rel}: public OpenRouter env token found`)
  }

  const secretMatches = text.match(realSecretPattern) ?? []
  if (secretMatches.length > 0) {
    failures.push(`${rel}: possible real OpenRouter secret found`)
  }
}

const serverHelper = fs.readFileSync(path.join(root, 'lib/openrouter/server.ts'), 'utf8')
if (!serverHelper.includes('process.env.OPENROUTER_API_KEY')) {
  failures.push('lib/openrouter/server.ts: missing OPENROUTER_API_KEY lookup')
}
if (!serverHelper.includes('OpenRouterConfigError')) {
  failures.push('lib/openrouter/server.ts: missing safe config error')
}

if (failures.length > 0) {
  console.error('OpenRouter server env validation failed:')
  for (const failure of failures) console.error(`- ${failure}`)
  process.exit(1)
}

console.log('OpenRouter server env validation passed.')
