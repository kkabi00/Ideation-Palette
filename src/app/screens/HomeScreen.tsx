import { useState } from "react";
import { useNavigate } from "react-router";
import { Upload, Sparkles, Search, RefreshCw, MessageSquare, X, Plus } from "lucide-react";
import { Button } from "../components/ui/button";
import { Label } from "../components/ui/label";
import { Badge } from "../components/ui/badge";

export function HomeScreen() {
  const navigate = useNavigate();
  const [prompt, setPrompt] = useState("");
  const [inspirations, setInspirations] = useState<string[]>([]);
  const [newInspiration, setNewInspiration] = useState("");

  const handleAddInspiration = () => {
    if (newInspiration.trim()) {
      setInspirations([...inspirations, newInspiration.trim()]);
      setNewInspiration("");
    }
  };

  const handleRemoveInspiration = (index: number) => {
    setInspirations(inspirations.filter((_, i) => i !== index));
  };

  return (
    <div className="h-full overflow-y-auto flex items-start justify-center p-8">
      <div className="max-w-3xl w-full mt-4">
        {/* New Session Card */}
        <div className="bg-white rounded-2xl border border-gray-200 p-8 mb-6">
          <h1 className="text-gray-900 mb-1">새 세션 시작하기</h1>
          <p className="text-sm text-gray-500 mb-8">
            완성된 아이디어가 아닌 단편들을 가져오세요. Geneplore 모델이 안내할 것입니다.
          </p>

          <div className="space-y-5">
            <div>
              <Label htmlFor="prompt" className="text-xs text-gray-500 uppercase tracking-wide">
                무엇을 생각하고 계신가요?
              </Label>
              <textarea
                id="prompt"
                placeholder="아이디어, 단편, 또는 탐구하고 있는 것을 설명해주세요..."
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                className="mt-1.5 w-full min-h-[120px] rounded-xl border border-gray-200 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400 resize-none"
              />
            </div>

            <div>
              <Label className="text-xs text-gray-500 uppercase tracking-wide">
                영감 (선택사항)
              </Label>
              <p className="text-[11px] text-gray-400 mt-0.5 mb-2">
                참고자료, 기존 작업, 또는 탐구하고 싶은 자료를 추가하세요
              </p>
              
              {/* List of inspirations */}
              {inspirations.length > 0 && (
                <div className="space-y-2 mb-3">
                  {inspirations.map((inspiration, index) => (
                    <div
                      key={index}
                      className="flex items-center gap-2 p-2.5 rounded-xl bg-gray-50 border border-gray-100"
                    >
                      <span className="flex-1 text-sm text-gray-700">{inspiration}</span>
                      <button
                        onClick={() => handleRemoveInspiration(index)}
                        className="text-gray-400 hover:text-gray-600"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                </div>
              )}

              {/* Add new inspiration */}
              <div className="flex gap-2">
                <input
                  type="text"
                  placeholder="참고자료 또는 자료 추가..."
                  value={newInspiration}
                  onChange={(e) => setNewInspiration(e.target.value)}
                  onKeyPress={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      handleAddInspiration();
                    }
                  }}
                  className="flex-1 rounded-xl border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
                />
                <Button
                  onClick={handleAddInspiration}
                  variant="outline"
                  className="rounded-xl px-4"
                  disabled={!newInspiration.trim()}
                >
                  <Plus className="w-4 h-4" />
                </Button>
              </div>

              {/* File upload area */}
              <div className="mt-3 border-2 border-dashed border-gray-200 rounded-2xl p-6 text-center hover:border-gray-300 transition-colors cursor-pointer">
                <Upload className="w-6 h-6 text-gray-400 mx-auto mb-2" />
                <p className="text-xs text-gray-500">
                  또는 이미지, 오디오, 노트를 드래그 앤 드롭하세요
                </p>
              </div>
            </div>

            <Button
              onClick={() => navigate("/generate")}
              className="w-full h-11 bg-blue-500 hover:bg-blue-600 rounded-xl gap-2"
              disabled={!prompt.trim()}
            >
              <MessageSquare className="w-4 h-4" />
              채팅으로 시작하기
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}