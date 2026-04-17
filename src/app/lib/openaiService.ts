import OpenAI from "openai";
import { Paint, PaintType } from "../components/PaintCard";

function getClient() {
  const apiKey =
    localStorage.getItem("ideation-api-key") ??
    (import.meta as any).env?.VITE_OPENAI_API_KEY ??
    "";
  return new OpenAI({ apiKey, dangerouslyAllowBrowser: true });
}

const SYSTEM_PROMPT = `당신은 Geneplore 모델 기반의 창의적 아이디어 탐색 도우미 "팔레트 에이전트"입니다.

사용자가 미완성 아이디어 조각(장면, 분위기, 소리, 이미지, 무작위 생각 등)을 공유하면, 당신은:
1. 대화형 응답으로 사용자의 창의적 사고를 자극합니다
2. 발화에서 "페인트(preinventive structure)"를 추출합니다

## 페인트 종류
- **explicit**: 사용자가 직접 말한 구체적인 요소 (명시적)
- **implicit**: 발화 이면에 숨어있는 맥락, 감정, 의도 (암묵적)
- **bridge**: 멀리 떨어진 두 개념을 잇는 매개 요소 (원격 연상용)

## 클러스터 분류
- **visual-tone**: 시각적 톤, 색상, 조명, 분위기
- **storyline**: 스토리, 서사, 장면, 플롯
- **sound-music**: 사운드, 음악, 오디오 텍스처
- **character**: 캐릭터, 인물, 페르소나

## 질문 전략
- **Divergent(발산형)**: 새로운 방향 탐색, 예상치 못한 연결 제안 (초기 단계 or 아이디어 부족 시)
- **Constructive(구성형)**: 기존 아이디어를 발전시키는 구체적 질문 (충분한 재료가 모였을 때)

## 응답 형식 (반드시 JSON으로만 응답)
{
  "message": "사용자에게 보낼 대화 응답 (1-3문장, 한국어)",
  "paints": [
    {
      "title": "핵심 키워드 (2-4단어, 한국어)",
      "content": "구체적 설명 (1-2문장, 한국어)",
      "type": "text",
      "paintKind": "explicit" | "implicit" | "bridge",
      "cluster": "visual-tone" | "storyline" | "sound-music" | "character",
      "tags": ["태그1", "태그2"]
    }
  ]
}

각 사용자 메시지에서 2-4개의 페인트를 추출하세요. 명시적 1개, 암묵적 1개는 항상 포함하고, 연상 거리가 먼 bridge는 적절한 경우에만 추가하세요.`;

export interface AIResponse {
  message: string;
  paints: {
    title: string;
    content: string;
    type: PaintType;
    paintKind: "explicit" | "implicit" | "bridge";
    cluster: string;
    tags: string[];
  }[];
}

export interface ConversationMessage {
  role: "user" | "assistant";
  content: string;
}

export async function sendToOpenAI(
  conversationHistory: ConversationMessage[]
): Promise<AIResponse> {
  const response = await getClient().chat.completions.create({
    model: "gpt-4o",
    messages: [
      { role: "system", content: SYSTEM_PROMPT },
      ...conversationHistory,
    ],
    response_format: { type: "json_object" },
    temperature: 0.8,
  });

  const raw = response.choices[0].message.content ?? "{}";
  const parsed = JSON.parse(raw) as AIResponse;

  if (!parsed.message || !Array.isArray(parsed.paints)) {
    throw new Error("Invalid response format from OpenAI");
  }

  return parsed;
}

export function toOpenAIPaint(
  aiPaint: AIResponse["paints"][number],
  idPrefix: string
): Paint {
  return {
    id: `${idPrefix}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    title: aiPaint.title,
    type: aiPaint.type,
    content: aiPaint.content,
    source: "ai",
    tags: aiPaint.tags ?? [],
    timestamp: "Just now",
    cluster: aiPaint.cluster,
    paintKind: aiPaint.paintKind,
  };
}

/** AI 텍스트에서 페인트 label/description 추출 */
export async function extractPaintMeta(
  text: string
): Promise<{ label: string; description: string }> {
  const response = await getClient().chat.completions.create({
    model: "gpt-4o-mini",
    messages: [
      {
        role: "system",
        content:
          "아래 텍스트에서 창의적 아이디어 페인트의 핵심을 추출하세요.\n반드시 JSON으로만 응답: {\"label\": \"2-4단어 핵심 키워드(한국어)\", \"description\": \"1-2문장 설명(한국어)\"}",
      },
      { role: "user", content: text },
    ],
    response_format: { type: "json_object" },
    temperature: 0.5,
  });
  const raw = response.choices[0].message.content ?? "{}";
  const parsed = JSON.parse(raw) as { label?: string; description?: string };
  return {
    label: parsed.label ?? text.slice(0, 20),
    description: parsed.description ?? text,
  };
}

/** DALL-E 3으로 이미지 URL 생성 */
export async function generateImage(prompt: string): Promise<string> {
  const response = await getClient().images.generate({
    model: "dall-e-3",
    prompt,
    n: 1,
    size: "1024x1024",
    quality: "standard",
  });
  const url = response.data?.[0]?.url;
  if (!url) throw new Error("DALL-E 이미지 URL 없음");
  return url;
}

// ─── nodeExtractor / bridgePipeline 공유 헬퍼 ───

export type ChatMessage = { role: 'system' | 'user' | 'assistant'; content: string }
export type EmbeddingVector = number[]

export async function chatCompletion(
  messages: ChatMessage[],
  options: { model?: string; maxTokens?: number; temperature?: number } = {}
): Promise<string> {
  const response = await getClient().chat.completions.create({
    model: options.model ?? 'gpt-4o-mini',
    messages,
    max_tokens: options.maxTokens ?? 1000,
    temperature: options.temperature ?? 0.7,
  })
  return response.choices[0].message.content ?? ''
}

export function extractJSON<T>(text: string): T | null {
  const match = text.match(/```json\s*([\s\S]*?)```/)
  const jsonStr = match ? match[1] : text
  try {
    return JSON.parse(jsonStr.trim()) as T
  } catch {
    return null
  }
}

export async function getEmbedding(text: string): Promise<EmbeddingVector> {
  const response = await getClient().embeddings.create({
    model: 'text-embedding-3-small',
    input: text,
  })
  return response.data[0].embedding
}

export function cosineSimilarity(a: EmbeddingVector, b: EmbeddingVector): number {
  let dot = 0, normA = 0, normB = 0
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i]
    normA += a[i] * a[i]
    normB += b[i] * b[i]
  }
  return dot / (Math.sqrt(normA) * Math.sqrt(normB))
}
