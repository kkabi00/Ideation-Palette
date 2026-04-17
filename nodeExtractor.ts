// src/app/lib/nodeExtractor.ts
// Generation Stage: LLM 기반 Explicit / Implicit 노드 추출
// Bridge 노드는 bridgePipeline.ts 에서 별도 처리

import { chatCompletion, extractJSON, type ChatMessage } from './openaiService'

// ─────────────────────────────────────────
// 타입 정의
// ─────────────────────────────────────────

export type NodeType = 'explicit' | 'implicit' | 'bridge'

export type NodeCategory =
  | '주제' | '감정' | '가치' | '목표'
  | '제약' | '선호' | '이미지' | '장면' | '은유'

export interface PaintNode {
  id: string
  label: string          // 5자 이내
  type: NodeType
  category: NodeCategory
  description: string
  sourceMessageIds?: string[]
  confidence?: number    // 0~1
  embedding?: number[]   // bridgePipeline에서 채워짐
  createdAt: Date
}

export interface PaintEdge {
  source: string
  target: string
  relation:
    | 'associates_with' | 'contrasts_with' | 'evokes'
    | 'relates_to' | 'echoes' | 'inspires'
    | 'avoids' | 'wants_tone' | 'is_unfinished'
  isBridge?: boolean
}

export interface ExtractedNodes {
  nodes: PaintNode[]
  edges: PaintEdge[]
}

// LLM 응답에서 파싱하는 raw 타입
interface RawNode {
  id: string
  label: string
  type: NodeType
  category: NodeCategory
  description: string
  confidence?: number
}

interface RawEdge {
  source: string
  target: string
  relation: string
}

interface RawExtractResult {
  nodes: RawNode[]
  edges?: RawEdge[]
}

// ─────────────────────────────────────────
// 시스템 프롬프트
// ─────────────────────────────────────────

function buildSystemPrompt(existingNodes: PaintNode[]): string {
  const existingList =
    existingNodes.length > 0
      ? `\n\n기존 노드 (중복 생성 금지):\n${existingNodes
          .filter(n => n.type !== 'bridge')
          .map(n => `- ${n.id}: "${n.label}" (${n.type}, ${n.category})`)
          .join('\n')}`
      : ''

  return `당신은 Idea Palette의 Generation Stage 에이전트입니다.
사용자의 창의적 아이디어와 영감을 탐색하는 대화를 하면서 preinventive structures를 추출합니다.

[대화 규칙]
1. 따뜻하고 호기심 어린 한국어로 짧은 응답(1~2문장)을 합니다.
2. 사용자의 말에서 흥미로운 단편을 살짝 반영하고 열린 질문 하나를 던지세요.
3. 해석을 확정하거나 의미를 고정하지 마세요. 여러 해석 가능성을 열어두세요.
4. "그래서 결국 어떤 작품을 만들고 싶은 건가요?" 같이 너무 빨리 수렴하는 질문은 금지.

[노드 추출 규칙]
- type "explicit": 사용자가 직접 언급한 구체적 키워드/개념/장면
- type "implicit": 여러 발화에서 반복되지만 명시되지 않은 잠재 상위 개념
  예) "밤 바다", "혼자 마시는 커피", "오래된 책방" → implicit "고독"
- Bridge 노드는 여기서 생성하지 않습니다 (임베딩 파이프라인이 별도 처리).
- label: 반드시 5자 이내 한국어
- category: 주제/감정/가치/목표/제약/선호/이미지/장면/은유 중 하나
- 이번 대화 턴에서 새로 발견된 노드만 포함 (기존 노드 제외)
- explicit 1~3개, implicit 0~1개${existingList}

[응답 형식 — 반드시 준수]
한국어 응답 텍스트 (1~2문장)

\`\`\`json
{
  "nodes": [
    {
      "id": "n_고유번호",
      "label": "레이블",
      "type": "explicit",
      "category": "주제",
      "description": "한 줄 설명",
      "confidence": 0.9
    }
  ],
  "edges": [
    { "source": "n_id1", "target": "n_id2", "relation": "relates_to" }
  ]
}
\`\`\``
}

// ─────────────────────────────────────────
// 메인: 노드 추출
// ─────────────────────────────────────────

export interface ExtractResult {
  reply: string           // 사용자에게 보여줄 AI 응답
  newNodes: PaintNode[]
  newEdges: PaintEdge[]
}

export async function extractNodes(
  conversationHistory: ChatMessage[],
  existingNodes: PaintNode[]
): Promise<ExtractResult> {
  const system = buildSystemPrompt(existingNodes)

  const fullResponse = await chatCompletion(
    [{ role: 'system', content: system }, ...conversationHistory],
    { model: 'gpt-4o-mini', maxTokens: 1200, temperature: 0.7 }
  )

  // JSON 블록 제거 후 순수 텍스트만 추출
  const reply = fullResponse.replace(/```json[\s\S]*?```/g, '').trim()

  // 노드 파싱
  const parsed = extractJSON<RawExtractResult>(fullResponse)

  if (!parsed?.nodes) {
    return { reply, newNodes: [], newEdges: [] }
  }

  // 기존 노드와 중복 제거 (id 또는 label 기준)
  const existingLabels = new Set(existingNodes.map(n => n.label))
  const existingIds    = new Set(existingNodes.map(n => n.id))

  const newNodes: PaintNode[] = parsed.nodes
    .filter(n => !existingIds.has(n.id) && !existingLabels.has(n.label))
    .map(n => ({
      id:          n.id,
      label:       n.label.slice(0, 6),   // 혹시 6자 넘으면 자름
      type:        n.type,
      category:    n.category,
      description: n.description,
      confidence:  n.confidence ?? 0.8,
      createdAt:   new Date(),
    }))

  const allNodeIds = new Set([
    ...existingNodes.map(n => n.id),
    ...newNodes.map(n => n.id),
  ])

  const newEdges: PaintEdge[] = (parsed.edges ?? [])
    .filter(e => allNodeIds.has(e.source) && allNodeIds.has(e.target))
    .map(e => ({
      source:   e.source,
      target:   e.target,
      relation: e.relation as PaintEdge['relation'],
    }))

  return { reply, newNodes, newEdges }
}
