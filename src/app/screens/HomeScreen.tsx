import { useState } from "react";
import { useNavigate } from "react-router";
import { Plus, MessageSquare, GitMerge, Trash2, ArrowRight, X } from "lucide-react";
import { Button } from "../components/ui/button";
import {
  createSession, getAllSessions, deleteSession, saveSession, getSession,
  type CanvasSession,
} from "../lib/sessionStore";

// 노드 타입별 색상
const KIND_COLOR: Record<string, string> = {
  explicit: "#5DCAA5",
  implicit: "#7F77DD",
  bridge:   "#EF9F27",
};

function CanvasMiniPreview({ session }: { session: CanvasSession }) {
  // 카테고리별로 노드 묶기
  const groups: Record<string, typeof session.nodes> = {};
  const nodes = session.nodes.length > 0 ? session.nodes
    : session.paints.map(p => ({
        id: p.id, label: p.title,
        type: (p.paintKind ?? "explicit") as any,
        category: p.tags?.[0] ?? "기타",
        description: p.content, createdAt: p.timestamp,
      }));

  nodes.forEach(n => {
    if (!groups[n.category]) groups[n.category] = [];
    groups[n.category].push(n);
  });

  if (nodes.length === 0) {
    return (
      <div className="flex items-center justify-center h-24 text-xs text-gray-300">
        아직 재료 없음
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {Object.entries(groups).slice(0, 4).map(([cat, items]) => (
        <div key={cat}>
          <div className="text-[10px] text-gray-400 mb-1">{cat}</div>
          <div className="flex flex-wrap gap-1">
            {items.slice(0, 5).map(n => (
              <span
                key={n.id}
                className="text-[10px] px-2 py-0.5 rounded-full text-white truncate max-w-[80px]"
                style={{ background: KIND_COLOR[n.type] ?? "#aaa" }}
                title={n.label}
              >
                {n.label}
              </span>
            ))}
            {items.length > 5 && (
              <span className="text-[10px] text-gray-400">+{items.length - 5}</span>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}

function statusBadge(s: CanvasSession) {
  if (s.status === "combining")  return { text: "조합 중",  bg: "bg-amber-100",  color: "text-amber-700" };
  if (s.status === "ready")      return { text: "팔레트",   bg: "bg-emerald-100", color: "text-emerald-700" };
  return                                { text: "대화 중",  bg: "bg-violet-100",  color: "text-violet-700" };
}

export function HomeScreen() {
  const navigate  = useNavigate();
  const [prompt,  setPrompt]  = useState("");
  const [sessions, setSessions] = useState<CanvasSession[]>(() => getAllSessions());

  // 조합 선택 모드
  const [combineSource, setCombineSource] = useState<string | null>(null);
  // 삭제 확인
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  // 새 캔버스 입력 모달
  const [showNewCanvas, setShowNewCanvas] = useState(false);

  const refresh = () => setSessions(getAllSessions());

  const handleStart = () => {
    if (!prompt.trim()) return;
    const session = createSession({ pendingStartMessage: prompt.trim() });
    navigate(`/session/${session.id}/generate`);
  };

  const handleCombine = (targetId: string) => {
    const srcSession = getSession(combineSource!);
    const tgtSession = getSession(targetId);
    if (!srcSession || !tgtSession) return;

    // 두 캔버스의 paints 합치기
    const srcPaints = srcSession.paints.map((p, i) => ({
      ...p, x: 80 + (i % 4) * 290, y: 80 + Math.floor(i / 4) * 200,
    }));
    const tgtPaints = tgtSession.paints.map((p, i) => ({
      ...p,
      id: `${p.id}_from_${targetId}`,
      x: 80 + ((srcPaints.length + i) % 4) * 290,
      y: 80 + Math.floor((srcPaints.length + i) / 4) * 200,
    }));

    const newSession = createSession({
      combineSourceIds: [combineSource!, targetId],
      pendingStartMessage:
        `"${srcSession.title}"와 "${tgtSession.title}"의 재료들을 조합해보겠습니다.`,
    });
    saveSession({ ...newSession, paints: [...srcPaints, ...tgtPaints], status: "combining" });
    setCombineSource(null);
    navigate(`/session/${newSession.id}/generate`);
  };

  return (
    <div className="h-full flex flex-col bg-gray-50 overflow-hidden">

      {/* 상단 바 */}
      <div className="h-14 bg-white border-b border-gray-200 flex items-center justify-between px-6 shrink-0">
        <span className="text-sm font-medium text-gray-900">Idea Palette</span>

        {combineSource ? (
          <div className="flex items-center gap-3">
            <span className="text-sm text-amber-600 font-medium">
              조합할 캔버스를 선택하세요
            </span>
            <Button
              variant="ghost" size="sm"
              onClick={() => setCombineSource(null)}
              className="gap-1 text-gray-400"
            >
              <X className="w-4 h-4" /> 취소
            </Button>
          </div>
        ) : (
          <Button
            size="sm"
            onClick={() => setShowNewCanvas(true)}
            className="gap-2 bg-blue-500 hover:bg-blue-600"
          >
            <Plus className="w-4 h-4" />
            새 캔버스
          </Button>
        )}
      </div>

      {/* 캔버스들 */}
      <div className="flex-1 overflow-x-auto overflow-y-hidden">
        <div className="flex gap-4 p-6 h-full items-start min-w-max">

          {sessions.length === 0 && (
            <div className="flex items-center justify-center w-72 h-64 rounded-2xl border-2 border-dashed border-gray-200 text-center">
              <div>
                <p className="text-sm text-gray-400 mb-3">아직 캔버스가 없어요</p>
                <Button size="sm" onClick={() => setShowNewCanvas(true)} className="gap-2">
                  <Plus className="w-4 h-4" /> 첫 캔버스 만들기
                </Button>
              </div>
            </div>
          )}

          {sessions.map(session => {
            const badge    = statusBadge(session);
            const isSource = combineSource === session.id;
            const canTarget = combineSource && combineSource !== session.id;

            return (
              <div
                key={session.id}
                className={`
                  w-72 shrink-0 bg-white rounded-2xl border-2 flex flex-col transition-all
                  ${isSource
                    ? "border-amber-400 shadow-lg shadow-amber-100"
                    : canTarget
                    ? "border-blue-300 cursor-pointer hover:border-blue-500 hover:shadow-md"
                    : "border-gray-200 hover:border-gray-300"
                  }
                `}
                onClick={() => {
                  if (canTarget) { handleCombine(session.id); return; }
                  if (!combineSource) navigate(
                    session.status === "generating"
                      ? `/session/${session.id}/generate`
                      : `/session/${session.id}/palette`
                  );
                }}
              >
                {/* 카드 헤더 */}
                <div className="p-4 border-b border-gray-100">
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <h3 className="text-sm font-medium text-gray-900 line-clamp-2 flex-1">
                      {session.title}
                    </h3>
                    {!combineSource && (
                      <button
                        className="p-1 rounded-lg hover:bg-red-50 shrink-0 opacity-0 group-hover:opacity-100"
                        onClick={e => { e.stopPropagation(); setConfirmDelete(session.id); }}
                      >
                        <Trash2 className="w-3.5 h-3.5 text-gray-300 hover:text-red-400" />
                      </button>
                    )}
                  </div>

                  <div className="flex items-center gap-2">
                    <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${badge.bg} ${badge.color}`}>
                      {badge.text}
                    </span>
                    <span className="text-[10px] text-gray-400">
                      {(session.nodes.length || session.paints.length)}개 재료
                    </span>
                  </div>
                </div>

                {/* 노드 미리보기 */}
                <div className="p-4 flex-1">
                  <CanvasMiniPreview session={session} />
                </div>

                {/* 액션 */}
                {!combineSource && (
                  <div className="px-4 pb-4 flex gap-2">
                    <Button
                      size="sm" variant="outline"
                      className="flex-1 gap-1.5 text-xs"
                      onClick={e => {
                        e.stopPropagation();
                        navigate(
                          session.status === "generating"
                            ? `/session/${session.id}/generate`
                            : `/session/${session.id}/palette`
                        );
                      }}
                    >
                      <ArrowRight className="w-3.5 h-3.5" />
                      열기
                    </Button>
                    {sessions.length > 1 && (
                      <Button
                        size="sm" variant="outline"
                        className="flex-1 gap-1.5 text-xs text-amber-600 border-amber-200 hover:bg-amber-50"
                        onClick={e => { e.stopPropagation(); setCombineSource(session.id); }}
                      >
                        <GitMerge className="w-3.5 h-3.5" />
                        조합
                      </Button>
                    )}
                  </div>
                )}

                {canTarget && (
                  <div className="px-4 pb-4">
                    <div className="w-full py-2 rounded-xl bg-blue-500 text-white text-xs text-center font-medium">
                      이 캔버스와 조합하기
                    </div>
                  </div>
                )}

                {isSource && (
                  <div className="px-4 pb-4">
                    <div className="w-full py-2 rounded-xl bg-amber-100 text-amber-700 text-xs text-center font-medium">
                      선택됨 — 조합할 캔버스를 클릭하세요
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* 새 캔버스 모달 */}
      {showNewCanvas && (
        <div
          className="fixed inset-0 bg-black/20 flex items-center justify-center z-50"
          onClick={() => setShowNewCanvas(false)}
        >
          <div
            className="bg-white rounded-2xl border border-gray-200 p-6 w-full max-w-md mx-4"
            onClick={e => e.stopPropagation()}
          >
            <h3 className="text-sm font-medium text-gray-900 mb-4">새 캔버스 시작하기</h3>
            <textarea
              autoFocus
              placeholder="어떤 생각이나 단편을 탐구하고 싶으신가요?"
              value={prompt}
              onChange={e => setPrompt(e.target.value)}
              onKeyDown={e => {
                if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleStart(); }
                if (e.key === "Escape") setShowNewCanvas(false);
              }}
              className="w-full min-h-[100px] rounded-xl border border-gray-200 px-3 py-2.5 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-blue-400 mb-4"
            />
            <div className="flex gap-2">
              <Button variant="outline" className="flex-1" onClick={() => setShowNewCanvas(false)}>
                취소
              </Button>
              <Button
                disabled={!prompt.trim()}
                className="flex-1 gap-2 bg-blue-500 hover:bg-blue-600"
                onClick={handleStart}
              >
                <MessageSquare className="w-4 h-4" />
                시작하기
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* 삭제 확인 모달 */}
      {confirmDelete && (
        <div className="fixed inset-0 bg-black/20 flex items-center justify-center z-50" onClick={() => setConfirmDelete(null)}>
          <div className="bg-white rounded-2xl border border-gray-200 p-6 max-w-sm w-full mx-4" onClick={e => e.stopPropagation()}>
            <h3 className="text-sm font-medium text-gray-900 mb-2">캔버스를 삭제할까요?</h3>
            <p className="text-xs text-gray-500 mb-5">모든 대화와 노드가 삭제됩니다.</p>
            <div className="flex gap-2">
              <Button variant="outline" className="flex-1" onClick={() => setConfirmDelete(null)}>취소</Button>
              <Button variant="destructive" className="flex-1" onClick={() => {
                deleteSession(confirmDelete);
                refresh();
                setConfirmDelete(null);
              }}>삭제</Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
