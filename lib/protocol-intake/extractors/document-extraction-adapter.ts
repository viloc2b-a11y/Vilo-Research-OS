import { exec } from 'node:child_process'
import { promisify } from 'node:util'
import { join } from 'node:path'
import { existsSync } from 'node:fs'
import { writeFile, unlink, mkdir } from 'node:fs/promises'
import { randomUUID } from 'node:crypto'


const execAsync = promisify(exec)

import type { RawExtractionOutput } from '../types'

function resolvePythonPath(): string {
  const override = process.env.PROTOCOL_INTAKE_PYTHON
  if (override && existsSync(override)) return override
  const windows = join(process.cwd(), '.venv', 'Scripts', 'python.exe')
  if (existsSync(windows)) return windows
  const posix = join(process.cwd(), '.venv', 'bin', 'python')
  if (existsSync(posix)) return posix
  // Last resort: rely on PATH-resolved python (exec failures fall back to review_required).
  return 'python'
}

const SUPPORTED_EXTS = ['.pdf', '.docx', '.xlsx', '.csv'] as const

function resolveExtension(fileName: string): string {
  const lower = fileName.toLowerCase()
  for (const ext of SUPPORTED_EXTS) {
    if (lower.endsWith(ext)) return ext
  }
  // Default to PDF: docling will reject genuinely unsupported inputs and the
  // caller treats any error as "review_required" (no crash, no fake data).
  return '.pdf'
}

export async function extractTablesFromDocument(
  fileBuffer: Buffer,
  fileName: string,
): Promise<RawExtractionOutput> {
  const ext = resolveExtension(fileName)
  const tempId = randomUUID()
  const tempDir = join(process.cwd(), '.tmp')
  const tempPath = join(tempDir, `schedule_extract_${tempId}${ext}`)

  await mkdir(tempDir, { recursive: true })
  await writeFile(tempPath, fileBuffer)

  try {
    // Execute the existing extraction script (docling/openpyxl/stdlib).
    const scriptPath = join(process.cwd(), 'scripts', 'docling_extract.py')
    const pythonPath = resolvePythonPath()

    const { stdout } = await execAsync(`"${pythonPath}" "${scriptPath}" "${tempPath}"`, {
      maxBuffer: 1024 * 1024 * 50, // 50MB buffer for large HTML output
    })

    const result = JSON.parse(stdout) as RawExtractionOutput
    return result
  } catch (error) {
    console.error('docling extract error:', error)
    return { error: error instanceof Error ? error.message : 'Unknown extraction error' }
  } finally {
    // Cleanup
    await unlink(tempPath).catch(() => {})
  }
}
