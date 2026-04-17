// Generation Stage — 세션 연동, Explicit/Implicit 노드 추출
// Bridge 노드는 PaletteScreen 조합 패널에서 생성됨

import { useState, useRef, useCallback, useEffect } from 'react'
import { useNavigate, useParams } from 'react-router'
import { ArrowRight } from 'lucide-react'
import { extractNodes, type PaintNode, type PaintEdge, type ChatMessage } from '../lib/nodeExtractor'
import {
  getSession, saveSession, deriveTitleFromMessage,
  type CanvasSession,
} from '../lib/sessionStore'
import type { Paint } from '../components/PaintCard'

const MIN_NODES_FOR_PALETTE = 4

// PaintNode → Paint 변환 (팔레트 초기 배치용)
function paintNodeToPaint(node: PaintNode, index: number): Paint {
  const clusterMap: Record<string, string> = {
    '이미지': 'visual-tone', '장면': 'visual-tone',
    '감정': 'sound-music',
    '주제': 'storyline', '가치': 'storyline', '목표': 'storyline',
    '제약': 'storyline', '선호': 'storyline', '은유': 'storyline',
  }
  return {
    id: node.id,
    title: node.label,
    type: 'text',
    content: node.description,
    source: 'ai' as const,
    tags: [node.category],
    timestamp: node.createdAt.toISOString(),
    cluster: clusterMap[node.category] ?? 'storyline',
    paintKind: node.type as 'explicit' | 'implicit' | 'bridge',
    x: 120 + (index % 4) * 280,
    y: 100 + Math.floor(index / 4) * 200,
  }
}

interface Message {
  id: string
  role: 'user' | 'assistant'
  content: string
}

