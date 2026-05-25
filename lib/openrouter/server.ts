import { assertRuntimePayloadSanitized, sanitizeObjectDeep } from '@/lib/sanitization/protocol-sanitizer'

const OPENROUTER_API_URL = 'https://openrouter.ai/api/v1/chat/completions'

export class OpenRouterConfigError extends Error {
  readonly code = 'OPENROUTER_CONFIG_MISSING'

  constructor(message = 'OpenRouter is not configured on the server.') {
    super(message)
    this.name = 'OpenRouterConfigError'
  }
}

export type OpenRouterChatMessage = {
  role: 'system' | 'user' | 'assistant'
  content: string
}

export type OpenRouterChatRequest = {
  model: string
  messages: OpenRouterChatMessage[]
  temperature?: number
  maxTokens?: number
}

export type OpenRouterChatChoice = {
  message?: {
    role?: string
    content?: string
  }
}

export type OpenRouterChatResponse = {
  id?: string
  model?: string
  choices?: OpenRouterChatChoice[]
}

function requireOpenRouterApiKey(): string {
  const apiKey = process.env.OPENROUTER_API_KEY?.trim()
  if (!apiKey) {
    throw new OpenRouterConfigError('Missing server environment variable: OPENROUTER_API_KEY.')
  }

  return apiKey
}

export function isOpenRouterConfigured(): boolean {
  return Boolean(process.env.OPENROUTER_API_KEY?.trim())
}

export async function createOpenRouterChatCompletion(
  request: OpenRouterChatRequest,
): Promise<OpenRouterChatResponse> {
  const apiKey = requireOpenRouterApiKey()
  // AI context: sanitized display policy (lib/protocol-vault/display-policy — never raw commercial IDs).
  const sanitizedRequest = sanitizeObjectDeep(request)
  assertRuntimePayloadSanitized(sanitizedRequest, 'AI chat completion request')

  const response = await fetch(OPENROUTER_API_URL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
      'HTTP-Referer': 'https://os.viloresearchgroup.com',
      'X-Title': 'Vilo OS',
    },
    body: JSON.stringify({
      model: sanitizedRequest.model,
      messages: sanitizedRequest.messages,
      temperature: sanitizedRequest.temperature,
      max_tokens: sanitizedRequest.maxTokens,
    }),
  })

  if (!response.ok) {
    throw new Error(`OpenRouter request failed with status ${response.status}.`)
  }

  return response.json() as Promise<OpenRouterChatResponse>
}
