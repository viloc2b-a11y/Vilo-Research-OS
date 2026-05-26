const MAX_FILE_SIZE = 25 * 1024 * 1024
const ALLOWED_MIME = new Set([
  'application/pdf',
  'image/jpeg',
  'image/png',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document' // DOCX
])

export function validateDocumentUpload(file: File | null): { ok: boolean; message?: string } {
  if (!file || file.size === 0) {
    return { ok: false, message: 'File is empty or missing.' }
  }

  if (!ALLOWED_MIME.has(file.type)) {
    return { ok: false, message: 'Only PDF, JPEG, PNG, and DOCX files are supported.' }
  }

  if (file.size > MAX_FILE_SIZE) {
    return { ok: false, message: `File is too large. Maximum size is ${MAX_FILE_SIZE / (1024 * 1024)} MB.` }
  }

  return { ok: true }
}