export default function GenerateScreen() {
  const navigate    = useNavigate()
  const { id }      = useParams<{ id: string }>()
  const [messages,  setMessages]  = useState<Message[]>([])
  const [nodes,     setNodes]     = useState<PaintNode[]>([])
  const [edges,     setEdges]     = useState<PaintEdge[]>([])
  const [input,     setInput]     = useState('')
  const [loading,   setLoading]   = useState(false)
  const historyRef  = useRef<ChatMessage[]>([])
  const initialised = useRef(false)

  // 세션 복원 + 시작 메시지 자동 전송
  useEffect(() => {
    if (!id || initialised.current) return
    initialised.current = true

    const session = getSession(id)
    if (!session) return

    // 기존 대화 복원
    if (session.messages.length > 0) {
      setMessages(session.messages.map((m, i) => ({ id: `restored-${i}`, role: m.role, content: m.content })))
      historyRef.current = session.messages.map(m => ({ role: m.role as any, content: m.content }))
    }

    // 기존 노드 복원
    if (session.nodes.length > 0) {
      setNodes(session.nodes.map(n => ({ ...n, createdAt: new Date(n.createdAt) })))
      setEdges(session.edges as PaintEdge[])
    }

    // 조합 세션: 부모 캔버스 노드 프리로드
    if (session.status === 'combining' && session.combineSourceIds && session.paints.length > 0) {
      setNodes(session.paints.map(p => ({
        id: p.id, label: p.title, type: (p.paintKind ?? 'explicit') as any,
        category: (p.tags?.[0] ?? '주제') as any,
        description: p.content, createdAt: new Date(p.timestamp),
      })))
    }

    // 홈에서 넘어온 시작 메시지
    if (session.pendingStartMessage) {
      const msg = session.pendingStartMessage
      saveSession({ ...session, pendingStartMessage: undefined })
      setTimeout(() => sendMessage(msg), 150)
    }
  }, [id])

  // 세션에 현재 상태 저장
  const persistSession = useCallback((
    updatedNodes: PaintNode[],
    updatedEdges: PaintEdge[],
    updatedMessages: Array<{ role: 'user' | 'assistant'; content: string }>
  ) => {
    if (!id) return
    const session = getSession(id)
    if (!session) return
    saveSession({
      ...session,
      updatedAt: new Date().toISOString(),
      title: session.title === '새 캔버스' && updatedMessages[0]
        ? deriveTitleFromMessage(updatedMessages[0].content)
        : session.title,
      messages: updatedMessages,
      nodes: updatedNodes.map(n => ({ ...n, createdAt: n.createdAt.toISOString() })),
      edges: updatedEdges,
    })
  }, [id])

  const sendMessage = useCallback(async (text: string) => {
    if (!text.trim() || loading) return
    setLoading(true)

    const userMsgUI: Message = { id: Date.now().toString(), role: 'user', content: text }
    setMessages(prev => [...prev, userMsgUI])
    historyRef.current.push({ role: 'user', content: text })

    try {
      const { reply, newNodes, newEdges } = await extractNodes(historyRef.current, nodes)

      const aiMsgUI: Message = { id: (Date.now() + 1).toString(), role: 'assistant', content: reply }
      setMessages(prev => {
        const next = [...prev, aiMsgUI]
        historyRef.current.push({ role: 'assistant', content: reply })

        const updatedNodes = [...nodes, ...newNodes]
        const updatedEdges = [...edges, ...newEdges]
        setNodes(updatedNodes)
        setEdges(updatedEdges)

        persistSession(
          updatedNodes,
          updatedEdges,
          historyRef.current.map(m => ({ role: m.role as 'user' | 'assistant', content: m.content }))
        )
        return next
      })
    } catch (err: any) {
      setMessages(prev => [...prev, { id: (Date.now() + 1).toString(), role: 'assistant', content: `오류: ${err.message}` }])
      historyRef.current.pop()
    } finally {
      setLoading(false)
    }
  }, [loading, nodes, edges, persistSession])

  const handleSend = useCallback(async () => {
    if (!input.trim() || loading) return
    const text = input.trim()
    setInput('')
    await sendMessage(text)
  }, [input, loading, sendMessage])

  const handleGoToPalette = () => {
    if (!id) return
    const session = getSession(id)
    if (!session) return
    const paints = nodes.map(paintNodeToPaint)
    saveSession({ ...session, status: 'ready', paints, updatedAt: new Date().toISOString() })
    navigate(`/session/${id}/palette`)
  }

  const explicitCount  = nodes.filter(n => n.type === 'explicit').length
  const implicitCount  = nodes.filter(n => n.type === 'implicit').length
  const nonBridgeCount = explicitCount + implicitCount
  const isPaletteReady = nonBridgeCount >= MIN_NODES_FOR_PALETTE
  const progress       = Math.min((nonBridgeCount / MIN_NODES_FOR_PALETTE) * 100, 100)

  // 조합 세션 여부
  const session       = id ? getSession(id) : null
  const isCombining   = session?.status === 'combining'

  return (
    <div style={{ display: 'flex', height: '100vh' }}>

      {/* 채팅 영역 */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', borderRight: '1px solid #eee' }}>

        {/* 헤더 */}
        <div style={{ padding: '12px 16px', borderBottom: '1px solid #eee' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
            <span style={{ fontSize: 13, fontWeight: 500, color: isCombining ? '#EF9F27' : '#111' }}>
              {isCombining ? '⬡ 조합 대화' : '● 재료 수집'}
            </span>
            <span style={{ fontSize: 12, color: '#aaa' }}>{nonBridgeCount} / {MIN_NODES_FOR_PALETTE}</span>
          </div>
          <div style={{ height: 4, background: '#f0f0f0', borderRadius: 4 }}>
            <div style={{ height: '100%', width: `${progress}%`, background: isCombining ? '#EF9F27' : '#3B82F6', borderRadius: 4, transition: 'width 0.3s' }} />
          </div>
        </div>

        {/* 메시지 */}
        <div style={{ flex: 1, overflowY: 'auto', padding: 16 }}>
          {messages.length === 0 && (
            <div style={{ color: '#bbb', fontSize: 13, textAlign: 'center', marginTop: 60 }}>
              {isCombining ? '두 캔버스의 재료를 어떻게 조합할지 이야기해보세요.' : '장면, 감각, 떠오르는 단편을 자유롭게 공유하세요.'}
            </div>
          )}
          {messages.map(msg => (
            <div key={msg.id} style={{ marginBottom: 12, textAlign: msg.role === 'user' ? 'right' : 'left' }}>
              <span style={{
                display: 'inline-block', padding: '8px 14px', borderRadius: 12,
                background: msg.role === 'user' ? (isCombining ? '#EF9F27' : '#3B82F6') : '#F3F4F6',
                color: msg.role === 'user' ? '#fff' : '#111',
                fontSize: 14, maxWidth: '80%',
              }}>
                {msg.content}
              </span>
            </div>
          ))}
          {loading && <div style={{ color: '#999', fontSize: 13 }}>생각 중…</div>}
        </div>

        {/* 입력 */}
        <div style={{ padding: 12, borderTop: '1px solid #eee' }}>
          <div style={{ display: 'flex', gap: 8, marginBottom: isPaletteReady ? 10 : 0 }}>
            <textarea
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend() } }}
              placeholder={isCombining ? '조합 아이디어를 공유하세요…' : '단편, 장면, 분위기를 공유하세요…'}
              rows={2}
              style={{ flex: 1, padding: '8px 12px', borderRadius: 8, border: '1px solid #ddd', fontSize: 14, resize: 'none' }}
            />
            <button
              onClick={handleSend}
              disabled={loading || !input.trim()}
              style={{ padding: '0 16px', borderRadius: 8, border: 'none', background: isCombining ? '#EF9F27' : '#111', color: '#fff', cursor: 'pointer', opacity: loading || !input.trim() ? 0.4 : 1 }}
            >
              전송
            </button>
          </div>

          {isPaletteReady && (
            <button
              onClick={handleGoToPalette}
              style={{
                width: '100%', padding: 10, borderRadius: 8, border: 'none',
                background: isCombining ? '#EF9F27' : '#3B82F6',
                color: '#fff', fontSize: 14, cursor: 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
              }}
            >
              {isCombining ? '조합 캔버스 열기' : '팔레트로 이동'}
              <ArrowRight size={16} />
            </button>
          )}
        </div>
      </div>

      {/* 우측 패널 */}
      <div style={{ width: 280, padding: 16, background: '#FAFAFA', overflowY: 'auto' }}>
        <div style={{ marginBottom: 12, display: 'flex', justifyContent: 'space-between' }}>
          <span style={{ fontSize: 13, fontWeight: 500 }}>추출된 재료</span>
          <span style={{ fontSize: 12, color: '#888' }}>{nodes.length}개</span>
        </div>

        <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
          {[
            { label: '명시', count: explicitCount, color: '#5DCAA5' },
            { label: '묵시', count: implicitCount, color: '#7F77DD' },
          ].map(({ label, count, color }) => (
            <div key={label} style={{ flex: 1, textAlign: 'center', padding: '6px 4px', borderRadius: 8, background: '#fff', border: '1px solid #eee' }}>
              <div style={{ fontSize: 18, fontWeight: 600, color }}>{count}</div>
              <div style={{ fontSize: 11, color: '#888' }}>{label}</div>
            </div>
          ))}
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {nodes.map(node => (
            <div key={node.id} style={{
              padding: '8px 10px', borderRadius: 8, background: '#fff',
              border: `1px solid ${node.type === 'explicit' ? '#5DCAA5' : '#7F77DD'}44`,
              fontSize: 13,
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontWeight: 500 }}>{node.label}</span>
                <span style={{
                  fontSize: 10, padding: '2px 6px', borderRadius: 10,
                  background: node.type === 'explicit' ? '#5DCAA522' : '#7F77DD22',
                  color: node.type === 'explicit' ? '#5DCAA5' : '#7F77DD',
                }}>
                  {node.type === 'explicit' ? '명시' : '묵시'}
                </span>
              </div>
              <div style={{ fontSize: 11, color: '#888', marginTop: 2 }}>{node.category}</div>
              {node.description && <div style={{ fontSize: 11, color: '#aaa', marginTop: 2 }}>{node.description}</div>}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
