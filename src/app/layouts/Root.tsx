import { Outlet, useLocation } from "react-router";
import { LeftNav } from "../components/LeftNav";
import { TopBar } from "../components/TopBar";

export function Root() {
  const location = useLocation();

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