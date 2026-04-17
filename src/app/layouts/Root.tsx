import { Outlet, useLocation, useNavigate } from "react-router";
import { useEffect } from "react";
import { LeftNav } from "../components/LeftNav";
import { TopBar } from "../components/TopBar";

export function Root() {
  const location = useLocation();
  const navigate = useNavigate();

  useEffect(() => {
    const hasLocalKey = !!localStorage.getItem("ideation-api-key");
    const hasEnvKey = !!(import.meta as any).env?.VITE_OPENAI_API_KEY;
    if (!hasLocalKey && !hasEnvKey) {
      navigate("/setup");
    }
  }, []);

  // Only show top bar on export
  const showTopBar = location.pathname === "/export";

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-gray-50">
      <LeftNav />
      <div className="flex flex-1 flex-col min-w-0">
        {showTopBar && <TopBar />}
        <main className="flex-1 overflow-auto">
          <Outlet />
        </main>
      </div>
    </div>
  );
}