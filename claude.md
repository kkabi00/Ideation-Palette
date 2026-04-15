# Idea Palette — 프로젝트 컨텍스트

## 서비스 개요
창작자가 아이디어 조각을 "페인트"로 추출·조합하는 아이디에이션 도구.
Geneplore 모델 기반. Start → Generation → Palette → Export 4단계 플로우.

## 핵심 개념
- Explicit Paint: 사용자가 직접 말한 것
- Implicit Paint: 발화 이면의 숨은 맥락 (LLM 추론)
- Bridge Paint: 멀리 떨어진 두 페인트를 잇는 매개 (원격연상용)

## 기술 스택
- DB: PostgreSQL + pgvector (Supabase)
- LLM: Claude API (claude-sonnet-4-6)
- 임베딩: text-embedding-3-small (1536차원)

## 노드 선택 로직 (핵심)
사용자 메시지 입력 시마다:
1. 메시지를 임베딩 변환
2. pgvector로 세션 내 노드와 코사인 유사도 계산
3. 유사도(0.5) + 최신성(0.3) + 중요도(0.2) 가중합으로 top-20 선택
4. 선택된 노드 + 대화 히스토리를 LLM 컨텍스트로 주입

## DB 스키마 핵심
- sessions: session_id, user_id, current_stage, status
- nodes: node_id, session_id, node_type, label, description, embedding(vector 1536), edge_count
- edges: edge_id, source_node_id, target_node_id, relation_type, weight
- messages: message_id, session_id, role, content

## 노드 선택 SQL
SELECT *, 
  (sim*0.5 + recency*0.3 + importance*0.2) as score
FROM nodes
WHERE session_id = $1
  AND 1-(embedding <=> $2::vector) > 0.65
ORDER BY score DESC LIMIT 20;

## 현재 미결 과제
- Bridge Paint 생성 프롬프트 설계
- Generation 단계 Divergent/Constructive 분기 로직
- Export AI 분석 프롬프트