export async function pollIntelligenceDocumentUntilSettled(
  organizationId: string,
  studyId: string,
  intelligenceDocumentId: string,
  options?: { intervalMs?: number; maxAttempts?: number },
): Promise<{ intelligenceStatus: string; chunkCount: number } | null> {
  const intervalMs = options?.intervalMs ?? 2000
  const maxAttempts = options?.maxAttempts ?? 30

  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    const res = await fetch(
      `/api/document-intelligence/documents/${encodeURIComponent(intelligenceDocumentId)}?organization_id=${encodeURIComponent(organizationId)}&study_id=${encodeURIComponent(studyId)}`,
    )
    const data = (await res.json()) as {
      document?: { intelligenceStatus?: string }
      chunkCount?: number
    }
    if (!res.ok) return null

    const status = data.document?.intelligenceStatus
    if (status === 'ready' || status === 'failed' || status === 'archived') {
      return {
        intelligenceStatus: status ?? 'unknown',
        chunkCount: data.chunkCount ?? 0,
      }
    }

    await new Promise((resolve) => setTimeout(resolve, intervalMs))
  }

  return null
}
