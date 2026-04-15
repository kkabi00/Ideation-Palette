import { User } from "lucide-react";

interface TopBarProps {
  sessionTitle?: string;
}

export function TopBar({
  sessionTitle = "Untitled Session",
}: TopBarProps) {
  return (
    <div className="h-12 border-b border-gray-200 bg-white flex items-center justify-between px-6 shrink-0">
      <h1 className="text-sm text-gray-900">{sessionTitle}</h1>
      <button className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center hover:bg-gray-200 transition-colors">
        <User className="w-4 h-4 text-gray-600" />
      </button>
    </div>
  );
}
