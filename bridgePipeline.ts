// src/app/lib/bridgePipeline.ts
// 임베딩 유사도 기반 Bridge 노드 자동 생성 파이프라인
//
// 흐름:
//   1. Explicit/Implicit 노드 텍스트 → text-embedding-3-small
//   2. 코사인 유사도 행렬 계산
//   3. 유사도 BRIDGE_THRESHOLD 이하인 쌍 = 원격 연상 후보
//   4. 거리 먼 쌍 최대 MAX_BRIDGES개 → gpt-4o-mini로 매개 개념 생성
//   5. Bridge 노드 + 엣지 반환

import {
  getEmbedding,
  cosineSimilarity,
  chatCompletion,
  extractJSON,
  type EmbeddingVector,
} from './openaiService'
import type { PaintNode, PaintEdge } from './nodeExtractor'

// ─────────────────────────────────────────
// 설정값
// ─────────────────────────────────────────

/** 이 값 이하의 코사인 유사도 쌍을 원격 연상 후보로 간주 */
const BRIDGE_THRESHOLD = 0.35

/** 한 번 파이프라인 실행 시 생성할 Bridge 노드 최대 수 */
const MAX_BRIDGES = 2

/** 파이프라인을 트리거하는 최소 노드 수 (Explicit + Implicit) */
export const BRIDGE_TRIGGER_COUNT = 4

// ─────────────────────────────────────────
// 내부 타입
// ─────────────────────────────────────────

interface NodeWithEmbedding extends PaintNode {
  embedding: EmbeddingVector
}

interface DistantPair {
  a: NodeWithEmbedding
  b: NodeWithEmbedding
  similarity: number
}

interface RawBridgeResult {
  label: string
  description: string
  category?: string
}

// ─────────────────────────────────────────
// Step 1: 임베딩 수집 (이미 있으면 재사용)
// ─────────────────────────────────────────

async function ensureEmbeddings(
  nodes: PaintNode[]
): Promise<NodeWithEmbedding[]> {
  const results: NodeWithEmbedding[] = []

  for (const node of nodes) {
    if (node.embedding && node.embedding.length > 0) {
      results.push(node as NodeWithEmbedding)
      continue
    }
    // label + description을 합쳐서 임베딩
    const text = `${node.label}: ${node.description ?? ''}`
    const embedding = await getEmbedding(text)
    node.embedding = embedding   // 원본 노드에 캐싱
    results.push(node as NodeWithEmbedding)
  }

  return results
}

// ─────────────────────────────────────────
// Step 2: 원격 연상 후보 쌍 탐지
// ─────────────────────────────────────────

function findDistantPairs(
  nodes: NodeWithEmbedding[],
  existingBridgeNodes: PaintNode[]
): DistantPair[] {
  // 이미 bridge로 연결된 쌍 집합
  const bridgedPairs = new Set<string>(
    existingBridgeNodes
      .filter(n => n.type === 'bridge' && n.bridgePair)
      .map(n => {
        const [a, b] = (n as any).bridgePair as [string, string]
        return [a, b].sort().join('__')
      })
  )

  const pairs: DistantPair[] = []

  for (let i = 0; i < nodes.length; i++) {
    for (let j = i + 1; j < nodes.length; j++) {
      const a = nodes[i]
      const b = nodes[j]
      const pairKey = [a.id, b.id].sort().join('__')

      // 이미 bridge 된 쌍은 스킵
      if (bridgedPairs.has(pairKey)) continue

      const sim = cosineSimilarity(a.embedding, b.embedding)
      if (sim < BRIDGE_THRESHOLD) {
        pairs.push({ a, b, similarity: sim })
      }
    }
  }

  // 유사도 오름차순 (더 먼 쌍이 앞으로)
  return pairs.sort((x, y) => x.similarity - y.similarity)
}

// ─────────────────────────────────────────
// Step 3: LLM으로 매개 개념 생성
// ─────────────────────────────────────────

