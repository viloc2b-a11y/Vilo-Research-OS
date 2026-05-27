export const EMBEDDING_MODEL = 'text-embedding-3-small'
export const EMBEDDING_DIMENSION = 1536

export const MAX_EMBED_CALLS_PER_RUN = 1000
export const EMBEDDING_BATCH_SIZE = 50

export function isEmbeddingAvailable(): boolean {
  return Boolean(process.env.OPENAI_API_KEY?.trim())
}

export async function embedTexts(texts: string[]): Promise<number[][]> {
  const apiKey = process.env.OPENAI_API_KEY?.trim()
  if (!apiKey) {
    throw new Error('OPENAI_API_KEY is not configured')
  }

  const response = await fetch('https://api.openai.com/v1/embeddings', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: EMBEDDING_MODEL,
      input: texts,
    }),
  })

  if (!response.ok) {
    const body = await response.text()
    throw new Error(`Embedding request failed (${response.status}): ${body.slice(0, 200)}`)
  }

  const payload = (await response.json()) as {
    data?: Array<{ embedding?: number[]; index?: number }>
  }

  const rows = payload.data ?? []
  return rows
    .sort((a, b) => (a.index ?? 0) - (b.index ?? 0))
    .map((row) => row.embedding ?? [])
}
