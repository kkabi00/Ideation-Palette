import { useState, useRef, useEffect, useCallback, useMemo } from "react";
import { useNavigate } from "react-router";
import {
  Send,
  Sparkles,
  Plus,
  FileText,
  Combine,
  Camera,
  X,
  Trash2,
  Check,
  ZoomIn,
  ZoomOut,
  Maximize2,
  LayoutGrid,
  ChevronLeft,
  ChevronRight,
  ImagePlus,
  Download,
  FolderPlus,
  FilePlus,
} from "lucide-react";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { ScrollArea } from "../components/ui/scroll-area";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "../components/ui/dialog";
import { PaintCard, Paint } from "../components/PaintCard";
import {
  DEFAULT_CLUSTERS,
  CLUSTER_DOT,
  PaletteCluster,
  AVAILABLE_COLORS,
} from "../types/cluster";
import { loadNodes } from "../lib/sessionService";
import { generateImage, extractPaintMeta } from "../lib/openaiService";

// --- Mock Data with positions ---
const MOCK_PAINTS: Paint[] = [
  {
    id: "p1",
    title: "바다 옆 석양",
    type: "image",
    content: "황금빛 시간이 잔잔한 파도에 따뜻한 색조를 비추는 장면",
    source: "user",
    tags: ["해변", "석양", "평화로운"],
    timestamp: "2024-03-24T14:30:00",
    cluster: "visual-tone",
    imageUrl: "https://images.unsplash.com/photo-1507525428034-b723cf961d3e?w=800",
    x: 100,
    y: 100,
  },
  {
    id: "p2",
    title: "도시의 밤 분위기",
    type: "audio",
    content: "포장도로 위의 빗소리, 멀리 들리는 교통 소음, 네온 버징",
    source: "ai",
    tags: ["도시", "비", "앰비언트"],
    timestamp: "2024-03-24T14:35:00",
    cluster: "sound-music",
    x: 500,
    y: 120,
  },
  {
    id: "p3",
    title: "방랑자의 귀환",
    type: "text",
    content: "오랜 해외 생활 끝에, 그녀는 옛 서점이 여전히 그 자리에 있는 것을 발견했다...",
    source: "user",
    tags: ["귀향", "향수"],
    timestamp: "2024-03-24T14:40:00",
    cluster: "storyline",
    x: 900,
    y: 80,
  },
  {
    id: "p4",
    title: "풍파를 겪은 형사",
    type: "text",
    content: "65세, 회색 수염, 깊은 상처를 숨긴 친절한 눈",
    source: "ai",
    tags: ["캐릭터", "형사"],
    timestamp: "2024-03-24T14:45:00",
    cluster: "character",
    x: 1200,
    y: 150,
  },
  {
    id: "p5",
    title: "네온 반사",
    type: "image",
    content: "상점의 분홍색과 청록색 조명을 반사하는 젖은 거리",
    source: "ai",
    tags: ["사이버펑크", "네온", "도시"],
    timestamp: "2024-03-24T14:50:00",
    cluster: "visual-tone",
    imageUrl: "https://images.unsplash.com/photo-1517094388029-2f22999dc146?w=800",
    x: 150,
    y: 350,
  },
  {
    id: "p6",
    title: "커피숍 대화",
    type: "text",
    content: '"이 자리 비어있나요?" 그녀가 물었다, 이미 답을 알면서.',
    source: "user",
    tags: ["대화", "긴장감"],
    timestamp: "2024-03-24T14:55:00",
    cluster: "storyline",
    x: 850,
    y: 350,
  },
  {
    id: "p7",
    title: "피아노 멜로디 단편",
    type: "audio",
    content: "우울한 마이너 진행, 느린 템포, 사색적인",
    source: "ai",
    tags: ["피아노", "슬픈", "멜로디"],
    timestamp: "2024-03-24T15:00:00",
    cluster: "sound-music",
    x: 550,
    y: 380,
  },
  {
    id: "p8",
    title: "조합된 장면",
    type: "text",
    content: "석양 + 피아노 멜로디가 씁쓸한 이별의 순간을 만들다",
    source: "ai",
    tags: ["조합됨", "감정적"],
    timestamp: "2024-03-24T15:05:00",
    derivedFrom: ["p1", "p7"],
    cluster: "visual-tone",
    x: 1100,
    y: 700,
  },
];

interface ClusterRegion {
  clusterId: string;
  centerX: number;
  centerY: number;
  width: number;
  height: number;
}

interface AgentMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  imageUrl?: string;
  paintData?: Partial<Paint>;
}

interface CombineSuggestion {
  id: string;
  title: string;
  description: string;
  rationale: string;
  type: "text" | "image" | "audio" | "video";
}

// Helper to generate unique message IDs
let messageCounter = 0;
const generateMessageId = () => {
  messageCounter += 1;
  return `msg-${Date.now()}-${messageCounter}-${Math.random().toString(36).substr(2, 9)}`;
};

