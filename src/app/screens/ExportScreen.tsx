import {
  FileText,
  Image,
  Download,
  Sparkles,
  Type,
  Music,
  Video,
} from "lucide-react";
import { Button } from "../components/ui/button";
import { Paint, PaintType } from "../components/PaintCard";

const FINAL_PAINTS: Paint[] = [
  {
    id: "1",
    title: "Neon-lit alleyway",
    type: "text",
    content: "Rain-slicked pavement reflecting scattered neon signs.",
    source: "user",
    tags: ["urban", "atmospheric"],
    timestamp: "14:32",
  },
  {
    id: "2",
    title: "Melancholic synth melody",
    type: "audio",
    content: "Slow, dreamy synth with reverb.",
    source: "ai",
    tags: ["mood", "retro"],
    timestamp: "14:34",
  },
  {
    id: "3",
    title: "Solitary figure",
    type: "text",
    content: "Someone waiting. Hood up. We never see their face.",
    source: "user",
    tags: ["character", "mystery"],
    timestamp: "14:36",
  },
  {
    id: "4",
    title: "Abandoned subway",
    type: "image",
    content: "Cracked tiles, flickering fluorescent lights.",
    source: "user",
    tags: ["location", "decay"],
    timestamp: "14:38",
    imageUrl: "https://images.unsplash.com/photo-1513002749550-c59d786b8e6c?w=400",
  },
  {
    id: "5",
    title: "Cyber rain effect",
    type: "video",
    content: "Digital rain particles falling in slow motion.",
    source: "ai",
    tags: ["fx", "digital"],
    timestamp: "14:40",
  },
  {
    id: "6",
    title: "Distant sirens",
    type: "audio",
    content: "Faint police sirens echoing through empty streets.",
    source: "user",
    tags: ["ambient", "urban"],
    timestamp: "14:42",
  },
  {
    id: "7",
    title: "Graffiti mural",
    type: "image",
    content: "Street art depicting a faceless crowd.",
    source: "user",
    tags: ["art", "symbolism"],
    timestamp: "14:44",
    imageUrl: "https://images.unsplash.com/photo-1499781350541-7783f6c6a0c8?w=400",
  },
  {
    id: "8",
    title: "Lost memory fragment",
    type: "text",
    content: "A half-remembered dream about a place that doesn't exist.",
    source: "user",
    tags: ["surreal", "memory"],
    timestamp: "14:46",
  },
];

const SNAPSHOTS = [
  {
    id: "s1",
    timestamp: "14:30",
    thumbnail: "https://images.unsplash.com/photo-1501594907352-04cda38ebc29?w=400",
  },
  {
    id: "s2",
    timestamp: "15:15",
    thumbnail: "https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=400",
  },
  {
    id: "s3",
    timestamp: "16:00",
    thumbnail: "https://images.unsplash.com/photo-1469474968028-56623f02e42e?w=400",
  },
  {
    id: "s4",
    timestamp: "16:45",
    thumbnail: "https://images.unsplash.com/photo-1518837695005-2083093ee35b?w=400",
  },
];

const AI_ANALYSIS = `당신의 작업 과정을 분석한 결과, 현재 도시적 고립감과 멜랑콜리라는 강렬한 정서적 테마를 중심으로 아이디어가 수렴하고 있습니다. 네온 조명이 빛나는 골목길, 버려진 지하철역, 그리고 얼굴 없는 고독한 인물이라는 시각적 모티프들이 반복적으로 등장하며, 이는 당신이 현대 도시에서의 소외와 익명성에 대해 깊이 탐구하고 있음을 보여줍니다.

특히 흥미로운 점은 시각과 청각 요소를 균형있게 활용하고 있다는 점입니다. 멜랑콜리한 신스 멜로디와 멀리서 들리는 사이렌 소리는 시각적 이미지들과 결합되어 몰입감 있는 감각적 경험을 만들어냅니다. 이러한 다층적 접근은 단순한 시각적 내러티브를 넘어서, 관객이 감정적으로 체험할 수 있는 분위기를 구축하고 있습니다.

당신의 탐색 패턴에서는 구체적인 것(네온 간판, 갈라진 타일)에서 출발하여 점차 추상적이고 초현실적인 영역(기억의 파편, 존재하지 않는 장소)으로 확장되는 흐름이 관찰됩니다. 이는 창의적 사고가 현실적 관찰에서 시작해 상상력의 영역으로 자연스럽게 진화하고 있음을 시사합니다. 이러한 발전은 초기 아이디어를 더욱 풍부하고 독창적인 형태로 발전시킬 수 있는 좋은 징조입니다.`;

const typeIcons: Record<PaintType, typeof Type> = {
  text: Type,
  image: Image,
  audio: Music,
  video: Video,
};