async function generateBridgeConcept(
  nodeA: PaintNode,
  nodeB: PaintNode
): Promise<RawBridgeResult | null> {
  const prompt = `다음 두 개념은 창의적 아이디어 프로젝트에서 나온 서로 다른 재료들입니다.

개념 A: "${nodeA.label}" — ${nodeA.description ?? nodeA.category}
개념 B: "${nodeB.label}" — ${nodeB.description ?? nodeB.category}

이 두 개념 사이를 창의적으로 연결할 수 있는 매개 개념 하나를 찾아주세요.
단순히 두 개념을 합친 것이 아니라, 원격 연상(remote association)을 통해
예상치 못한 연결을 만들어주세요.

규칙:
- label: 5자 이내 한국어
- description: 왜 이 두 개념을 연결하는지 한 문장 (한국어)
- 아래 JSON만 출력 (설명 없이)

\`\`\`json
{
  "label": "매개개념",
  "description": "연결 이유 한 문장",
  "category": "은유"
}
\`\`\``

  const raw = await chatCompletion(
    [{ role: 'user', content: prompt }],
    { model: 'gpt-4o-mini', maxTokens: 300, temperature: 0.9 }
  )

  return extractJSON<RawBridgeResult>(raw)
}

// ─────────────────────────────────────────
// 메인: Bridge 파이프라인 실행
// ─────────────────────────────────────────

export interface BridgeResult {
  newBridgeNodes: PaintNode[]
  newBridgeEdges: PaintEdge[]
}

export interface BridgePipelineOptions {
  onProgress?: (msg: string) => void
}

export async function runBridgePipeline(
  allNodes: PaintNode[],
  options: BridgePipelineOptions = {}
): Promise<BridgeResult> {
  const { onProgress } = options
  const notify = (msg: string) => onProgress?.(msg)

  const eligibleNodes = allNodes.filter(n => n.type !== 'bridge')
  const existingBridges = allNodes.filter(n => n.type === 'bridge')

  if (eligibleNodes.length < BRIDGE_TRIGGER_COUNT) {
    return { newBridgeNodes: [], newBridgeEdges: [] }
  }

  // Step 1: 임베딩
  notify('임베딩 계산 중...')
  const nodesWithEmb = await ensureEmbeddings(eligibleNodes)

  // Step 2: 원격 연상 후보 탐지
  const distantPairs = findDistantPairs(nodesWithEmb, existingBridges)

  if (!distantPairs.length) {
    notify('원격 연상 후보 없음 (노드 간 유사도가 높음)')
    return { newBridgeNodes: [], newBridgeEdges: [] }
  }

  const topPairs = distantPairs.slice(0, MAX_BRIDGES)
  notify(`Bridge 노드 생성 중 (${topPairs.length}쌍 대상)...`)

  // Step 3: 매개 개념 생성
  const newBridgeNodes: PaintNode[] = []
  const newBridgeEdges: PaintEdge[] = []

  for (const pair of topPairs) {
    const concept = await generateBridgeConcept(pair.a, pair.b)
    if (!concept) continue

    const bridgeId = `bridge_${pair.a.id}_${pair.b.id}`

    const bridgeNode: PaintNode & { bridgePair: [string, string] } = {
      id:          bridgeId,
      label:       concept.label.slice(0, 6),
      type:        'bridge',
      category:    (concept.category as any) ?? '은유',
      description: concept.description,
      confidence:  1 - pair.similarity,   // 거리가 멀수록 confidence 높음
      bridgePair:  [pair.a.id, pair.b.id],
      createdAt:   new Date(),
    }

    newBridgeNodes.push(bridgeNode)
    newBridgeEdges.push(
      { source: pair.a.id, target: bridgeId, relation: 'associates_with', isBridge: true },
      { source: bridgeId,  target: pair.b.id, relation: 'associates_with', isBridge: true }
    )
  }

  notify(`Bridge 노드 ${newBridgeNodes.length}개 생성 완료`)
  return { newBridgeNodes, newBridgeEdges }
}
