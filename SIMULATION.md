# Ideation Palette — 시뮬레이션 가이드

## 목차
1. [환경 설정](#1-환경-설정)
2. [앱 구동](#2-앱-구동)
3. [전체 플로우 개요](#3-전체-플로우-개요)
4. [Stage 1 — Home (캔버스 목록)](#4-stage-1--home-캔버스-목록)
5. [Stage 2 — Generate (재료 수집 대화)](#5-stage-2--generate-재료-수집-대화)
6. [Stage 3 — Palette (조합 캔버스)](#6-stage-3--palette-조합-캔버스)
7. [Stage 4 — Export (내보내기)](#7-stage-4--export-내보내기)
8. [크로스-캔버스 조합 시뮬레이션](#8-크로스-캔버스-조합-시뮬레이션)
9. [내부 데이터 구조 확인](#9-내부-데이터-구조-확인)
10. [노드 추출 동작 원리](#10-노드-추출-동작-원리)
11. [Bridge 노드 생성 원리](#11-bridge-노드-생성-원리)
12. [자주 발생하는 문제](#12-자주-발생하는-문제)

---

## 1. 환경 설정

### 1-1. 의존성 설치

```bash
cd "Ideation Palette"
npm install
```

### 1-2. 환경변수 확인 (`.env`)

```
VITE_OPENAI_API_KEY=sk-proj-...    # OpenAI API 키 (필수)
VITE_SUPABASE_URL=...              # 현재 미사용 (데모 모드에서 무시됨)
VITE_SUPABASE_ANON_KEY=...         # 현재 미사용
```

> **주의:** `.env` 파일이 없으면 앱이 API 호출 시 에러를 냅니다.  
> 키가 만료됐거나 잔액이 없으면 "오류: ..." 메시지가 채팅창에 나타납니다.

### 1-3. 사용 모델

| 기능 | 모델 | 위치 |
|------|------|------|
| 노드 추출 대화 | `gpt-4o-mini` | `nodeExtractor.ts` |
| Bridge 개념 생성 | `gpt-4o-mini` | `bridgePipeline.ts` |
| 기존 대화 (구버전) | `gpt-4o` | `openaiService.ts` |
| 임베딩 | `text-embedding-3-small` | `bridgePipeline.ts` |

---

## 2. 앱 구동

```bash
npm run dev
```

브라우저에서 `http://localhost:5173` 접속.

> 데이터는 **브라우저 localStorage**에 저장됩니다. Supabase/DB 연결은 현재 데모에서 비활성화되어 있습니다.

---

## 3. 전체 플로우 개요

```
Home (캔버스 목록)
  │
  ├─ [새 캔버스] ──────► Generate (재료 수집 대화)
  │                           │
  │                           │  노드 4개 이상 추출 시
  │                           ▼
  │                      Palette (조합 캔버스)
  │                           │
  │                           ▼
  │                      Export (내보내기)
  │
  └─ [조합] ──────► 다른 캔버스 선택 ──► Generate (조합 대화, 주황 UI)
                                              │
                                              ▼
                                         Palette (조합 캔버스)
```

---

## 4. Stage 1 — Home (캔버스 목록)

### 화면 구성

- 상단 바: **"Idea Palette"** 제목 + **"새 캔버스"** 버튼
- 본문: 생성된 캔버스들이 **가로 스크롤**로 나열됨 (카드 너비 288px)
- 캔버스 없을 때: 빈 점선 카드 + "첫 캔버스 만들기" 버튼

### 캔버스 카드 구성

```
┌─────────────────────────────┐
│ [제목]              [삭제]  │
│ [상태 뱃지]  [N개 재료]     │
│─────────────────────────────│
│  카테고리1                  │
│  ● 레이블A  ● 레이블B       │
│  카테고리2                  │
│  ● 레이블C                  │
│─────────────────────────────│
│  [열기]        [조합]       │
└─────────────────────────────┘
```

**상태 뱃지 색상:**
| 상태 | 뱃지 텍스트 | 색상 |
|------|------------|------|
| `generating` | 대화 중 | 보라 |
| `ready` | 팔레트 | 초록 |
| `combining` | 조합 중 | 주황 |

**노드 칩 색상:**
| 종류 | 색상 |
|------|------|
| explicit (명시) | `#5DCAA5` 초록 |
| implicit (묵시) | `#7F77DD` 보라 |
| bridge (브릿지) | `#EF9F27` 주황 |

### 새 캔버스 만들기

1. **"새 캔버스"** 클릭 → 모달 오픈
2. textarea에 탐구하고 싶은 생각/단편 입력
   ```
   예시 입력:
   "밤에 혼자 걸을 때 느끼는 묘한 해방감과 동시에 오는 공허함"
   ```
3. **Enter** 또는 **"시작하기"** 클릭
4. → `createSession({ pendingStartMessage: 입력값 })` 호출
5. → `/session/:id/generate` 로 이동, 입력값이 첫 메시지로 자동 전송됨

---

## 5. Stage 2 — Generate (재료 수집 대화)

### 화면 구성

```
┌──────────────────────────────┬────────────┐
│  헤더: [상태] N / 4          │            │
│  프로그레스바                │  추출된    │
│──────────────────────────────│  재료      │
│                              │            │
│  [대화 메시지 영역]          │  명시  묵시│
│                              │  [N]   [N] │
│                              │            │
│──────────────────────────────│  [노드카드]│
│  [텍스트 입력] [전송]        │  [노드카드]│
│  [팔레트로 이동] ← 4개 이상  │  ...       │
└──────────────────────────────┴────────────┘
```

### 대화 시뮬레이션 순서

**턴 1 — 첫 메시지 (자동 전송)**
```
사용자: "밤에 혼자 걸을 때 느끼는 묘한 해방감과 동시에 오는 공허함"
```
- AI 응답: 짧은 공감 + 열린 질문 1개
- 노드 추출 예상:
  - explicit: "밤산책", "해방감", "공허함"
  - implicit: 없거나 1개 (첫 턴이라 패턴 부족)

**턴 2**
```
사용자: "가로등 불빛이 물웅덩이에 반사될 때 그걸 밟고 싶지 않은 느낌"
```
- explicit: "가로등 반사", "물웅덩이"
- implicit 가능성: "완전함 보존" (파괴하기 싫은 감정)

**턴 3**
```
사용자: "어릴 때 엄마가 사줬던 스노볼처럼 그 순간이 유리 안에 갇혀있으면 좋겠다는 생각"
```
- explicit: "스노볼", "유리 속"
- implicit: "찰나의 보존" (반복 패턴: 파괴 금지 → 보존 욕구)

### 노드 4개 도달 시

- 프로그레스바 100%
- **"팔레트로 이동"** 버튼 활성화 (파란색)
- 클릭 시: 노드들을 `Paint[]`로 변환 → 세션에 저장 → `/session/:id/palette` 이동

### 조합 세션일 때 (주황 UI)

- 헤더 색상: 주황 (`#EF9F27`)
- 입력 버튼 배경: 주황
- 버튼 텍스트: "조합 캔버스 열기"
- 두 캔버스의 paints가 미리 로드된 상태로 시작

---

## 6. Stage 3 — Palette (조합 캔버스)

### 화면 구성

```
┌──────┬──────────────────────────────────────────┬──────────────┐
│      │  [툴바: 확대/축소/전체보기/그리드/클러스터] │  우측 패널   │
│      │──────────────────────────────────────────│              │
│ 좌측 │                                          │  (선택 없음) │
│ 패널 │         [캔버스 드래그 영역]              │  → 힌트 텍스트│
│      │   ┌────┐  ┌────┐  ┌────┐               │              │
│      │   │페인│  │페인│  │페인│               │  (1개 선택)  │
│      │   │트  │  │트  │  │트  │               │  → 노드 상세 │
│      │   └────┘  └────┘  └────┘               │  → 조합 버튼 │
│      │                                          │              │
│      │                                          │  (2개 선택)  │
│      │                                          │  → Bridge 제안│
└──────┴──────────────────────────────────────────┴──────────────┘
```

### 팔레트 진입 시 노드 로딩 순서

1. `useParams`로 세션 `id` 획득
2. `getSession(id)?.paints` 로 Paint[] 로드
3. paints 없으면 → `localStorage['ideation-paints']` fallback
4. 그것도 없으면 → `MOCK_PAINTS` (하드코딩된 예시 데이터)

### Bridge 노드 조합 시뮬레이션

1. 캔버스에서 페인트 카드 **클릭** → 선택 (파란 테두리)
2. 우측 패널: 노드 상세 + **"다른 노드와 조합하기"** 버튼
3. 버튼 클릭 → 패널이 "두 번째 노드 선택" 리스트로 변경
   - 나머지 모든 노드들이 클릭 가능한 리스트로 표시
   - 각 항목에 explicit/implicit/bridge 뱃지 표시
4. 두 번째 노드 클릭 → 2개 선택 완료
5. 우측 패널: Bridge 제안 생성 중 (로딩 스피너)
6. `chatCompletion()`으로 Bridge 개념 자동 생성
7. 결과 표시: 주황 카드 + **"+ 추가"** 버튼
8. "추가" 클릭 → Bridge Paint가 캔버스에 추가됨

**Bridge 생성 예시:**
```
노드 A: "공허함" — 밤산책의 텅 빈 감정
노드 B: "스노볼" — 찰나를 가두고 싶은 물건

Bridge 결과: "유리막" — 감정의 투명한 경계, 보존하되 차단하는 매개
```

### 크로스-캔버스 조합 (Palette 내부)

1. 툴바의 **"캔버스 조합"** 버튼 클릭
2. 다이얼로그: 다른 세션 선택 목록
3. 세션 선택 → 그 세션의 paints 미리보기
4. **"조합 시작"** → `createSession({ combineSourceIds: [...] })` 생성
5. → `/session/:newId/generate` 로 이동 (조합 대화 시작)

---

## 7. Stage 4 — Export (내보내기)

라우트: `/session/:id/export`

Palette 화면에서 **"내보내기"** (Download) 버튼 클릭 시 진입.

---

## 8. 크로스-캔버스 조합 시뮬레이션

### Home에서 조합하기

**전제:** 캔버스 2개 이상 필요

1. 첫 번째 캔버스 카드의 **"조합"** 버튼 클릭
   - 상단 바가 "조합할 캔버스를 선택하세요"로 변경
   - 첫 번째 캔버스: 주황 테두리 ("선택됨" 표시)
   - 나머지 캔버스들: 파란 테두리 + 클릭 가능
2. 두 번째 캔버스 카드 클릭
3. `handleCombine()` 실행:
   - 두 캔버스의 모든 paints 합산
   - 새 세션 생성 (status: `'combining'`)
   - 시작 메시지 자동 설정: `"[캔버스A명]와 [캔버스B명]의 재료들을 조합해보겠습니다."`
4. → 새 조합 캔버스의 Generate 화면으로 이동 (주황 UI)

### 조합 예시 시나리오

**캔버스 1:** "밤산책의 고독" → 노드: 공허함, 해방감, 가로등, 스노볼  
**캔버스 2:** "도시 소음" → 노드: 빗소리, 네온, 군중

조합 대화:
```
사용자: "두 캔버스의 '공허함'과 '군중'이 역설적으로 연결되는 것 같아"
AI: 고독 속의 군중, 군중 속의 고독... Bridge 노드: "밀집 공허"
```

---

## 9. 내부 데이터 구조 확인

### localStorage에서 직접 확인

브라우저 DevTools → Application → Local Storage → `http://localhost:5173`

**키:** `ideation-sessions`  
**값:** `CanvasSession[]` JSON 배열

```json
[
  {
    "id": "canvas_1713340800000",
    "title": "밤산책의 고독",
    "createdAt": "2026-04-17T...",
    "updatedAt": "2026-04-17T...",
    "status": "ready",
    "messages": [
      { "role": "user", "content": "밤에 혼자 걸을 때..." },
      { "role": "assistant", "content": "그 순간이 갖는..." }
    ],
    "nodes": [
      {
        "id": "n_001",
        "label": "공허함",
        "type": "implicit",
        "category": "감정",
        "description": "해방감 이면의 텅 빈 감각",
        "confidence": 0.87,
        "createdAt": "2026-04-17T..."
      }
    ],
    "edges": [
      { "source": "n_001", "target": "n_002", "relation": "contrasts_with" }
    ],
    "paints": [
      {
        "id": "n_001",
        "title": "공허함",
        "type": "text",
        "content": "해방감 이면의 텅 빈 감각",
        "paintKind": "implicit",
        "cluster": "sound-music",
        "tags": ["감정"],
        "x": 120, "y": 100
      }
    ]
  }
]
```

### 세션 초기화 (전체 삭제)

DevTools 콘솔에서:
```javascript
localStorage.removeItem('ideation-sessions')
location.reload()
```

### 특정 세션 상태 강제 변경

```javascript
// 세션을 팔레트 준비 상태로 강제 전환
const sessions = JSON.parse(localStorage.getItem('ideation-sessions'))
sessions[0].status = 'ready'
localStorage.setItem('ideation-sessions', JSON.stringify(sessions))
location.reload()
```

---

## 10. 노드 추출 동작 원리

```
사용자 메시지 입력
        │
        ▼
extractNodes(conversationHistory, existingNodes)
        │
        ├─ buildSystemPrompt(existingNodes)
        │    └─ 기존 노드 목록 주입 (중복 방지)
        │
        ├─ chatCompletion([system, ...history])
        │    └─ gpt-4o-mini, maxTokens: 1200, temp: 0.7
        │
        ├─ 응답 파싱
        │    ├─ reply: JSON 블록 제거한 텍스트
        │    └─ extractJSON(): ```json ... ``` 블록 파싱
        │
        └─ 노드 필터링
             ├─ 기존 id/label 중복 제거
             ├─ label 6자 초과 자르기
             └─ edge: 양쪽 노드가 존재하는 것만
```

**LLM 응답 형식 (nodeExtractor.ts):**
```
한국어 응답 텍스트 (1~2문장)

```json
{
  "nodes": [
    {
      "id": "n_고유번호",
      "label": "레이블",
      "type": "explicit" | "implicit",
      "category": "감정" | "주제" | ... ,
      "description": "한 줄 설명",
      "confidence": 0.0~1.0
    }
  ],
  "edges": [
    { "source": "n_id1", "target": "n_id2", "relation": "relates_to" }
  ]
}
```

**카테고리 종류:** 주제, 감정, 가치, 목표, 제약, 선호, 이미지, 장면, 은유

**엣지 관계 종류:** associates_with, contrasts_with, evokes, relates_to, echoes, inspires, avoids, wants_tone, is_unfinished

---

## 11. Bridge 노드 생성 원리

### 트리거 조건

- `bridgePipeline.ts`의 `BRIDGE_TRIGGER_COUNT = 4`
- Explicit + Implicit 노드가 4개 이상일 때 실행 가능
- **현재 구현:** PaletteScreen에서 2개 노드 수동 선택 시 chatCompletion으로 즉시 생성

### 임베딩 기반 자동 파이프라인 (bridgePipeline.ts)

```
노드들 (explicit + implicit)
        │
        ▼
ensureEmbeddings()
  각 노드 텍스트 → text-embedding-3-small API → 1536차원 벡터
        │
        ▼
findDistantPairs()
  모든 쌍에 대해 코사인 유사도 계산
  유사도 < BRIDGE_THRESHOLD(0.35) 인 쌍 = "원격 연상 후보"
  거리 순 정렬
        │
        ▼
generateBridgeConcept(nodeA, nodeB)
  gpt-4o-mini로 매개 개념 생성
  반환: { label, description, category }
        │
        ▼
BridgeResult {
  newBridgeNodes: PaintNode[],  // type: 'bridge'
  newBridgeEdges: PaintEdge[]   // isBridge: true
}
```

### Bridge 노드 구조

```json
{
  "id": "bridge_n_001_n_005",
  "label": "유리막",
  "type": "bridge",
  "category": "은유",
  "description": "감정의 투명한 경계, 보존하되 차단하는 매개",
  "confidence": 0.73,
  "bridgePair": ["n_001", "n_005"]
}
```

---

## 12. 자주 발생하는 문제

### "오류: Connection error" / "오류: ..."
**원인:** OpenAI API 키 문제  
**해결:**
1. `.env`의 `VITE_OPENAI_API_KEY` 확인
2. OpenAI 대시보드에서 키 잔액/유효성 확인
3. 키 교체 후 `npm run dev` 재시작 (vite가 `.env` 재로드)

### 팔레트에서 노드가 안 보임
**원인:** Generate → Palette 이동 시 세션 저장 타이밍 문제  
**확인:** DevTools → localStorage → `ideation-sessions` → 해당 세션의 `paints` 배열 확인  
**해결:** "팔레트로 이동" 버튼을 통해서만 이동 (URL 직접 입력 금지)

### 첫 메시지가 자동 전송 안 됨
**원인:** `pendingStartMessage`가 세션에 저장되지 않았거나 `useEffect` 타이밍 문제  
**확인:** localStorage의 해당 세션에 `pendingStartMessage` 필드 있는지 확인  
**해결:** 홈에서 "시작하기" 버튼으로만 진입 (URL 직접 입력 시 자동 전송 안 됨)

### 조합 버튼이 보이지 않음
**원인:** 캔버스가 1개뿐일 때 의도적으로 숨겨짐  
**해결:** 캔버스 2개 이상 생성 후 조합 버튼 활성화

### 삭제 버튼이 보이지 않음
**원인:** CSS `opacity-0 group-hover:opacity-100`인데 부모에 `group` 클래스 누락  
**임시 해결:** 카드에 마우스를 올렸을 때 잠깐 보이지 않으면 → 삭제 확인 모달을 직접 트리거하려면 DevTools 콘솔에서:
```javascript
const sessions = JSON.parse(localStorage.getItem('ideation-sessions'))
sessions.splice(0, 1)  // 첫 번째 세션 삭제
localStorage.setItem('ideation-sessions', JSON.stringify(sessions))
location.reload()
```

### Bridge 생성이 너무 느림
**원인:** `text-embedding-3-small` API 호출 (노드 수만큼 순차 호출)  
**현황:** 수동 Bridge(2개 선택 방식)는 chatCompletion 1회만 호출하므로 빠름  
**자동 파이프라인(`runBridgePipeline`):** 노드 N개 × 임베딩 API = N번 호출 → 느릴 수 있음

---

*최종 업데이트: 2026-04-17*
