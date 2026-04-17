import { useState } from "react";
import { useNavigate } from "react-router";
import { KeyRound, ExternalLink, Eye, EyeOff } from "lucide-react";
import { Button } from "../components/ui/button";

export const API_KEY_STORAGE = "ideation-api-key";

export function ApiKeyScreen() {
  const navigate = useNavigate();
  const [key, setKey] = useState("");
  const [show, setShow] = useState(false);
  const [error, setError] = useState("");

  const handleSave = () => {
    const trimmed = key.trim();
    if (!trimmed.startsWith("sk-")) {
      setError("OpenAI API 키는 'sk-'로 시작해야 합니다.");
      return;
    }
    localStorage.setItem(API_KEY_STORAGE, trimmed);
    navigate("/");
  };

  return (
    <div className="h-screen flex items-center justify-center bg-gray-50">
      <div className="bg-white rounded-2xl border border-gray-200 p-8 w-full max-w-md mx-4 shadow-sm">

        {/* 헤더 */}
        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 rounded-xl bg-blue-500 flex items-center justify-center shrink-0">
            <KeyRound className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="text-base font-semibold text-gray-900">Ideation Palette</h1>
            <p className="text-xs text-gray-500">시작하려면 OpenAI API 키가 필요합니다</p>
          </div>
        </div>

        {/* 설명 */}
        <div className="bg-blue-50 rounded-xl p-3 mb-5 text-xs text-blue-700 leading-relaxed">
          입력한 키는 <strong>이 브라우저에만</strong> 저장됩니다.
          서버로 전송되지 않으며 언제든 변경할 수 있습니다.
        </div>

        {/* 입력 */}
        <label className="block text-xs font-medium text-gray-700 mb-1.5">
          OpenAI API Key
        </label>
        <div className="relative mb-1.5">
          <input
            autoFocus
            type={show ? "text" : "password"}
            placeholder="sk-proj-..."
            value={key}
            onChange={e => { setKey(e.target.value); setError(""); }}
            onKeyDown={e => { if (e.key === "Enter") handleSave(); }}
            className="w-full rounded-xl border border-gray-200 px-3 py-2.5 pr-10 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400 font-mono"
          />
          <button
            type="button"
            onClick={() => setShow(v => !v)}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
          >
            {show ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
          </button>
        </div>
        {error && <p className="text-xs text-red-500 mb-3">{error}</p>}

        {/* 버튼 */}
        <Button
          disabled={!key.trim()}
          className="w-full bg-blue-500 hover:bg-blue-600 mt-2"
          onClick={handleSave}
        >
          시작하기
        </Button>

        {/* 키 발급 링크 */}
        <a
          href="https://platform.openai.com/api-keys"
          target="_blank"
          rel="noreferrer"
          className="mt-4 flex items-center justify-center gap-1 text-xs text-gray-400 hover:text-gray-600 transition-colors"
        >
          <ExternalLink className="w-3 h-3" />
          OpenAI API 키 발급받기
        </a>
      </div>
    </div>
  );
}
