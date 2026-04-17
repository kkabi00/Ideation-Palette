// src/app/lib/openaiService.ts
// OpenAI API 통합 서비스 (Chat + Embedding)
// 환경변수: VITE_OPENAI_API_KEY

const BASE_URL = 'https://api.openai.com/v1'

function getApiKey(): string {
  const key = import.meta.env.VITE_OPENAI_API_KEY
  if (!key) throw new Error('VITE_OPENAI_API_KEY가 .env에 설정되지 않았습니다.')
  return key
}

// ─────────────────────────────────────────
// Chat Completion (gpt-4o-mini)
// ─────────────────────────────────────────

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant'
  content: string
}

export interface ChatOptions {
  model?: string
  maxTokens?: number
  temperature?: number
}

export async function chatCompletion(
  messages: ChatMessage[],
  options: ChatOptions = {}
): Promise<string> {
  const {
    model = 'gpt-4o-mini',
    maxTokens = 1200,
    temperature = 0.7,
  } = options

  const res = await fetch(`${BASE_URL}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${getApiKey()}`,
    },
    body: JSON.stringify({
      model,
      max_tokens: maxTokens,
      temperature,
      messages,
    }),
  })

  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(
      `OpenAI Chat ${res.status}: ${(err as any).error?.message ?? res.statusText}`
    )
  }

  const data = await res.json()
  return data.choices[0].message.content as string
}

// ─────────────────────────────────────────
// Embedding (text-embedding-3-small)
// ─────────────────────────────────────────

export type EmbeddingVector = number[]

export async function getEmbedding(text: string): Promise<EmbeddingVector> {
  const res = await fetch(`${BASE_URL}/embeddings`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${getApiKey()}`,
    },
    body: JSON.stringify({
      model: 'text-embedding-3-small',
      input: text,
    }),
  })

  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(
      `OpenAI Embedding ${res.status}: ${(err as any).error?.message ?? res.statusText}`
    )
  }

  const data = await res.json()
  return data.data[0].embedding as EmbeddingVector
}

// ─────────────────────────────────────────
// 유틸: 코사인 유사도
// ─────────────────────────────────────────

export function cosineSimilarity(a: EmbeddingVector, b: EmbeddingVector): number {
  let dot = 0, normA = 0, normB = 0
  for (let i = 0; i < a.length; i++) {
    dot   += a[i] * b[i]
    normA += a[i] * a[i]
    normB += b[i] * b[i]
  }
  return dot / (Math.sqrt(normA) * Math.sqrt(normB))
}

// ─────────────────────────────────────────
// 유틸: JSON 블록 파싱 (LLM 응답에서 ```json ... ``` 추출)
// ─────────────────────────────────────────

export function extractJSON<T>(text: string): T | null {
  const match = text.match(/```json\s*([\s\S]*?)```/)
  if (!match) return null
  try {
    return JSON.parse(match[1].trim()) as T
  } catch {
    return null
  }
}
