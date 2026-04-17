import { Zap, Wand2, Palette, Download, KeyRound } from "lucide-react";
import { Link, useLocation, useNavigate } from "react-router";

export function LeftNav() {
  const location = useLocation();
  const navigate = useNavigate();

  const flowItems = [
    { label: "Start", icon: Zap, path: "/" },
    { label: "Generation", icon: Wand2, path: "/generate" },
    { label: "Palette", icon: Palette, path: "/palette" },
    { label: "Export", icon: Download, path: "/export" },
  ];

  const activeIndex = flowItems.findIndex(
    (item) => item.path === location.pathname
  );

  return (
    <div className="w-[72px] border-r border-gray-200 bg-white flex flex-col items-center shrink-0">
      {/* Logo */}
      <div className="py-4 border-b border-gray-200 w-full flex justify-center">
        <div className="w-9 h-9 rounded-xl bg-blue-500 flex items-center justify-center">
          <Palette className="w-5 h-5 text-white" />
        </div>
      </div>

      {/* Flow nav */}
      <nav className="flex-1 flex flex-col items-center pt-5 pb-3 w-full">
        <div className="flex flex-col items-center relative">
          {flowItems.map((item, idx) => {
            const Icon = item.icon;
            const isActive = location.pathname === item.path;
            const isPast = activeIndex > idx;

            return (
              <div key={item.path} className="flex flex-col items-center relative">
                {/* Connecting line above */}
                {idx > 0 && (
                  <div
                    className={`w-px h-4 ${
                      isPast || isActive ? "bg-blue-400" : "bg-gray-200"
                    } transition-colors`}
                  />
                )}

                {/* Node */}
                <Link
                  to={item.path}
                  className={`relative w-10 h-10 rounded-xl flex items-center justify-center transition-all group ${
                    isActive
                      ? "bg-blue-500 text-white shadow-sm"
                      : isPast
                      ? "bg-blue-50 text-blue-500 hover:bg-blue-100"
                      : "bg-gray-50 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
                  }`}
                >
                  <Icon className="w-[18px] h-[18px]" />
                  {/* Tooltip */}
                  <div className="absolute left-full ml-2 px-2 py-1 rounded-md bg-gray-900 text-white text-[11px] whitespace-nowrap opacity-0 pointer-events-none group-hover:opacity-100 transition-opacity z-50">
                    {item.label}
                  </div>
                </Link>

                {/* Label */}
                <span
                  className={`text-[10px] mt-1 ${
                    isActive ? "text-blue-600" : isPast ? "text-blue-400" : "text-gray-400"
                  }`}
                >
                  {item.label}
                </span>
              </div>
            );
          })}
        </div>
      </nav>

      {/* API 키 변경 */}
      <div className="pb-4 flex justify-center">
        <button
          onClick={() => navigate("/setup")}
          className="w-10 h-10 rounded-xl flex items-center justify-center text-gray-400 hover:bg-gray-100 hover:text-gray-600 transition-all group relative"
        >
          <KeyRound className="w-[18px] h-[18px]" />
          <div className="absolute left-full ml-2 px-2 py-1 rounded-md bg-gray-900 text-white text-[11px] whitespace-nowrap opacity-0 pointer-events-none group-hover:opacity-100 transition-opacity z-50">
            API 키 변경
          </div>
        </button>
      </div>
    </div>
  );
}