export function PaletteScreen() {
  const navigate = useNavigate();
  const [dbLoaded, setDbLoaded] = useState(false);
  const [paints, setPaints] = useState<Paint[]>(() => {
    // 초기값: localStorage fallback
    try {
      const saved = localStorage.getItem("ideation-paints");
      if (saved) {
        const parsed: Paint[] = JSON.parse(saved);
        if (parsed.length > 0) return parsed;
      }
    } catch {}
    return MOCK_PAINTS;
  });
  const [deletedPaints, setDeletedPaints] = useState<Paint[]>([]);
  const [showTrashModal, setShowTrashModal] = useState(false);

  // DB에서 노드 로드 (Supabase 설정된 경우)
  useEffect(() => {
    const sessionId = localStorage.getItem("ideation-session-id");
    if (!sessionId || dbLoaded) return;
    loadNodes(sessionId).then((nodes) => {
      if (nodes.length > 0) {
        // x/y 좌표가 없으면 격자 배치
        const positioned = nodes.map((n, i) => ({
          ...n,
          x: n.x ?? 120 + (i % 4) * 300,
          y: n.y ?? 100 + Math.floor(i / 4) * 220,
        }));
        setPaints(positioned);
      }
      setDbLoaded(true);
    });
  }, [dbLoaded]);
  const [selectedPaint, setSelectedPaint] = useState<string | null>(null);
  const [editingPaint, setEditingPaint] = useState<string | null>(null);
  const [combineMode, setCombineMode] = useState(false);
  const [combineSelection, setCombineSelection] = useState<string[]>([]);
  const [combineSuggestions, setCombineSuggestions] = useState<CombineSuggestion[]>([]);
  const [combineMethodSelected, setCombineMethodSelected] = useState(false);
  const [draggingPaint, setDraggingPaint] = useState<string | null>(null);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const [agentOpen, setAgentOpen] = useState(true);
  const [exploreInput, setExploreInput] = useState("");
  const [exploreMessages, setExploreMessages] = useState<AgentMessage[]>([]);
  const [zoomLevel, setZoomLevel] = useState(1);
  const [panOffset, setPanOffset] = useState({ x: 0, y: 0 });
  const [isPanning, setIsPanning] = useState(false);
  const [panStart, setPanStart] = useState({ x: 0, y: 0 });
  
  // 새 기능 관련 상태
  const [showAddMenu, setShowAddMenu] = useState(false);
  const [showNewClusterDialog, setShowNewClusterDialog] = useState(false);
  const [newClusterName, setNewClusterName] = useState("");
  const [newClusterColor, setNewClusterColor] = useState("violet");
  const [baseClusters, setBaseClusters] = useState<PaletteCluster[]>(DEFAULT_CLUSTERS);
  const [userClusters, setUserClusters] = useState<PaletteCluster[]>([]);
  const [addToClusterDialogOpen, setAddToClusterDialogOpen] = useState(false);
  const [targetClusterId, setTargetClusterId] = useState<string | null>(null);
  const [selectedCluster, setSelectedCluster] = useState<string | null>(null);
  const [editingCluster, setEditingCluster] = useState<string | null>(null);
  const [mediaCreationMode, setMediaCreationMode] = useState<"image" | "video" | null>(null);
  const [isMediaCreationSession, setIsMediaCreationSession] = useState(false);
  const [extractingMsgId, setExtractingMsgId] = useState<string | null>(null);

  const canvasRef = useRef<HTMLDivElement>(null);
  const scrollAreaRef = useRef<HTMLDivElement>(null);

  // allClusters를 useMemo로 계산하여 무한 루프 방지
  const allClusters = useMemo(() => {
    return [...baseClusters, ...userClusters];
  }, [baseClusters, userClusters]);

  const handlePaintUpdate = (id: string, updates: Partial<Paint>) => {
    setPaints((prev) =>
      prev.map((p) => (p.id === id ? { ...p, ...updates } : p))
    );
  };

  // Generate combine suggestions when selection changes
  useEffect(() => {
    if (combineMode && combineSelection.length >= 2) {
      const selectedPaints = paints.filter((p) => combineSelection.includes(p.id));
      
      // 초기 메시지: 조합에 대한 질문
      const paint1 = selectedPaints[0];
      const paint2 = selectedPaints[1];
      
      setExploreMessages([
        {
          id: generateMessageId(),
          role: "assistant",
          content: `"${paint1.title}"과(와) "${paint2.title}"을(를) 조합하면, 어떻게 될 것 같나요? 어떤 느낌이 드나요?`,
        },
      ]);
      
      // 2개의 합성 옵션만 제공
      const suggestions: CombineSuggestion[] = [
        {
          id: "s1",
          title: "이미지로 합성",
          description: "",
          rationale: "",
          type: "image",
        },
        {
          id: "s2",
          title: "비디오로 합성",
          description: "",
          rationale: "",
          type: "video",
        },
      ];
      
      setCombineSuggestions(suggestions);
      setCombineMethodSelected(false); // 조합 선택 초기화
    } else {
      setCombineSuggestions([]);
      setCombineMethodSelected(false);
    }
  }, [combineMode, combineSelection]);

  // Initialize explore messages when paint is selected
  useEffect(() => {
    if (selectedPaint && !combineMode) {
      const paint = paints.find((p) => p.id === selectedPaint);
      if (paint) {
        setExploreMessages([
          {
            id: generateMessageId(),
            role: "assistant",
            content: `"${paint.title}"을(를) 더 깊이 탐구해봅시다. 어떤 측면을 확장하고 싶으신가요?`,
          },
        ]);
      }
    }
  }, [selectedPaint, combineMode]);

  // Calculate cluster regions based on paint positions
  const clusterRegions = useCallback((): ClusterRegion[] => {
    const regions: ClusterRegion[] = [];
    
    allClusters.forEach((cluster) => {
      // derivedFrom이 없는 카드만 클러스터 영역 계산에 포함
      const clusterPaints = paints.filter(
        (p) => p.cluster === cluster.id && 
               p.x !== undefined && 
               p.y !== undefined && 
               (!p.derivedFrom || p.derivedFrom.length === 0)
      );
      
      if (clusterPaints.length === 0) return;
      
      const xs = clusterPaints.map((p) => p.x!);
      const ys = clusterPaints.map((p) => p.y!);
      
      const minX = Math.min(...xs) - 40;
      const maxX = Math.max(...xs) + 280; // card width ~260px
      const minY = Math.min(...ys) - 40;
      const maxY = Math.max(...ys) + 220; // card height ~180px
      
      const centerX = (minX + maxX) / 2;
      const centerY = (minY + maxY) / 2;
      const width = maxX - minX;
      const height = maxY - minY;
      
      regions.push({
        clusterId: cluster.id,
        centerX,
        centerY,
        width,
        height,
      });
    });
    
    return regions;
  }, [paints, allClusters]);

  const handleMouseDown = (paintId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    
    if (combineMode) {
      if (combineSelection.includes(paintId)) {
        setCombineSelection(combineSelection.filter((id) => id !== paintId));
      } else {
        setCombineSelection([...combineSelection, paintId]);
      }
      return;
    }

    const paint = paints.find((p) => p.id === paintId);
    if (!paint || paint.x === undefined || paint.y === undefined) return;

    // Start dragging
    setDraggingPaint(paintId);
    setSelectedPaint(paintId);
    setSelectedCluster(null); // 카드 선택 시 클러스터 선택 해제
    
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    const canvasRect = canvas.getBoundingClientRect();
    const scrollLeft = canvas.scrollLeft;
    const scrollTop = canvas.scrollTop;
    
    // Calculate offset considering scroll and zoom
    const clickX = (e.clientX - canvasRect.left + scrollLeft) / zoomLevel;
    const clickY = (e.clientY - canvasRect.top + scrollTop) / zoomLevel;
    
    setDragOffset({
      x: clickX - paint.x,
      y: clickY - paint.y,
    });
  };

  const handlePaintDoubleClick = (paintId: string) => {
    if (!combineMode) {
      setEditingPaint(paintId);
      setSelectedPaint(paintId);
    }
  };

  const handleMouseMove = useCallback(
    (e: MouseEvent) => {
      if (isPanning && canvasRef.current) {
        const dx = e.clientX - panStart.x;
        const dy = e.clientY - panStart.y;
        
        if (canvasRef.current) {
          canvasRef.current.scrollLeft = panOffset.x - dx;
          canvasRef.current.scrollTop = panOffset.y - dy;
        }
        return;
      }

      if (!draggingPaint || !canvasRef.current) return;

      const canvas = canvasRef.current;
      const canvasRect = canvas.getBoundingClientRect();
      const scrollLeft = canvas.scrollLeft;
      const scrollTop = canvas.scrollTop;
      
      const mouseX = (e.clientX - canvasRect.left + scrollLeft) / zoomLevel;
      const mouseY = (e.clientY - canvasRect.top + scrollTop) / zoomLevel;
      
      const newX = mouseX - dragOffset.x;
      const newY = mouseY - dragOffset.y;

      setPaints((prev) =>
        prev.map((p) =>
          p.id === draggingPaint
            ? { ...p, x: Math.max(0, newX), y: Math.max(0, newY) }
            : p
        )
      );
    },
    [draggingPaint, dragOffset, zoomLevel, isPanning, panStart, panOffset]
  );

  const handleMouseUp = useCallback(() => {
    setDraggingPaint(null);
    setIsPanning(false);
  }, []);

  const handleCanvasMouseDown = (e: React.MouseEvent) => {
    // Middle mouse button (wheel button) for panning
    if (e.button === 1) {
      e.preventDefault();
      setIsPanning(true);
      setPanStart({ x: e.clientX, y: e.clientY });
      if (canvasRef.current) {
        setPanOffset({
          x: canvasRef.current.scrollLeft,
          y: canvasRef.current.scrollTop,
        });
      }
      return;
    }

    // Left click on empty area - deselect
    if (e.button === 0) {
      const target = e.target as HTMLElement;
      // Check if clicked on canvas background (not on a paint card)
      if (target.hasAttribute('data-canvas-bg') || target.closest('[data-canvas-bg]')) {
        setSelectedPaint(null);
        setEditingPaint(null);
        setSelectedCluster(null);
        setCombineMode(false);
        setCombineSelection([]);
        setIsMediaCreationSession(false);
      }
    }
  };

  useEffect(() => {
    if (draggingPaint || isPanning) {
      window.addEventListener("mousemove", handleMouseMove);
      window.addEventListener("mouseup", handleMouseUp);
      return () => {
        window.removeEventListener("mousemove", handleMouseMove);
        window.removeEventListener("mouseup", handleMouseUp);
      };
    }
  }, [draggingPaint, isPanning, handleMouseMove, handleMouseUp]);

  const handleTidy = () => {
    const clustered = allClusters.map((cluster) => ({
      cluster,
      paints: paints.filter((p) => p.cluster === cluster.id && (!p.derivedFrom || p.derivedFrom.length === 0)),
    }));

    let currentX = 100;
    const newPaints = [...paints];

    clustered.forEach(({ cluster, paints: clusterPaints }) => {
      if (clusterPaints.length === 0) return;

      const cols = Math.ceil(Math.sqrt(clusterPaints.length));
      
      clusterPaints.forEach((paint, idx) => {
        const col = idx % cols;
        const row = Math.floor(idx / cols);
        
        const paintObj = newPaints.find((p) => p.id === paint.id);
        if (paintObj) {
          paintObj.x = currentX + col * 300;
          paintObj.y = 100 + row * 250;
        }
      });

      currentX += cols * 300 + 100;
    });

    setPaints(newPaints);
  };
  const handleCombineWithSuggestion = async (suggestion: CombineSuggestion) => {
    if (combineSelection.length < 2) return;

    const selectedPaints = paints.filter((p) => combineSelection.includes(p.id));
    const paint1 = selectedPaints[0];
    const paint2 = selectedPaints[1];

    setCombineMethodSelected(true);

    const typeText = suggestion.type === "image" ? "이미지" : "핵심 장면 이미지";
    const confirmMsg: AgentMessage = {
      id: generateMessageId(),
      role: "assistant",
      content: `"${paint1.title}"과(와) "${paint2.title}"을(를) ${typeText}로 합성합니다...`,
    };
    setExploreMessages((prev) => [...prev, confirmMsg]);

    try {
      const prompt =
        suggestion.type === "video"
          ? `Cinematic keyframe combining two creative concepts: "${paint1.title}" (${paint1.content}) and "${paint2.title}" (${paint2.content}). Style: film still, cinematic lighting, evocative.`
          : `Creative artwork combining "${paint1.title}" (${paint1.content}) with "${paint2.title}" (${paint2.content}). Style: artistic, evocative, visually striking.`;
      const imageUrl = await generateImage(prompt);

      const resultMsg: AgentMessage = {
        id: generateMessageId(),
        role: "assistant",
        content: suggestion.type === "video" ? "핵심 장면 이미지입니다 (동영상 생성 추후 지원):" : "생성된 이미지입니다:",
        imageUrl,
        paintData: {
          title: `${paint1.title} × ${paint2.title}`,
          type: suggestion.type,
          content: `"${paint1.title}"와 "${paint2.title}"를 결합한 결과물`,
          source: "ai" as const,
          tags: ["combined"],
          cluster: selectedPaints[0].cluster,
          imageUrl,
          derivedFrom: combineSelection,
        },
      };
      setExploreMessages((prev) => [...prev, resultMsg]);
    } catch {
      setExploreMessages((prev) => [
        ...prev,
        { id: generateMessageId(), role: "assistant", content: "이미지 생성에 실패했습니다. 다시 시도해주세요." },
      ]);
    }
  };

  const handleExploreSend = async () => {
    if (!exploreInput.trim()) return;

    // Combine 모드일 때
    if (combineMode && combineSelection.length >= 2) {
      const selectedPaints = paints.filter((p) => combineSelection.includes(p.id));
      const paint1 = selectedPaints[0];
      const paint2 = selectedPaints[1];
      
      const userMsg: AgentMessage = {
        id: generateMessageId(),
        role: "user",
        content: exploreInput,
      };
      
      setExploreMessages((prev) => [...prev, userMsg]);
      const userInput = exploreInput;
      setExploreInput("");
      
      // 이미지/비디오를 이미 선택한 경우: 피드백을 반영한 새 이미지/비디오 생성
      if (combineMethodSelected) {
        // 마지막 생성된 결과물의 타입 확인
        const lastResultMsg = exploreMessages
          .slice()
          .reverse()
          .find((msg) => msg.paintData && (msg.paintData.type === "image" || msg.paintData.type === "video"));
        
        if (lastResultMsg && lastResultMsg.paintData) {
          const resultType = lastResultMsg.paintData.type;
          
          setTimeout(() => {
            const loadingMsg: AgentMessage = {
              id: generateMessageId(),
              role: "assistant",
              content: "피드백을 반영해서 새로운 결과물을 생성하겠습니다...",
            };
            setExploreMessages((prev) => [...prev, loadingMsg]);
          }, 500);
          
          setTimeout(() => {
            const mockImages = [
              "https://images.unsplash.com/photo-1518709268805-4e9042af9f23?w=800",
              "https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=800",
              "https://images.unsplash.com/photo-1469474968028-56623f02e42e?w=800",
              "https://images.unsplash.com/photo-1501594907352-04cda38ebc29?w=800",
            ];
            const randomImage = mockImages[Math.floor(Math.random() * mockImages.length)];
            
            const updatedResultMsg: AgentMessage = {
              id: generateMessageId(),
              role: "assistant",
              content: "업데이트된 결과물입니다:",
              imageUrl: randomImage,
              paintData: {
                title: `${paint1.title} × ${paint2.title}`,
                type: resultType,
                content: `"${paint1.title}"과(와) "${paint2.title}"의 조합 - 수정 사항: ${userInput}`,
                source: "ai" as const,
                tags: ["combined", "updated"],
                cluster: selectedPaints[0].cluster,
                imageUrl: resultType === "image" ? randomImage : undefined,
                videoUrl: resultType === "video" ? randomImage : undefined,
                derivedFrom: combineSelection,
              },
            };
            
            setExploreMessages((prev) => [...prev, updatedResultMsg]);
          }, 2000);
          
          return;
        }
        
        // fallback: 일반 대화
        setTimeout(() => {
          const assistantMsg: AgentMessage = {
            id: generateMessageId(),
            role: "assistant",
            content: "좋은 생각이네요! 그 부분을 더 발전시켜봅시다.",
          };
          setExploreMessages((prev) => [...prev, assistantMsg]);
        }, 800);
        return;
      }
      
      // 처음 채팅으로 조합하는 경우
      setCombineMethodSelected(true);
      
      setTimeout(() => {
        const resultMsg: AgentMessage = {
          id: generateMessageId(),
          role: "assistant",
          content: "그건 흥미로운 생각이네요. 우선 그렇게 조합 아이디어를 페인트로 추가해볼게요.",
          paintData: {
            title: `${paint1.title} × ${paint2.title}`,
            type: "text" as const,
            content: userInput,
            source: "ai" as const,
            tags: ["combined"],
            cluster: selectedPaints[0].cluster,
            derivedFrom: combineSelection,
          },
        };
        
        setExploreMessages((prev) => [...prev, resultMsg]);
      }, 1000);
      
      return;
    }

    // 단일 페인트 탐색 모드
    if (!selectedPaint) return;
    const paint = paints.find((p) => p.id === selectedPaint);
    if (!paint) return;

    const userMsg: AgentMessage = {
      id: generateMessageId(),
      role: "user",
      content: exploreInput,
    };

    setExploreMessages((prev) => [...prev, userMsg]);
    const userInput = exploreInput;
    setExploreInput("");

    // 미디어 생성 모드인 경우
    if (mediaCreationMode) {
      const mediaType = mediaCreationMode === "image" ? "이미지" : "비디오";
      const loadingMsg: AgentMessage = {
        id: generateMessageId(),
        role: "assistant",
        content: `"${userInput}"을(를) 기반으로 ${mediaType}를 생성하겠습니다...`,
      };
      setExploreMessages((prev) => [...prev, loadingMsg]);

      setTimeout(() => {
        const mockUrl = mediaCreationMode === "image" 
          ? "https://images.unsplash.com/photo-1546380841-bf3afc314a5d?w=800"
          : "https://images.unsplash.com/photo-1536440136628-849c177e76a1?w=800";
        
        const resultMsg: AgentMessage = {
          id: generateMessageId(),
          role: "assistant",
          content: `생성된 ${mediaType}입니다:`,
          imageUrl: mockUrl,
          paintData: {
            title: mediaCreationMode === "image" ? `새 이미지: ${paint.title}` : `새 비디오: ${paint.title}`,
            type: mediaCreationMode,
            content: userInput,
            source: "ai" as const,
            tags: [...paint.tags, "generated"],
            cluster: paint.cluster,
            imageUrl: mediaCreationMode === "image" ? mockUrl : undefined,
            videoUrl: mediaCreationMode === "video" ? mockUrl : undefined,
          },
        };
        setExploreMessages((prev) => [...prev, resultMsg]);
        setMediaCreationMode(null);
      }, 1500);
      return;
    }

    // 일반 대화 - 모든 타입에서 동일하게 동작
    setTimeout(() => {
      const assistantMsg: AgentMessage = {
        id: generateMessageId(),
        role: "assistant",
        content: "흥미로운 관점이네요! 그 아이디어를 확장해보겠습니다...",
      };
      setExploreMessages((prev) => [...prev, assistantMsg]);
    }, 500);
  };

  const handleSnapshot = () => {
    console.log("Snapshot taken");
  };

  const handleDeletePaint = (paintId: string) => {
    const paintToDelete = paints.find((p) => p.id === paintId);
    if (paintToDelete) {
      setDeletedPaints([...deletedPaints, paintToDelete]);
      setPaints(paints.filter((p) => p.id !== paintId));
      setSelectedPaint(null);
    }
  };

  const handleRestorePaint = (paintId: string) => {
    const paintToRestore = deletedPaints.find((p) => p.id === paintId);
    if (paintToRestore) {
      setPaints([...paints, paintToRestore]);
      setDeletedPaints(deletedPaints.filter((p) => p.id !== paintId));
    }
  };

  const handleStartCombine = () => {
    if (!selectedPaint) return;
    setCombineMode(true);
    setCombineSelection([selectedPaint]);
  };

  const handleMakeNewImage = async () => {
    if (!selectedPaint) return;
    const paint = paints.find((p) => p.id === selectedPaint);
    if (!paint) return;

    setMediaCreationMode("image");
    setIsMediaCreationSession(true);

    if (paint.type === "text") {
      // 텍스트 카드 -> DALL-E 3 이미지 생성
      const loadingMsg: AgentMessage = {
        id: generateMessageId(),
        role: "assistant",
        content: `"${paint.title}"을(를) 기반으로 이미지를 생성하겠습니다...`,
      };
      setExploreMessages((prev) => [...prev, loadingMsg]);

      try {
        const prompt = `Creative visual artwork inspired by: "${paint.title}". ${paint.content}. Style: cinematic, evocative, artistic illustration.`;
        const imageUrl = await generateImage(prompt);
        const imageMsg: AgentMessage = {
          id: generateMessageId(),
          role: "assistant",
          content: "생성된 이미지입니다:",
          imageUrl,
          paintData: {
            title: `시각화: ${paint.title}`,
            type: "image" as const,
            content: paint.content,
            source: "ai" as const,
            tags: [...paint.tags, "generated"],
            cluster: "visual-tone",
            imageUrl,
          },
        };
        setExploreMessages((prev) => [...prev, imageMsg]);
        setMediaCreationMode(null);
      } catch {
        setExploreMessages((prev) => [
          ...prev,
          { id: generateMessageId(), role: "assistant", content: "이미지 생성에 실패했습니다. 다시 시도해주세요." },
        ]);
        setMediaCreationMode(null);
      }
    } else if (paint.type === "image") {
      // 이미지 카드 -> 수정 프롬프트 요청
      const aiMsg: AgentMessage = {
        id: generateMessageId(),
        role: "assistant",
        content: `이 이미지를 어떻게 수정하시겠습니까? 원하시는 변경 사항을 설명해주세요.`,
      };
      setExploreMessages((prev) => [...prev, aiMsg]);
    } else if (paint.type === "video") {
      // 비디오 카드에서 이미지 만들기 -> 이미지 생성 프롬프트
      const aiMsg: AgentMessage = {
        id: generateMessageId(),
        role: "assistant",
        content: `이 비디오를 기반으로 어떤 이미지를 만들고 싶으신가요?`,
      };
      setExploreMessages((prev) => [...prev, aiMsg]);
    }
  };

  const handleMakeNewVideo = async () => {
    if (!selectedPaint) return;
    const paint = paints.find((p) => p.id === selectedPaint);
    if (!paint) return;

    setMediaCreationMode("video");
    setIsMediaCreationSession(true);

    if (paint.type === "text") {
      // 텍스트 카드 -> DALL-E로 키프레임 이미지 생성 (동영상 생성 API 미연동)
      const loadingMsg: AgentMessage = {
        id: generateMessageId(),
        role: "assistant",
        content: `"${paint.title}"의 핵심 장면을 이미지로 먼저 시각화합니다...`,
      };
      setExploreMessages((prev) => [...prev, loadingMsg]);

      try {
        const prompt = `Cinematic keyframe still for a video concept: "${paint.title}". ${paint.content}. Style: cinematic photography, film still, high production value.`;
        const imageUrl = await generateImage(prompt);
        const videoMsg: AgentMessage = {
          id: generateMessageId(),
          role: "assistant",
          content: "핵심 장면 이미지입니다. (동영상 생성은 추후 지원 예정)",
          imageUrl,
          paintData: {
            title: `영상화: ${paint.title}`,
            type: "video" as const,
            content: paint.content,
            source: "ai" as const,
            tags: [...paint.tags, "generated"],
            cluster: "visual-tone",
            imageUrl,
          },
        };
        setExploreMessages((prev) => [...prev, videoMsg]);
        setMediaCreationMode(null);
      } catch {
        setExploreMessages((prev) => [
          ...prev,
          { id: generateMessageId(), role: "assistant", content: "이미지 생성에 실패했습니다. 다시 시도해주세요." },
        ]);
        setMediaCreationMode(null);
      }
    } else if (paint.type === "video") {
      // 비디오 카드 -> 수정 프롬프트 요청
      const aiMsg: AgentMessage = {
        id: generateMessageId(),
        role: "assistant",
        content: `이 비디오를 어떻게 수정하시겠습니까? 원하시는 변경 사항을 설명해주세요.`,
      };
      setExploreMessages((prev) => [...prev, aiMsg]);
    } else if (paint.type === "image") {
      // 이미지 카드에서 비디오 만들기 -> 비디오 생성 프롬프트
      const aiMsg: AgentMessage = {
        id: generateMessageId(),
        role: "assistant",
        content: `이 이미지를 기반으로 어떤 비디오를 만들고 싶으신가요?`,
      };
      setExploreMessages((prev) => [...prev, aiMsg]);
    }
  };

  const handleAddGeneratedToPalette = (msg: AgentMessage) => {
    if (!msg.paintData) return;
    
    // Combine 모드일 때
    if (combineMode && msg.paintData.derivedFrom) {
      // 첫 번째 부모 카드 위치 찾기
      const firstParentId = msg.paintData.derivedFrom[0];
      const firstParent = paints.find(p => p.id === firstParentId);
      
      const newPaint: Paint = {
        id: `p${Date.now()}`,
        title: msg.paintData.title || "Combined Paint",
        type: msg.paintData.type || "text",
        content: msg.paintData.content || "",
        source: "ai",
        tags: msg.paintData.tags || ["combined"],
        timestamp: new Date().toISOString(),
        cluster: msg.paintData.cluster || "visual-tone",
        imageUrl: msg.imageUrl,
        videoUrl: msg.paintData.videoUrl,
        derivedFrom: msg.paintData.derivedFrom,
        x: firstParent ? firstParent.x : 1000,
        y: firstParent ? firstParent.y + 250 : 700,
      };

      setPaints([...paints, newPaint]);
      setCombineMode(false);
      setCombineSelection([]);
      return;
    }
    
    // 단일 페인트 탐색 모드
    if (!selectedPaint) return;
    const sourcePaint = paints.find((p) => p.id === selectedPaint);
    if (!sourcePaint) return;

    // 이미지 카드인 경우: 기존 카드의 이미지만 업데이트
    if (sourcePaint.type === "image" && msg.paintData.type === "image") {
      setPaints((prev) =>
        prev.map((p) =>
          p.id === selectedPaint
            ? { ...p, imageUrl: msg.imageUrl }
            : p
        )
      );
    } 
    // 비디오 카드인 경우: 기존 카드의 비디오만 업데이트
    else if (sourcePaint.type === "video" && msg.paintData.type === "video") {
      setPaints((prev) =>
        prev.map((p) =>
          p.id === selectedPaint
            ? { ...p, videoUrl: msg.paintData.videoUrl, imageUrl: msg.imageUrl }
            : p
        )
      );
    } 
    else {
      // 다른 타입으로 변환되는 경우: 새로운 카드 생성
      const newPaint: Paint = {
        id: `p${Date.now()}`,
        title: msg.paintData.title || "Generated Media",
        type: msg.paintData.type || "image",
        content: msg.paintData.content || "",
        source: "ai",
        tags: msg.paintData.tags || ["generated"],
        timestamp: new Date().toISOString(),
        cluster: msg.paintData.cluster || "visual-tone",
        imageUrl: msg.imageUrl,
        videoUrl: msg.paintData.videoUrl,
        derivedFrom: [selectedPaint],
        x: sourcePaint.x,
        y: sourcePaint.y + 250,
      };

      setPaints([...paints, newPaint]);
    }
  };

  // 새 클러스터 생성
  const handleCreateNewCluster = () => {
    if (!newClusterName.trim()) return;
    
    const newClusterId = `custom-${Date.now()}`;
    const newCluster: PaletteCluster = {
      id: newClusterId,
      label: newClusterName,
      color: newClusterColor,
      description: "",
      isUserCreated: true,
    };
    
    // 새 클러스터에 빈 페인트 하나 추가
    const newPaint: Paint = {
      id: `p${Date.now()}`,
      title: "새 페인트",
      type: "text",
      content: "",
      source: "user",
      tags: [],
      timestamp: new Date().toISOString(),
      cluster: newClusterId,
      x: 200,
      y: 200,
    };
    
    setUserClusters([...userClusters, newCluster]);
    setPaints([...paints, newPaint]);
    setNewClusterName("");
    setNewClusterColor("violet");
    setShowNewClusterDialog(false);
    setShowAddMenu(false);
    setSelectedPaint(newPaint.id);
    setEditingPaint(newPaint.id);
  };

  // 새 빈 페인트 생성
  const handleCreateNewPaint = () => {
    const newPaint: Paint = {
      id: `p${Date.now()}`,
      title: "새 페인트",
      type: "text",
      content: "",
      source: "user",
      tags: [],
      timestamp: new Date().toISOString(),
      x: 200,
      y: 200,
    };
    
    setPaints([...paints, newPaint]);
    setShowAddMenu(false);
    setSelectedPaint(newPaint.id);
    setEditingPaint(newPaint.id);
  };
  
  // 클러스터에 페인트 추가
  const handleOpenAddToCluster = (clusterId: string) => {
    setTargetClusterId(clusterId);
    setAddToClusterDialogOpen(true);
  };
  
  const handleAddPaintToCluster = (paintId: string) => {
    if (!targetClusterId) return;
    
    setPaints((prev) =>
      prev.map((p) =>
        p.id === paintId ? { ...p, cluster: targetClusterId } : p
      )
    );
    
    setAddToClusterDialogOpen(false);
    setTargetClusterId(null);
  };

  // 클러스터 선택
  const handleClusterClick = (clusterId: string) => {
    // 이미 선택된 클러스터를 다시 클릭하면 선택 해제
    if (selectedCluster === clusterId) {
      setSelectedCluster(null);
    } else {
      setSelectedCluster(clusterId);
      setSelectedPaint(null);
      setCombineMode(false);
      setCombineSelection([]);
      setIsMediaCreationSession(false);
    }
  };

  // 클러스터 이름 수정 (모든 클러스터 가능)
  const handleClusterUpdate = (clusterId: string, newLabel: string) => {
    // 기본 클러스터인지 확인
    const isBaseCluster = baseClusters.some(c => c.id === clusterId);
    
    if (isBaseCluster) {
      setBaseClusters(prev =>
        prev.map(c => c.id === clusterId ? { ...c, label: newLabel } : c)
      );
    } else {
      setUserClusters(prev =>
        prev.map(c => c.id === clusterId ? { ...c, label: newLabel } : c)
      );
    }
  };

  // 클러스터 삭제 (모든 클러스터 삭제 가능)
  const handleDeleteCluster = (clusterId: string) => {
    const cluster = allClusters.find(c => c.id === clusterId);
    if (!cluster) return;
    
    // 클러스터에 속한 페인트들의 cluster 속성 제거
    setPaints(prev =>
      prev.map(p => p.cluster === clusterId ? { ...p, cluster: undefined } : p)
    );
    
    // 기본 클러스터인지 확인하여 적절한 상태 업데이트
    const isBaseCluster = baseClusters.some(c => c.id === clusterId);
    if (isBaseCluster) {
      setBaseClusters(prev => prev.filter(c => c.id !== clusterId));
    } else {
      setUserClusters(prev => prev.filter(c => c.id !== clusterId));
    }
    
    setSelectedCluster(null);
  };

  const selectedPaintData = selectedPaint ? paints.find((p) => p.id === selectedPaint) : null;
  const selectedClusterData = selectedCluster ? allClusters.find((c) => c.id === selectedCluster) : null;

  return (
    <div className="flex h-screen bg-gray-50">
      {/* Main Canvas Area */}
      <div className="flex-1 flex flex-col">
        {/* Top Bar */}
        <div className="h-16 bg-white border-b border-gray-200 flex items-center justify-between px-6 shrink-0">
          <div className="flex items-center gap-3">
            <h1 className="text-lg text-gray-900">Palette</h1>
          </div>

          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => setShowTrashModal(true)} className="gap-2">
              <Trash2 className="w-4 h-4" />
              휴지통
            </Button>
            <div className="w-px h-6 bg-gray-200" />
            <Button variant="outline" size="sm" onClick={handleTidy} className="gap-2">
              <LayoutGrid className="w-4 h-4" />
              정리
            </Button>
            <div className="w-px h-6 bg-gray-200" />
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setZoomLevel(Math.max(0.5, zoomLevel - 0.1))}
            >
              <ZoomOut className="w-4 h-4" />
            </Button>
            <span className="text-xs text-gray-500 w-12 text-center">
              {Math.round(zoomLevel * 100)}%
            </span>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setZoomLevel(Math.min(2, zoomLevel + 0.1))}
            >
              <ZoomIn className="w-4 h-4" />
            </Button>
            <Button variant="ghost" size="sm" onClick={() => setZoomLevel(1)}>
              <Maximize2 className="w-4 h-4" />
            </Button>
            <div className="w-px h-6 bg-gray-200" />
            <Button 
              variant="outline" 
              size="sm" 
              onClick={() => navigate("/export")} 
              className="gap-2"
            >
              <Download className="w-4 h-4" />
              Export
            </Button>
          </div>
        </div>

        {/* Canvas */}
        <div className="flex-1 relative overflow-hidden">
          <div
            ref={canvasRef}
            className="absolute inset-0 overflow-auto"
            style={{
              cursor: draggingPaint ? "grabbing" : isPanning ? "grabbing" : "default",
            }}
            onMouseDown={handleCanvasMouseDown}
            data-canvas-bg
          >
            <div
              className="relative"
              data-canvas-bg
              style={{
                width: "2400px",
                height: "1600px",
                transform: `scale(${zoomLevel})`,
                transformOrigin: "0 0",
              }}
            >
              {/* Cluster Background Regions */}
              {clusterRegions().map((region) => {
                const cluster = allClusters.find((c) => c.id === region.clusterId);
                if (!cluster) return null;

                return (
                  <div
                    key={region.clusterId}
                    className="absolute rounded-3xl border-2 border-dashed transition-all pointer-events-none"
                    style={{
                      left: region.centerX - region.width / 2,
                      top: region.centerY - region.height / 2,
                      width: region.width,
                      height: region.height,
                      backgroundColor:
                        cluster.color === "emerald"
                          ? "rgba(16, 185, 129, 0.05)"
                          : cluster.color === "amber"
                          ? "rgba(251, 191, 36, 0.05)"
                          : cluster.color === "blue"
                          ? "rgba(59, 130, 246, 0.05)"
                          : cluster.color === "rose"
                          ? "rgba(251, 113, 133, 0.05)"
                          : "rgba(139, 92, 246, 0.05)",
                      borderColor:
                        cluster.color === "emerald"
                          ? "rgba(16, 185, 129, 0.2)"
                          : cluster.color === "amber"
                          ? "rgba(251, 191, 36, 0.2)"
                          : cluster.color === "blue"
                          ? "rgba(59, 130, 246, 0.2)"
                          : cluster.color === "rose"
                          ? "rgba(251, 113, 133, 0.2)"
                          : "rgba(139, 92, 246, 0.2)",
                    }}
                  >
                    <div 
                      className={`absolute -top-3 left-4 flex items-center gap-2 bg-white px-3 py-1 rounded-full border transition-colors pointer-events-auto ${
                        selectedCluster === cluster.id ? 'border-blue-400 ring-2 ring-blue-200' : 'border-gray-200'
                      }`}
                      onClick={(e) => {
                        e.stopPropagation();
                        handleClusterClick(cluster.id);
                      }}
                      onDoubleClick={(e) => {
                        e.stopPropagation();
                        setEditingCluster(cluster.id);
                      }}
                    >
                      <div className={`w-2 h-2 rounded-full ${CLUSTER_DOT[cluster.color]}`} />
                      {editingCluster === cluster.id ? (
                        <input
                          type="text"
                          defaultValue={cluster.label}
                          className="text-xs text-gray-900 bg-transparent border-none outline-none w-24"
                          autoFocus
                          onBlur={(e) => {
                            handleClusterUpdate(cluster.id, e.target.value);
                            setEditingCluster(null);
                          }}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              handleClusterUpdate(cluster.id, e.currentTarget.value);
                              setEditingCluster(null);
                            }
                            if (e.key === 'Escape') {
                              setEditingCluster(null);
                            }
                          }}
                          onClick={(e) => e.stopPropagation()}
                        />
                      ) : (
                        <span className="text-xs text-gray-600 cursor-pointer">{cluster.label}</span>
                      )}
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleOpenAddToCluster(cluster.id);
                        }}
                        className="ml-1 w-4 h-4 rounded-full bg-gray-100 hover:bg-gray-200 transition-colors flex items-center justify-center"
                        title="페인트 추가"
                      >
                        <Plus className="w-3 h-3 text-gray-600" />
                      </button>
                    </div>
                  </div>
                );
              })}

              {/* Lineage Lines */}
              {paints
                .filter((p) => p.derivedFrom && p.derivedFrom.length > 0)
                .map((paint) => {
                  if (!paint.x || !paint.y || !paint.derivedFrom) return null;

                  return paint.derivedFrom.map((parentId) => {
                    const parent = paints.find((p) => p.id === parentId);
                    if (!parent || !parent.x || !parent.y) return null;

                    return (
                      <svg
                        key={`${paint.id}-${parentId}`}
                        className="absolute inset-0 pointer-events-none"
                        style={{ width: "2400px", height: "1600px" }}
                      >
                        <line
                          x1={parent.x + 130}
                          y1={parent.y + 90}
                          x2={paint.x + 130}
                          y2={paint.y + 90}
                          stroke="#93c5fd"
                          strokeWidth="2"
                          strokeDasharray="4 4"
                          opacity="0.4"
                        />
                      </svg>
                    );
                  });
                })}

              {/* Paint Cards */}
              {paints.map((paint) => {
                if (paint.x === undefined || paint.y === undefined) return null;

                return (
                  <div
                    key={paint.id}
                    className="absolute cursor-grab active:cursor-grabbing"
                    style={{
                      left: paint.x,
                      top: paint.y,
                      transition: draggingPaint === paint.id ? "none" : "all 0.2s ease",
                      zIndex: draggingPaint === paint.id ? 1000 : 1,
                    }}
                    onMouseDown={(e) => handleMouseDown(paint.id, e)}
                    onDoubleClick={() => handlePaintDoubleClick(paint.id)}
                  >
                    {paint.paintKind && (
                      <div className="absolute -top-2.5 left-3 z-10 flex gap-1">
                        <span className={`text-[9px] px-1.5 py-0.5 rounded-full font-medium border ${
                          paint.paintKind === "explicit"
                            ? "bg-blue-50 text-blue-600 border-blue-200"
                            : paint.paintKind === "implicit"
                            ? "bg-violet-50 text-violet-600 border-violet-200"
                            : "bg-amber-50 text-amber-600 border-amber-200"
                        }`}>
                          {paint.paintKind === "explicit" ? "명시" : paint.paintKind === "implicit" ? "묵시" : "브릿지"}
                        </span>
                      </div>
                    )}
                    <PaintCard
                      paint={paint}
                      size="medium"
                      isSelected={selectedPaint === paint.id}
                      isDragging={draggingPaint === paint.id}
                      isCombineTarget={combineSelection.includes(paint.id)}
                      onClick={() => setSelectedPaint(paint.id)}
                      isEditing={editingPaint === paint.id}
                      onUpdate={handlePaintUpdate}
                    />
                  </div>
                );
              })}
            </div>
          </div>
          {/* Floating Add Button - Above Snapshot */}
          <div className="absolute bottom-24 right-6 z-50">
            <Button 
              variant="default" 
              size="icon"
              onClick={() => setShowAddMenu(!showAddMenu)} 
              className="w-12 h-12 rounded-full shadow-lg"
            >
              <Plus className="w-5 h-5" />
            </Button>
            
            {/* Add Menu */}
            {showAddMenu && (
              <div className="absolute bottom-full right-0 mb-2 bg-white rounded-xl shadow-lg border border-gray-200 p-2 w-48">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setShowNewClusterDialog(true);
                    setShowAddMenu(false);
                  }}
                  className="w-full justify-start gap-2 mb-1"
                >
                  <FolderPlus className="w-4 h-4" />
                  새 페인트 묶음
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleCreateNewPaint}
                  className="w-full justify-start gap-2"
                >
                  <FilePlus className="w-4 h-4" />
                  새 페인트
                </Button>
              </div>
            )}
          </div>
          
          {/* Snapshot Button - Fixed at bottom right */}
          <Button 
            variant="default" 
            size="sm" 
            onClick={handleSnapshot} 
            className="absolute bottom-6 right-6 gap-2 shadow-lg z-50"
          >
            <Camera className="w-4 h-4" />
            스냅샷
          </Button>
        </div>
      </div>

      {/* Agent Chat Panel */}
      <div
        className={`bg-white border-l border-gray-200 flex flex-col overflow-hidden ${
          agentOpen ? "w-96" : "w-0"
        } shrink-0`}
      >
        {agentOpen && (
          <>
            <div className="h-16 border-b border-gray-200 flex items-center justify-between px-4 shrink-0">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-400 to-purple-400 flex items-center justify-center">
                  <Sparkles className="w-4 h-4 text-white" />
                </div>
                <div>
                  <div className="text-sm text-gray-900">
                    {combineMode ? "조합 제안" : selectedClusterData ? "페인트 묶음" : selectedPaintData ? "탐색" : "팔레트 에이전트"}
                  </div>
                  <div className="text-xs text-gray-500">
                    {combineMode && combineSelection.length >= 2
                      ? `${combineSelection.length}개 페인트 선택됨`
                      : selectedClusterData
                      ? selectedClusterData.label
                      : selectedPaintData
                      ? "재료를 더 깊이 탐구하세요"
                      : "탐색할 페인트를 선택하세요"}
                  </div>
                </div>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setAgentOpen(false)}
              >
                <ChevronRight className="w-4 h-4" />
              </Button>
            </div>

            <div className="flex-1 overflow-y-auto overflow-x-hidden p-4">
              <div className="space-y-4">
                {combineMode && combineSuggestions.length > 0 ? (
                  /* Combine Suggestions Panel */
                  <div className="space-y-3">
                    {/* Conversation Messages */}
                    <div className="space-y-3">
                      {exploreMessages.map((msg) => (
                        <div
                          key={msg.id}
                          className={`flex ${
                            msg.role === "user" ? "justify-end" : "justify-start"
                          }`}
                        >
                          {msg.role === "assistant" && (msg.imageUrl || msg.paintData) ? (
                            /* Generated Result Message */
                            <div className="max-w-[85%] rounded-xl overflow-hidden bg-gray-100">
                              <div className="p-3">
                                <p className="text-sm text-gray-900 mb-2">{msg.content}</p>
                              </div>
                              {msg.imageUrl && (
                                <img
                                  src={msg.imageUrl}
                                  alt="Generated"
                                  className="w-full h-48 object-cover"
                                />
                              )}
                              {msg.paintData && msg.paintData.derivedFrom && msg.paintData.derivedFrom.length > 0 && (
                                <div className="p-3">
                                  <Button
                                    size="sm"
                                    onClick={() => handleAddGeneratedToPalette(msg)}
                                    className="w-full gap-2"
                                  >
                                    <Plus className="w-4 h-4" />
                                    연결 페인트로 추가하기
                                  </Button>
                                </div>
                              )}
                            </div>
                          ) : (
                            /* Regular Text Message */
                            <div className="max-w-[85%]">
                              <div
                                className={`rounded-xl px-3 py-2 ${
                                  msg.role === "user"
                                    ? "bg-blue-500 text-white"
                                    : "bg-gray-100 text-gray-900"
                                }`}
                              >
                                <p className="text-sm">{msg.content}</p>
                              </div>
                              {msg.role === "assistant" && (
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  disabled={extractingMsgId === msg.id}
                                  onClick={async () => {
                                    setExtractingMsgId(msg.id);
                                    try {
                                      const { label, description } = await extractPaintMeta(msg.content);
                                      const sourceId = combineSelection[0];
                                      const sourcePaint = paints.find(p => p.id === sourceId);
                                      const newPaint: Paint = {
                                        id: `p${Date.now()}`,
                                        title: label,
                                        type: "text",
                                        content: description,
                                        source: "ai",
                                        tags: ["bridge"],
                                        paintKind: "bridge",
                                        timestamp: new Date().toISOString(),
                                        cluster: sourcePaint?.cluster || "visual-tone",
                                        derivedFrom: [...combineSelection],
                                        x: sourcePaint ? sourcePaint.x! + 320 : 1000,
                                        y: sourcePaint?.y ?? 600,
                                      };
                                      setPaints((prev) => [...prev, newPaint]);
                                    } finally {
                                      setExtractingMsgId(null);
                                    }
                                  }}
                                  className="mt-1.5 w-full gap-2 text-xs h-7 text-gray-500 hover:text-gray-800"
                                >
                                  {extractingMsgId === msg.id ? (
                                    <><span className="w-3 h-3 border border-gray-400 border-t-transparent rounded-full animate-spin inline-block" />추출 중...</>
                                  ) : (
                                    <><Plus className="w-3 h-3" />텍스트 페인트로 추가</>
                                  )}
                                </Button>
                              )}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>

                    {/* Suggestion Buttons - 이미지/비디오 선택 또는 채팅 전송 전에만 표시 */}
                    {!combineMethodSelected && (
                      <div className="pt-2 border-t border-gray-200">
                        <p className="text-xs text-gray-500 mb-3">혹은 예상 결과물을 만들어볼 수 있어요</p>
                        <div className="flex flex-col gap-2">
                          {combineSuggestions.map((suggestion) => (
                            <Button
                              key={suggestion.id}
                              variant="outline"
                              size="sm"
                              onClick={() => handleCombineWithSuggestion(suggestion)}
                              className="w-full justify-start gap-2"
                            >
                              <ImagePlus className="w-4 h-4" />
                              {suggestion.title}
                            </Button>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                ) : selectedClusterData ? (
                  /* Cluster Panel */
                  <div className="space-y-4">
                    {/* Cluster Info */}
                    <div className="p-4 rounded-xl bg-gray-50 border border-gray-200">
                      <div className="flex items-center gap-3 mb-2">
                        <div className={`w-3 h-3 rounded-full ${CLUSTER_DOT[selectedClusterData.color]}`} />
                        <h3 className="text-sm font-medium text-gray-900">{selectedClusterData.label}</h3>
                      </div>
                      <p className="text-xs text-gray-500">
                        {paints.filter(p => p.cluster === selectedCluster).length}개의 페인트
                      </p>
                    </div>

                    {/* Quick Actions */}
                    {selectedClusterData.isUserCreated && (
                      <div className="space-y-2">
                        <p className="text-xs text-gray-500 uppercase tracking-wide">작업</p>
                        <div className="flex flex-col gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleDeleteCluster(selectedCluster!)}
                            className="w-full justify-start gap-2 text-red-600 hover:text-red-700"
                          >
                            <Trash2 className="w-4 h-4" />
                            페인트 묶음 삭제
                          </Button>
                        </div>
                      </div>
                    )}
                  </div>
                ) : selectedPaintData ? (
                  /* Explore Panel */
                  <div className="space-y-4">
                    {/* Selected Paint Info */}
                    <div className="p-3 rounded-xl bg-gray-50 border border-gray-200 space-y-2">
                      <PaintCard paint={selectedPaintData} size="compact" />
                      <Button
                        variant="outline"
                        size="sm"
                        className="w-full justify-start gap-2 text-blue-600 border-blue-200 hover:bg-blue-50"
                        onClick={() => {
                          const src = selectedPaintData;
                          const newPaint: Paint = {
                            ...src,
                            id: `p${Date.now()}`,
                            timestamp: new Date().toISOString(),
                            derivedFrom: [src.id],
                            x: (src.x ?? 300) + 320,
                            y: src.y ?? 200,
                          };
                          setPaints((prev) => [...prev, newPaint]);
                        }}
                      >
                        <Plus className="w-4 h-4" />
                        캔버스에 추가
                      </Button>
                    </div>

                    {/* Quick Actions */}
                    <div className="space-y-2">
                      <p className="text-xs text-gray-500 uppercase tracking-wide">빠른 작업</p>
                      <div className="flex flex-col gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleDeletePaint(selectedPaint!)}
                          className="w-full justify-start gap-2"
                        >
                          <Trash2 className="w-4 h-4" />
                          삭제
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={handleStartCombine}
                          className="w-full justify-start gap-2"
                        >
                          <Combine className="w-4 h-4" />
                          조합
                        </Button>
                        {selectedPaintData.type !== "audio" && (
                          <>
                            {(selectedPaintData.type === "text" || selectedPaintData.type === "image") && (
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={handleMakeNewImage}
                                className="w-full justify-start gap-2"
                              >
                                <ImagePlus className="w-4 h-4" />
                                새 이미지 만들기
                              </Button>
                            )}
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={handleMakeNewVideo}
                              className="w-full justify-start gap-2"
                            >
                              <ImagePlus className="w-4 h-4" />
                              새 비디오 만들기
                            </Button>
                          </>
                        )}
                      </div>
                    </div>

                    {/* Conversation */}
                    <div className="space-y-3">
                      {exploreMessages.map((msg) => (
                        <div
                          key={msg.id}
                          className={`flex ${
                            msg.role === "user" ? "justify-end" : "justify-start"
                          }`}
                        >
                          {msg.role === "assistant" && (msg.imageUrl || msg.paintData) ? (
                            /* Generated Result Message */
                            <div className="max-w-[85%] rounded-xl overflow-hidden bg-gray-100">
                              <div className="p-3">
                                <p className="text-sm text-gray-900 mb-2">{msg.content}</p>
                              </div>
                              {msg.imageUrl && (
                                <img
                                  src={msg.imageUrl}
                                  alt="Generated"
                                  className="w-full h-48 object-cover"
                                />
                              )}
                              {msg.paintData && (
                                <div className="p-3">
                                  <Button
                                    size="sm"
                                    onClick={() => handleAddGeneratedToPalette(msg)}
                                    className="w-full gap-2"
                                  >
                                    <Plus className="w-4 h-4" />
                                    팔레트에 추가
                                  </Button>
                                </div>
                              )}
                            </div>
                          ) : (
                            /* Regular Text Message */
                            <div className="max-w-[85%]">
                              <div
                                className={`rounded-xl px-3 py-2 ${
                                  msg.role === "user"
                                    ? "bg-blue-500 text-white"
                                    : "bg-gray-100 text-gray-900"
                                }`}
                              >
                                <p className="text-sm">{msg.content}</p>
                              </div>
                              {msg.role === "assistant" && exploreMessages.indexOf(msg) !== 0 && (
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  disabled={extractingMsgId === msg.id}
                                  onClick={async () => {
                                    if (!selectedPaint) return;
                                    setExtractingMsgId(msg.id);
                                    try {
                                      const { label, description } = await extractPaintMeta(msg.content);
                                      const sourcePaint = paints.find(p => p.id === selectedPaint);
                                      const newPaint: Paint = {
                                        id: `p${Date.now()}`,
                                        title: label,
                                        type: "text",
                                        content: description,
                                        source: "ai",
                                        tags: ["explored"],
                                        paintKind: "implicit",
                                        timestamp: new Date().toISOString(),
                                        cluster: sourcePaint?.cluster || "visual-tone",
                                        derivedFrom: [selectedPaint],
                                        x: sourcePaint ? sourcePaint.x! + 300 : 1000,
                                        y: sourcePaint?.y ?? 600,
                                      };
                                      setPaints((prev) => [...prev, newPaint]);
                                    } finally {
                                      setExtractingMsgId(null);
                                    }
                                  }}
                                  className="mt-1.5 w-full gap-2 text-xs h-7 text-gray-500 hover:text-gray-800"
                                >
                                  {extractingMsgId === msg.id ? (
                                    <><span className="w-3 h-3 border border-gray-400 border-t-transparent rounded-full animate-spin inline-block" />추출 중...</>
                                  ) : (
                                    <><Plus className="w-3 h-3" />텍스트 페인트로 추가</>
                                  )}
                                </Button>
                              )}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                ) : (
                  /* Empty State */
                  <div className="flex flex-col items-center justify-center h-full text-center px-6 py-12">
                    <div className="w-16 h-16 rounded-full bg-gray-100 flex items-center justify-center mb-4">
                      <Sparkles className="w-7 h-7 text-gray-400" />
                    </div>
                    <h3 className="text-sm text-gray-900 mb-2">
                      탐색하거나 조합할 준비가 되었습니다
                    </h3>
                    <p className="text-xs text-gray-500 mb-4">
                      페인트를 선택하여 깊이 탐구하거나, 조합 모드를 활성화하여 여러 페인트를 병합하세요
                    </p>
                    <div className="flex flex-col gap-2 w-full">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          const firstPaint = paints[0];
                          if (firstPaint) setSelectedPaint(firstPaint.id);
                        }}
                        className="w-full gap-2"
                      >
                        <FileText className="w-4 h-4" />
                        페인트 탐색하기
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setCombineMode(true)}
                        className="w-full gap-2"
                      >
                        <Combine className="w-4 h-4" />
                        조합 시작하기
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Input Area - 항상 하단에 고정 */}
            <div className="p-4 border-t border-gray-200 shrink-0 bg-white">
              <div className="flex gap-2">
                <Input
                  value={exploreInput}
                  onChange={(e) => setExploreInput(e.target.value)}
                  onKeyPress={(e) => e.key === "Enter" && handleExploreSend()}
                  placeholder={
                    combineMode && combineSelection.length >= 2
                      ? "조합 아이디어를 직접 입력하세요..."
                      : selectedPaintData
                      ? "더 깊이 탐구하기 위해 질문하세요..."
                      : "먼저 페인트를 선택하세요..."
                  }
                  disabled={combineMode ? combineSelection.length < 2 : !selectedPaintData}
                  className="flex-1"
                />
                <Button
                  onClick={handleExploreSend}
                  size="sm"
                  disabled={combineMode ? combineSelection.length < 2 : !selectedPaintData}
                >
                  <Send className="w-4 h-4" />
                </Button>
              </div>
            </div>
          </>
        )}
      </div>

      {!agentOpen && (
        <button
          onClick={() => setAgentOpen(true)}
          className="fixed right-0 top-1/2 -translate-y-1/2 bg-white border border-gray-200 rounded-l-xl px-2 py-8 hover:bg-gray-50 transition-colors shadow-lg"
        >
          <ChevronLeft className="w-4 h-4 text-gray-600" />
        </button>
      )}

      {/* Trash Modal */}
      <Dialog open={showTrashModal} onOpenChange={setShowTrashModal}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Trash2 className="w-5 h-5" />
              휴지통
            </DialogTitle>
            <DialogDescription>
              휴지통의 항목들은 30일 후 영구적으로 삭제됩니다.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            {deletedPaints.length === 0 ? (
              <div className="text-center py-12">
                <div className="w-16 h-16 rounded-full bg-gray-100 flex items-center justify-center mx-auto mb-4">
                  <Trash2 className="w-7 h-7 text-gray-400" />
                </div>
                <p className="text-sm text-gray-500">휴지통이 비어있습니다</p>
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-3 max-h-96 overflow-y-auto">
                {deletedPaints.map((paint) => (
                  <div
                    key={paint.id}
                    className="relative group"
                  >
                    <div className="pointer-events-none">
                      <PaintCard paint={paint} size="compact" />
                    </div>
                    <Button
                      size="sm"
                      variant="default"
                      onClick={() => handleRestorePaint(paint.id)}
                      className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity gap-1"
                    >
                      <Check className="w-3 h-3" />
                      복원
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* New Cluster Dialog */}
      <Dialog open={showNewClusterDialog} onOpenChange={setShowNewClusterDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>새 페인트 묶음 만들기</DialogTitle>
            <DialogDescription>
              새로운 페인트 묶음의 이름과 색상을 선택하세요
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 pt-4">
            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-900">묶음 이름</label>
              <Input
                value={newClusterName}
                onChange={(e) => setNewClusterName(e.target.value)}
                placeholder="예: 감정과 분위기"
                onKeyPress={(e) => e.key === "Enter" && handleCreateNewCluster()}
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-900">색상</label>
              <div className="grid grid-cols-4 gap-2">
                {AVAILABLE_COLORS.map((color) => (
                  <button
                    key={color}
                    onClick={() => setNewClusterColor(color)}
                    className={`h-10 rounded-lg border-2 transition-all ${
                      newClusterColor === color
                        ? "border-gray-900 ring-2 ring-gray-200"
                        : "border-gray-200 hover:border-gray-300"
                    }`}
                    style={{
                      backgroundColor:
                        color === "emerald"
                          ? "rgba(16, 185, 129, 0.2)"
                          : color === "amber"
                          ? "rgba(251, 191, 36, 0.2)"
                          : color === "blue"
                          ? "rgba(59, 130, 246, 0.2)"
                          : color === "rose"
                          ? "rgba(251, 113, 133, 0.2)"
                          : color === "violet"
                          ? "rgba(139, 92, 246, 0.2)"
                          : color === "cyan"
                          ? "rgba(6, 182, 212, 0.2)"
                          : color === "orange"
                          ? "rgba(251, 146, 60, 0.2)"
                          : "rgba(20, 184, 166, 0.2)",
                    }}
                  >
                    <div className={`w-3 h-3 rounded-full mx-auto ${CLUSTER_DOT[color]}`} />
                  </button>
                ))}
              </div>
            </div>
            <div className="flex gap-2 pt-4">
              <Button
                variant="outline"
                onClick={() => {
                  setShowNewClusterDialog(false);
                  setNewClusterName("");
                  setNewClusterColor("violet");
                }}
                className="flex-1"
              >
                취소
              </Button>
              <Button
                onClick={handleCreateNewCluster}
                disabled={!newClusterName.trim()}
                className="flex-1"
              >
                만들기
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Add Paint to Cluster Dialog */}
      <Dialog open={addToClusterDialogOpen} onOpenChange={setAddToClusterDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>클러스터에 페인트 추가</DialogTitle>
            <DialogDescription>
              {targetClusterId && allClusters.find(c => c.id === targetClusterId)?.label}에 추가할 페인트를 선택하세요
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            {paints.filter(p => p.cluster !== targetClusterId).length === 0 ? (
              <div className="text-center py-12">
                <p className="text-sm text-gray-500">추가 가능한 페인트가 없습니다</p>
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-3 max-h-96 overflow-y-auto">
                {paints
                  .filter(p => p.cluster !== targetClusterId)
                  .map((paint) => (
                    <div
                      key={paint.id}
                      className="relative group cursor-pointer"
                      onClick={() => handleAddPaintToCluster(paint.id)}
                    >
                      <div className="pointer-events-none">
                        <PaintCard paint={paint} size="compact" />
                      </div>
                      <div className="absolute inset-0 bg-blue-500/10 opacity-0 group-hover:opacity-100 transition-opacity rounded-xl flex items-center justify-center">
                        <div className="bg-white rounded-full p-2 shadow-lg">
                          <Plus className="w-5 h-5 text-blue-500" />
                        </div>
                      </div>
                    </div>
                  ))}
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}