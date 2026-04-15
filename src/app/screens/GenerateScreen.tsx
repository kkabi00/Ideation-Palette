import { useState, useRef, useEffect } from "react";
import { useNavigate } from "react-router";
import {
  Send,
  Sparkles,
  Pin,
  Type,
  Image,
  Music,
  Layers2,
  ArrowRight,
  Upload,
  MessageSquare,
  Video,
  ChevronDown,
  ChevronUp,
  Loader2,
} from "lucide-react";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { ScrollArea } from "../components/ui/scroll-area";
import { Paint, PaintType } from "../components/PaintCard";
import {
  PaletteCluster,
  DEFAULT_CLUSTERS,
  CLUSTER_DOT,
  CLUSTER_BADGE
} from "../types/cluster";
import { sendToOpenAI, toOpenAIPaint, ConversationMessage } from "../lib/openaiService";

interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  extractable?: boolean;
  extracted?: boolean;
  suggestedCluster?: string;
}

const INITIAL_MESSAGES: ChatMessage[] = [
  {
    id: "1",
    role: "assistant",
    content:
      "안녕하세요! 저는 팔레트 에이전트입니다. 장면, 분위기, 소리, 이미지 또는 무작위 생각 등 어떤 단편이든 공유해주세요. pre-inventive 재료로 포착할 수 있도록 도와드리겠습니다.",
    extractable: false,
  },
];

// 최소 메시지 수 (Progress bar를 채우기 위한)
const MIN_MESSAGES_FOR_PALETTE = 10;

const typeIcons: Record<PaintType, typeof Type> = {
  text: Type,
  image: Image,
  audio: Music,
  video: Video,
  mixed: Layers2,
};