export function ExportScreen() {
  const handleDownloadAll = () => {
    alert("PDF 문서, 이미지, 비디오, 팔레트 스냅샷을 모두 다운로드하는 중...");
  };

  const handleExport = (format: string) => {
    alert(`${format} 형식으로 내보내는 중...`);
  };

  const handleDownloadAllSnapshots = () => {
    alert("모든 스냅샷을 다운로드하는 중...");
  };

  return (
    <div className="h-full bg-gradient-to-b from-gray-50 to-white">
      {/* Top bar */}
      <div className="border-b border-gray-200 bg-white/80 backdrop-blur-sm sticky top-0 z-10">
        <div className="max-w-6xl mx-auto px-8 py-4 flex items-center justify-between">
          <div>
            <h1 className="text-xl text-gray-900">프로젝트 내보내기</h1>
            <p className="text-sm text-gray-500">팔레트를 다양한 형식으로 내보내세요</p>
          </div>
          <Button size="sm" onClick={handleDownloadAll}>
            <Download className="w-4 h-4 mr-2" />
            다운로드
          </Button>
        </div>
      </div>

      {/* Main content */}
      <div className="max-w-6xl mx-auto px-8 py-8 h-[calc(100%-73px)]">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 h-full">
          {/* Left column: Paints - Scrollable */}
          <div className="lg:col-span-2 h-full overflow-hidden">
            <div className="bg-white rounded-2xl border border-gray-200 p-6 h-full flex flex-col">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg text-gray-900">페인트 ({FINAL_PAINTS.length})</h2>
              </div>

              <div className="flex-1 overflow-y-auto pr-2 -mr-2">
                <div className="grid grid-cols-2 gap-3">
                  {FINAL_PAINTS.map((paint) => {
                    const Icon = typeIcons[paint.type];
                    return (
                      <div
                        key={paint.id}
                        className="bg-white rounded-xl border-2 border-gray-200 hover:border-blue-300 transition-all p-4 cursor-pointer group"
                      >
                        {paint.imageUrl && (
                          <div className="w-full h-24 bg-gray-100 rounded-lg mb-3 overflow-hidden">
                            <img
                              src={paint.imageUrl}
                              alt={paint.title}
                              className="w-full h-full object-cover"
                            />
                          </div>
                        )}
                        <div className="flex items-start gap-3">
                          <div className="w-8 h-8 bg-gray-100 rounded-lg flex items-center justify-center shrink-0 group-hover:bg-blue-50 transition-colors">
                            <Icon className="w-4 h-4 text-gray-600 group-hover:text-blue-600" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <h3 className="text-sm text-gray-900 mb-1 line-clamp-1">
                              {paint.title}
                            </h3>
                            <p className="text-xs text-gray-500 line-clamp-2">{paint.content}</p>
                            <div className="flex flex-wrap gap-1 mt-2">
                              {paint.tags.map((tag) => (
                                <span
                                  key={tag}
                                  className="px-1.5 py-0.5 bg-gray-100 rounded text-[10px] text-gray-600"
                                >
                                  {tag}
                                </span>
                              ))}
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>

          {/* Right column: Options */}
          <div className="space-y-6 overflow-y-auto">
            {/* Export formats */}
            <div className="bg-white rounded-2xl border border-gray-200 p-6">
              <h2 className="text-lg text-gray-900 mb-4">내보내기 형식</h2>

              <div className="space-y-2">
                {[
                  { label: "PDF 문서", icon: FileText, desc: "전체 아이디에이션 내용" },
                  { label: "이미지", icon: Image, desc: "레퍼런스 이미지" },
                  { label: "비디오", icon: Video, desc: "생성된 비디오" },
                ].map((format) => (
                  <button
                    key={format.label}
                    onClick={() => handleExport(format.label)}
                    className="w-full text-left px-4 py-3 rounded-xl border-2 border-gray-200 hover:border-blue-400 hover:bg-blue-50/50 transition-all group"
                  >
                    <div className="flex items-center gap-3">
                      <format.icon className="w-5 h-5 text-gray-400 group-hover:text-blue-600" />
                      <div>
                        <div className="text-sm text-gray-900">{format.label}</div>
                        <div className="text-xs text-gray-500">{format.desc}</div>
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            </div>

            {/* Snapshots */}
            <div className="bg-white rounded-2xl border border-gray-200 p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg text-gray-900">팔레트 스냅샷</h2>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleDownloadAllSnapshots}
                >
                  <Download className="w-4 h-4 mr-2" />
                  전체
                </Button>
              </div>

              <div className="grid grid-cols-2 gap-2">
                {SNAPSHOTS.map((snap) => (
                  <div
                    key={snap.id}
                    className="relative rounded-lg overflow-hidden cursor-pointer group"
                  >
                    <img
                      src={snap.thumbnail}
                      alt={`Snapshot ${snap.id}`}
                      className="w-full h-24 object-cover group-hover:scale-105 transition-transform"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/50 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                    <div className="absolute bottom-2 left-2 text-[10px] text-white font-medium">
                      {snap.timestamp}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* AI Analysis */}
            <div className="bg-white rounded-2xl border border-gray-200 p-6">
              <div className="flex items-center gap-2 mb-4">
                <Sparkles className="w-5 h-5 text-yellow-500" />
                <h2 className="text-lg text-gray-900">AI 분석</h2>
              </div>

              <div className="bg-gradient-to-r from-blue-50 to-purple-50 rounded-xl p-4 border border-blue-100">
                <p className="text-sm text-gray-700 leading-relaxed whitespace-pre-line">
                  {AI_ANALYSIS}
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}