import { createBrowserRouter } from "react-router";
import { Root } from "./layouts/Root";
import { HomeScreen } from "./screens/HomeScreen";
import { GenerateScreen } from "./screens/GenerateScreen";
import { PaletteScreen } from "./screens/PaletteScreen";
import { ExportScreen } from "./screens/ExportScreen";

function RouteError() {
  return (
    <div className="flex items-center justify-center h-screen bg-gray-50">
      <div className="bg-white rounded-2xl border border-gray-200 p-8 max-w-md text-center">
        <h1 className="text-gray-900 mb-2">Page Error</h1>
        <p className="text-sm text-gray-500 mb-4">
          Something went wrong loading this page.
        </p>
        <a
          href="/"
          className="inline-block px-4 py-2 bg-blue-500 text-white rounded-xl text-sm hover:bg-blue-600 transition-colors"
        >
          Go Home
        </a>
      </div>
    </div>
  );
}

export const router = createBrowserRouter([
  {
    path: "/",
    element: <Root />,
    errorElement: <RouteError />,
    children: [
      { index: true, element: <HomeScreen /> },
      { path: "generate", element: <GenerateScreen /> },
      { path: "palette", element: <PaletteScreen /> },
      { path: "export", element: <ExportScreen /> },
    ],
  },
]);