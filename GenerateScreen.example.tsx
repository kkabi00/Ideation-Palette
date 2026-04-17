// src/app/screens/GenerateScreen.tsx
// Generation Stage 화면 — 세 서비스 연동 예시
//
// openaiService  → API 클라이언트 (chat + embedding)
// nodeExtractor  → Explicit/Implicit 노드 추출
// bridgePipeline → 임베딩 유사도 기반 Bridge 노드 생성

import { useState, useRef, useCallback } from 'react'
import { extractNodes, type PaintNode, type PaintEdge, type ChatMessage } from '../lib/nodeExtractor'
import { runBridgePipeline, BRIDGE_TRIGGER_COUNT } from '../lib/bridgePipeline'

// ─────────────────────────────────────────
// 상태 타입
// ─────────────────────────────────────────

interface Message {
  id: string
  role: 'user' | 'assistant'
  content: string
}

// ─────────────────────────────────────────
// 컴포넌트
// ─────────────────────────────────────────

export default function GenerateScreen() {
  const [messages,     setMessages]     = useState<Message[]>([])
  const [nodes,        setNodes]        = useState<PaintNode[]>([])
  const [edges,        setEdges]        = useState<PaintEdge[]>([])
  const [input,        setInput]        = useState('')
  const [loading,      setLoading]      = useState(false)
  const [bridgeStatus, setBridgeStatus] = useState<string>('')
  const historyRef = useRef<ChatMessage[]>([])

  // ── 메시지 전송 ──
  const handleSend = useCallback(async () => {
    if (!input.trim() || loading) return

    const userText = input.trim()
    setInput('')
    setLoading(true)

    // UI에 사용자 메시지 추가
    const userMsg: Message = { id: Date.now().toString(), role: 'user', content: userText }
    setMessages(prev => [...prev, userMsg])

    // 히스토리에 추가
    historyRef.current.push({ role: 'user', content: userText })

    try {
      // ── Step 1: Explicit/Implicit 노드 추출 ──
      const { reply, newNodes, newEdges } = await extractNodes(
        historyRef.current,
        nodes   // 기존 노드 전달 → 중복 방지
      )

      // AI 응답 UI에 추가
      const aiMsg: Message = { id: (Date.now() + 1).toString(), role: 'assistant', content: reply }
      setMessages(prev => [...prev, aiMsg])
      historyRef.current.push({ role: 'assistant', content: reply })

      // 노드/엣지 병합
      const updatedNodes = [...nodes, ...newNodes]
      const updatedEdges = [...edges, ...newEdges]
      setNodes(updatedNodes)
      setEdges(updatedEdges)

      // ── Step 2: Bridge 파이프라인 트리거 ──
      const eligibleCount = updatedNodes.filter(n => n.type !== 'bridge').length
      if (eligibleCount >= BRIDGE_TRIGGER_COUNT) {
        setBridgeStatus('임베딩 계산 중...')

        // 비동기 실행 (채팅 UX 블로킹 방지)
        runBridgePipeline(updatedNodes, {
          onProgress: (msg) => setBridgeStatus(msg),
        }).then(({ newBridgeNodes, newBridgeEdges }) => {
          if (newBridgeNodes.length > 0) {
            setNodes(prev => [...prev, ...newBridgeNodes])
            setEdges(prev => [...prev, ...newBridgeEdges])
          }
          const total = updatedNodes.filter(n => n.type === 'bridge').length + newBridgeNodes.length
          setBridgeStatus(total > 0 ? `Bridge 노드 ${total}개 생성됨` : '원격 연상 후보 없음')
        }).catch(err => {
          setBridgeStatus(`Bridge 오류: ${err.message}`)
        })
      }

    } catch (err: any) {
      const errMsg: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: `오류가 발생했습니다: ${err.message}`,
      }
      setMessages(prev => [...prev, errMsg])
      historyRef.current.pop()   // 실패한 user 메시지 히스토리에서 제거
    } finally {
      setLoading(false)
    }
  }, [input, loading, nodes, edges])

  // ── 노드 타입별 카운트 ──
  const explicitCount = nodes.filter(n => n.type === 'explicit').length
  const implicitCount = nodes.filter(n => n.type === 'implicit').length
  const bridgeCount   = nodes.filter(n => n.type === 'bridge').length

  // ─────────────────────────────────────────
  // 렌더
  // ─────────────────────────────────────────

  return (
    <div style={{ display: 'flex', height: '100vh' }}>

      {/* 채팅 영역 */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', borderRight: '1px solid #eee' }}>
        <div style={{ flex: 1, overflowY: 'auto', padding: 16 }}>
          {messages.map(msg => (
            <div
              key={msg.id}
              style={{
                marginBottom: 12,
                textAlign: msg.role === 'user' ? 'right' : 'left',
              }}
            >
              <span
                style={{
                  display: 'inline-block',
                  padding: '8px 14px',
                  borderRadius: 12,
                  background: msg.role === 'user' ? '#3B82F6' : '#F3F4F6',
                  color: msg.role === 'user' ? '#fff' : '#111',
                  fontSize: 14,
                  maxWidth: '80%',
                }}
              >
                {msg.content}
              </span>
            </div>
          ))}
          {loading && (
            <div style={{ color: '#999', fontSize: 13 }}>생각 중...</div>
          )}
        </div>

        {/* 입력창 */}
        <div style={{ padding: 12, borderTop: '1px solid #eee', display: 'flex', gap: 8 }}>
          <textarea
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend() } }}
            placeholder="단편, 장면, 분위기를 공유하세요..."
            rows={2}
            style={{ flex: 1, padding: '8px 12px', borderRadius: 8, border: '1px solid #ddd', fontSize: 14, resize: 'none' }}
          />
          <button
            onClick={handleSend}
            disabled={loading || !input.trim()}
            style={{ padding: '0 16px', borderRadius: 8, border: 'none', background: '#111', color: '#fff', cursor: 'pointer' }}
          >
            전송
          </button>
        </div>
      </div>

      {/* 우측 패널: 노드 현황 */}
      <div style={{ width: 280, padding: 16, background: '#FAFAFA' }}>
        <div style={{ marginBottom: 12 }}>
          <span style={{ fontSize: 13, fontWeight: 500 }}>대화 단편</span>
          <span style={{ float: 'right', fontSize: 12, color: '#888' }}>
            {nodes.length}개 노드
          </span>
        </div>

        {/* 타입별 카운트 */}
        <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
          {[
            { label: 'Explicit', count: explicitCount, color: '#5DCAA5' },
            { label: 'Implicit', count: implicitCount, color: '#7F77DD' },
            { label: 'Bridge',   count: bridgeCount,   color: '#EF9F27' },
          ].map(({ label, count, color }) => (
            <div key={label} style={{ flex: 1, textAlign: 'center', padding: '6px 4px', borderRadius: 8, background: '#fff', border: '1px solid #eee' }}>
              <div style={{ fontSize: 16, fontWeight: 600, color }}>{count}</div>
              <div style={{ fontSize: 11, color: '#888' }}>{label}</div>
            </div>
          ))}
        </div>

        {/* Bridge 상태 */}
        {bridgeStatus && (
          <div style={{ fontSize: 12, color: '#888', marginBottom: 12, padding: '6px 10px', background: '#FFF9ED', borderRadius: 6 }}>
            {bridgeStatus}
          </div>
        )}

        {/* 노드 목록 */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {nodes.map(node => (
            <div
              key={node.id}
              style={{
                padding: '8px 10px',
                borderRadius: 8,
                background: '#fff',
                border: `1px solid ${
                  node.type === 'explicit' ? '#5DCAA5' :
                  node.type === 'implicit' ? '#7F77DD' : '#EF9F27'
                }22`,
                fontSize: 13,
              }}
            >
              <div style={{ fontWeight: 500 }}>{node.label}</div>
              <div style={{ fontSize: 11, color: '#888', marginTop: 2 }}>{node.category} · {node.type}</div>
              {node.description && (
                <div style={{ fontSize: 11, color: '#aaa', marginTop: 2 }}>{node.description}</div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
