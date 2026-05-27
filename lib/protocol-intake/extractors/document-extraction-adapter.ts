import { exec } from 'node:child_process'
import { promisify } from 'node:util'
import { join } from 'node:path'
import { writeFile, unlink } from 'node:fs/promises'
import { randomUUID } from 'node:crypto'


const execAsync = promisify(exec)

import type { RawExtractionOutput } from '../types'

export async function extractTablesFromDocument(
  fileBuffer: Buffer,
  fileName: string,
): Promise<RawExtractionOutput> {
  const ext = fileName.toLowerCase().endsWith('.pdf') ? '.pdf' : '.xlsx'
  const tempId = randomUUID()
  const tempPath = join(process.cwd(), '.tmp', `schedule_extract_${tempId}${ext}`)

  await writeFile(tempPath, fileBuffer)

  try {
    // Execute python script
    const scriptPath = join(process.cwd(), 'scripts', 'docling_extract.py')
    // We assume the .venv is activated or we call its python explicitly
    const pythonPath = join(process.cwd(), '.venv', 'Scripts', 'python.exe')
    
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