export function GenerateScreen() {
  const navigate = useNavigate();
  const [messages, setMessages] = useState<ChatMessage[]>(INITIAL_MESSAGES);
  const [input, setInput] = useState("");
  const [paints, setPaints] = useState<Paint[]>([]);
  const [clusters, setClusters] = useState<PaletteCluster[]>(DEFAULT_CLUSTERS);
  const [collapsedClusters, setCollapsedClusters] = useState<Set<string>>(new Set());
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const chatEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // 채팅 컨텍스트 기반으로 클러스터 자동 결정
  const inferClusterFromContent = (content: string): string => {
    const lowerContent = content.toLowerCase();
    
    // 간단한 키워드 기반 클러스터링
    if (lowerContent.match(/color|light|visual|neon|dark|bright|shadow|atmosphere/)) {
      return "visual-tone";
    }
    if (lowerContent.match(/sound|music|melody|audio|voice|whisper|ambient|rhythm/)) {
      return "sound-music";
    }
    if (lowerContent.match(/character|person|figure|someone|they|face|hood/)) {
      return "character";
    }
    if (lowerContent.match(/story|scene|plot|narrative|dialogue|happen|meet|chase/)) {
      return "storyline";
    }
    
    // 기본값
    return "visual-tone";
  };

  const toggleCluster = (clusterId: string) => {
    setCollapsedClusters(prev => {
      const next = new Set(prev);
      if (next.has(clusterId)) {
        next.delete(clusterId);
      } else {
        next.add(clusterId);
      }
      return next;
    });
  };

  // 클러스터별로 paints 그룹화
  const paintsByCluster = paints.reduce((acc, paint) => {
    const clusterId = paint.cluster || "visual-tone";
    if (!acc[clusterId]) {
      acc[clusterId] = [];
    }
    acc[clusterId].push(paint);
    return acc;
  }, {} as Record<string, Paint[]>);

  // 키워드와 맥락 자동 추출
  const extractKeywordsAndContext = (content: string): { keyword: string; context: string } => {
    // 간단한 키워드 추출 (첫 3-5단어 또는 핵심 구절)
    const words = content.trim().split(/\s+/);
    const keyword = words.slice(0, Math.min(4, words.length)).join(' ');
    
    // 맥락 설명 (원본의 요약된 버전)
    const context = content.length > 80 
      ? `From conversation: "${content.slice(0, 80)}..."`
      : `From conversation: "${content}"`;
    
    return { keyword, context };
  };

  const sendMessage = async () => {
    if (!input.trim() || isLoading) return;

    const userContent = input.trim();
    const userMsg: ChatMessage = {
      id: `msg-${Date.now()}`,
      role: "user",
      content: userContent,
      extractable: false,
    };

    setMessages((prev) => [...prev, userMsg]);
    setInput("");
    setIsLoading(true);
    setError(null);

    try {
      // 전체 대화 히스토리를 OpenAI에 전달 (시스템 프롬프트 제외)
      const history: ConversationMessage[] = [
        ...messages.map((m) => ({ role: m.role, content: m.content })),
        { role: "user", content: userContent },
      ];

      const aiResponse = await sendToOpenAI(history);

      const aiMsg: ChatMessage = {
        id: `msg-${Date.now() + 1}`,
        role: "assistant",
        content: aiResponse.message,
        extractable: false,
      };
      setMessages((prev) => [...prev, aiMsg]);

      // AI가 추출한 페인트들 추가
      const newPaints = aiResponse.paints.map((p) => toOpenAIPaint(p, "ai"));
      setPaints((prev) => [...newPaints, ...prev]);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "알 수 없는 오류";
      setError(`API 오류: ${msg}`);
      // 에러 메시지를 채팅에 표시
      setMessages((prev) => [
        ...prev,
        {
          id: `err-${Date.now()}`,
          role: "assistant",
          content: "죄송합니다, 응답을 받아오는 데 실패했습니다. 다시 시도해주세요.",
          extractable: false,
        },
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  // Progress 계산 (사용자 메시지 기준)
  const userMessageCount = messages.filter(m => m.role === "user").length;
  const progress = Math.min((userMessageCount / MIN_MESSAGES_FOR_PALETTE) * 100, 100);
  const isPaletteReady = userMessageCount >= MIN_MESSAGES_FOR_PALETTE;

  const togglePinPaint = (paintId: string) => {
    setPaints(prev => prev.map(p => 
      p.id === paintId ? { ...p, pinned: !p.pinned } : p
    ));
  };

  return (
    <div className="h-full flex">
      {/* Main Chat Area — 70% */}
      <div className="flex-[7] flex flex-col min-w-0 bg-white">
        {/* Chat Header */}
        <div className="px-6 py-4 border-b border-gray-200">
          <div className="flex items-center gap-2 mb-3">
            <div className="w-7 h-7 rounded-lg bg-blue-500 flex items-center justify-center">
              <Sparkles className="w-4 h-4 text-white" />
            </div>
            <span className="text-sm text-gray-900">팔레트 에이전트</span>
          </div>
          
          {/* Progress Bar */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <span className="text-xs text-gray-500">대화 진행률</span>
            </div>
            <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
              <div
                className="h-full bg-blue-500 transition-all duration-500 ease-out"
                style={{ width: `${progress}%` }}
              />
            </div>
            <p className="text-[10px] text-gray-400 min-h-[14px]">
              {!isPaletteReady && "팔레트를 잠금 해제하려면 더 많은 단편을 공유하세요"}
              {isPaletteReady && "✓ 팔레트에서 탐색할 준비가 되었습니다!"}
            </p>
          </div>
        </div>

        {/* Chat Messages */}
        <div className="flex-1 overflow-y-auto px-6 py-4">
          <div className="max-w-2xl mx-auto space-y-4">
            {messages.map((msg) => (
              <div
                key={msg.id}
                className={`flex ${
                  msg.role === "user" ? "justify-end" : "justify-start"
                }`}
              >
                <div className="max-w-[85%]">
                  {msg.role === "assistant" && (
                    <div className="flex items-center gap-1.5 mb-1.5">
                      <Sparkles className="w-3 h-3 text-blue-500" />
                      <span className="text-[10px] text-gray-400">팔레트 에이전트</span>
                    </div>
                  )}
                  <div
                    className={`rounded-2xl px-4 py-3 ${
                      msg.role === "user"
                        ? "bg-blue-500 text-white rounded-br-md"
                        : "bg-gray-100 text-gray-900 rounded-bl-md"
                    }`}
                  >
                    <p className="text-sm">{msg.content}</p>
                  </div>
                </div>
              </div>
            ))}
            {isLoading && (
              <div className="flex justify-start">
                <div className="max-w-[85%]">
                  <div className="flex items-center gap-1.5 mb-1.5">
                    <Sparkles className="w-3 h-3 text-blue-500" />
                    <span className="text-[10px] text-gray-400">팔레트 에이전트</span>
                  </div>
                  <div className="bg-gray-100 rounded-2xl rounded-bl-md px-4 py-3">
                    <div className="flex items-center gap-1.5">
                      <span className="w-1.5 h-1.5 rounded-full bg-gray-400 animate-bounce [animation-delay:0ms]" />
                      <span className="w-1.5 h-1.5 rounded-full bg-gray-400 animate-bounce [animation-delay:150ms]" />
                      <span className="w-1.5 h-1.5 rounded-full bg-gray-400 animate-bounce [animation-delay:300ms]" />
                    </div>
                  </div>
                </div>
              </div>
            )}
            <div ref={chatEndRef} />
          </div>
        </div>

        {/* Chat Input */}
        <div className="px-6 py-4 border-t border-gray-200">
          <div className="max-w-2xl mx-auto">
            <div className="flex gap-2">
              <button className="w-10 h-10 rounded-xl border border-gray-200 flex items-center justify-center text-gray-400 hover:bg-gray-50 transition-colors shrink-0">
                <Upload className="w-4 h-4" />
              </button>
              <div className="flex-1 relative">
                <Input
                  type="text"
                  placeholder="단편, 장면, 분위기 또는 아이디어를 공유하세요..."
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && sendMessage()}
                  disabled={isLoading}
                  className="pr-12 h-10 rounded-xl border-gray-200 bg-gray-50"
                />
                <Button
                  onClick={sendMessage}
                  size="icon"
                  disabled={isLoading || !input.trim()}
                  className="absolute right-1 top-1 w-8 h-8 rounded-lg bg-blue-500 hover:bg-blue-600 disabled:opacity-50"
                >
                  {isLoading ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <Send className="w-3.5 h-3.5" />
                  )}
                </Button>
              </div>
            </div>
            <div className="flex items-center justify-center mt-3">
              <Button
                onClick={() => navigate("/palette")}
                variant="outline"
                className="gap-2 rounded-xl text-sm h-9"
                disabled={!isPaletteReady}
              >
                <ArrowRight className="w-4 h-4" />
                팔레트로 이동
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Right Panel — 30%: Preinventive Materials */}
      <div className="flex-[3] border-l border-gray-200 bg-gray-50 flex flex-col min-w-0">
        <div className="px-5 py-4 border-b border-gray-200 bg-white">
          <div className="flex items-center gap-2 mb-1">
            <MessageSquare className="w-4 h-4 text-blue-500" />
            <h2 className="text-sm text-gray-900">대화 단편</h2>
          </div>
          <p className="text-xs text-gray-500">
            대화에서 포착된 단편들
          </p>
        </div>

        <ScrollArea className="flex-1">
          <div className="p-4 space-y-4">
            {clusters.map(cluster => {
              const paintsInCluster = paintsByCluster[cluster.id] || [];
              if (paintsInCluster.length === 0) return null;
              
              const isCollapsed = collapsedClusters.has(cluster.id);
              const dotClass = CLUSTER_DOT[cluster.color] || "bg-gray-400";
              
              return (
                <div key={cluster.id}>
                  <button
                    onClick={() => toggleCluster(cluster.id)}
                    className="w-full flex items-center justify-between mb-2 px-2 py-1.5 rounded-lg hover:bg-gray-100 transition-colors group"
                  >
                    <div className="flex items-center gap-2">
                      <div className={`w-2 h-2 rounded-full ${dotClass}`} />
                      <h4 className="text-xs font-medium text-gray-700">{cluster.label}</h4>
                      <span className="text-[10px] text-gray-400">({paintsInCluster.length})</span>
                    </div>
                    <div className="text-gray-400 group-hover:text-gray-600">
                      {isCollapsed ? (
                        <ChevronDown className="w-3.5 h-3.5" />
                      ) : (
                        <ChevronUp className="w-3.5 h-3.5" />
                      )}
                    </div>
                  </button>
                  
                  {!isCollapsed && (
                    <div className="space-y-2 pl-1 pr-2">
                      {paintsInCluster.map((paint) => {
                        const TypeIcon = typeIcons[paint.type];
                        const isPinned = paint.pinned || false;
                        return (
                          <div
                            key={paint.id}
                            className={`bg-white rounded-xl p-3 transition-all group ${
                              isPinned
                                ? "border-2 border-blue-400 shadow-sm"
                                : "border border-gray-200 hover:border-gray-300"
                            }`}
                          >
                            <div className="flex items-start gap-3">
                              <div className="w-7 h-7 rounded-lg bg-gray-100 flex items-center justify-center shrink-0 mt-0.5">
                                <TypeIcon className="w-3.5 h-3.5 text-gray-500" />
                              </div>
                              <div className="flex-1 min-w-0">
                                <h4 className="text-sm text-gray-900 truncate">
                                  {paint.title}
                                </h4>
                                <p className="text-xs text-gray-500 truncate mt-0.5">
                                  {paint.content}
                                </p>
                              </div>
                              <button
                                onClick={() => togglePinPaint(paint.id)}
                                className={`transition-all p-1 rounded-md hover:bg-gray-100 ${
                                  isPinned ? "opacity-100" : "opacity-0 group-hover:opacity-100"
                                }`}
                              >
                                <Pin
                                  className={`w-3.5 h-3.5 ${
                                    isPinned ? "text-blue-500 fill-blue-500" : "text-gray-400"
                                  }`}
                                />
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </ScrollArea>

        {/* Counter */}
        <div className="px-5 py-3 border-t border-gray-200 bg-white">
          <div className="flex items-center justify-between">
            <span className="text-xs text-gray-500">
              <span className="text-blue-600">{paints.length}</span>개 페인트 포착됨
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}