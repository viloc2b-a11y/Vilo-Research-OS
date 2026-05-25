import { existsSync } from 'node:fs'
import { readFile } from 'node:fs/promises'
import path from 'node:path'
import { FORBIDDEN_PROTOCOL_TOKENS } from '@/lib/sanitization/forbidden-protocol-tokens'
import { detectForbiddenProtocolTokens } from '@/lib/sanitization/protocol-sanitizer'

const ROOT = process.cwd()
const SCAN_ROOTS = [
  'app',
  'components',
  'lib',
  'scripts',
  'docs',
  'data',
  'supabase',
  'fixtures',
  'tmp',
]

const TEXT_EXTENSIONS = new Set([
  '.css',
  '.csv',
  '.env',
  '.js',
  '.json',
  '.jsx',
  '.md',
  '.mjs',
  '.py',
  '.sql',
  '.ts',
  '.tsx',
  '.txt',
  '.yml',
  '.yaml',
])

const APPROVED_PATH_PATTERNS = [
  /^fixtures[\\/]/,
  /^\.phase12c-py-smoke[\\/]/,
  /^\.phase12c-py-smoke-input[\\/]/,
  /^\.tmp-phase12d-seed-in[\\/]/,
  /^lib[\\/]sanitization[\\/]forbidden-protocol-tokens\.ts$/,
]

function toRepoPath(filePath: string): string {
  return path.relative(ROOT, filePath).replaceAll(path.sep, '/')
}

function isApprovedPath(repoPath: string): boolean {
  return APPROVED_PATH_PATTERNS.some((pattern) => pattern.test(repoPath.replaceAll('/', path.sep)))
}

async function* walk(dir: string): AsyncGenerator<string> {
  const entries = await import('node:fs/promises').then((fs) =>
    fs.readdir(dir, { withFileTypes: true }),
  )
  for (const entry of entries) {
    if (entry.name === 'node_modules' || entry.name === '.git' || entry.name === '.next') continue
    const fullPath = path.join(dir, entry.name)
    if (entry.isDirectory()) {
      yield* walk(fullPath)
    } else if (entry.isFile()) {
      yield fullPath
    }
  }
}

function shouldScan(filePath: string): boolean {
  const ext = path.extname(filePath)
  if (!TEXT_EXTENSIONS.has(ext)) return false
  const repoPath = toRepoPath(filePath)
  return !isApprovedPath(repoPath)
}

async function main() {
  const findings: Array<{ file: string; tokens: string[] }> = []

  for (const root of SCAN_ROOTS) {
    const fullRoot = path.join(ROOT, root)
    if (!existsSync(fullRoot)) continue
    for await (const filePath of walk(fullRoot)) {
      if (!shouldScan(filePath)) continue
      const text = await readFile(filePath, 'utf8')
      const hits = detectForbiddenProtocolTokens(text)
      if (hits.length > 0) {
        findings.push({
          file: toRepoPath(filePath),
          tokens: [...new Set(hits.map((hit) => hit.token))],
        })
      }
    }
  }

  if (findings.length > 0) {
    console.error('Forbidden protocol identifiers found outside approved raw vault/test fixture paths.')
    for (const finding of findings) {
      console.error(`- ${finding.file}: ${finding.tokens.join(', ')}`)
    }
    console.error(`Known forbidden token count: ${FORBIDDEN_PROTOCOL_TOKENS.length}`)
    process.exit(1)
  }

  console.log('Protocol safety scan: PASS')
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error))
  process.exit(1)
})
