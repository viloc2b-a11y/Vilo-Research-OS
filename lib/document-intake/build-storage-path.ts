export function buildStoragePath(input: {
  organizationId: string
  studyId?: string | null
  subjectId?: string | null
  documentId: string
  filename: string
}): string {
  const safeName = input.filename.toLowerCase().replace(/[^a-z0-9.]+/g, '-').replace(/^-|-$/g, '')

  if (input.studyId && input.subjectId) {
    return `${input.organizationId}/studies/${input.studyId}/subjects/${input.subjectId}/documents/${input.documentId}/${safeName}`
  }

  if (input.studyId) {
    return `${input.organizationId}/studies/${input.studyId}/general/documents/${input.documentId}/${safeName}`
  }

  return `${input.organizationId}/general/documents/${input.documentId}/${safeName}`
}
