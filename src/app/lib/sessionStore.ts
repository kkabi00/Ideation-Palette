import type { Paint } from '../components/PaintCard'

export interface StoredNode {
  id: string
  label: string
  type: 'explicit' | 'implicit' | 'bridge'
  category: string
  description: string
  confidence?: number
  createdAt: string
}

export interface StoredEdge {
  source: string
  target: string
  relation: string
  isBridge?: boolean
}

export interface CanvasSession {
  id: string
  title: string               // 첫 메시지에서 자동 생성
  createdAt: string
  updatedAt: string
  status: 'generating' | 'ready' | 'combining'
  combineSourceIds?: [string, string]   // 조합 캔버스의 경우 원본 세션 ID
  pendingStartMessage?: string          // HomeScreen → Generate 전달용
  messages: Array<{ role: 'user' | 'assistant'; content: string }>
  nodes: StoredNode[]
  edges: StoredEdge[]
  paints: Paint[]             // 팔레트 단계의 배치된 노드들
}

const KEY = 'ideation-sessions'

export function getAllSessions(): CanvasSession[] {
  try {
    const raw = localStorage.getItem(KEY)
    return raw ? (JSON.parse(raw) as CanvasSession[]) : []
  } catch { return [] }
}

export function getSession(id: string): CanvasSession | null {
  return getAllSessions().find(s => s.id === id) ?? null
}

export function saveSession(session: CanvasSession): void {
  const rest = getAllSessions().filter(s => s.id !== session.id)
  localStorage.setItem(KEY, JSON.stringify([session, ...rest]))
}

export function createSession(opts?: {
  combineSourceIds?: [string, string]
  pendingStartMessage?: string
}): CanvasSession {
  const session: CanvasSession = {
    id: `canvas_${Date.now()}`,
    title: '새 캔버스',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    status: opts?.combineSourceIds ? 'combining' : 'generating',
    combineSourceIds: opts?.combineSourceIds,
    pendingStartMessage: opts?.pendingStartMessage,
    messages: [],
    nodes: [],
    edges: [],
    paints: [],
  }
  saveSession(session)
  return session
}

export function deleteSession(id: string): void {
  const rest = getAllSessions().filter(s => s.id !== id)
  localStorage.setItem(KEY, JSON.stringify(rest))
}

/** 세션 타이틀을 첫 사용자 메시지에서 자동 생성 */
export function deriveTitleFromMessage(msg: string): string {
  return msg.length > 24 ? msg.slice(0, 24) + '…' : msg
}
