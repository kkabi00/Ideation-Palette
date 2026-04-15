export interface PaletteCluster {
  id: string;
  label: string;
  color: string;
  description: string;
  isUserCreated?: boolean;
}

export const DEFAULT_CLUSTERS: PaletteCluster[] = [
  { 
    id: "visual-tone", 
    label: "시각적 톤과 색상", 
    color: "emerald", 
    description: "시각적 분위기, 색상 팔레트, 조명 무드" 
  },
  { 
    id: "storyline", 
    label: "스토리라인과 서사", 
    color: "amber", 
    description: "줄거리 단편, 캐릭터 비트, 스토리 아크" 
  },
  { 
    id: "sound-music", 
    label: "사운드와 음악", 
    color: "blue", 
    description: "오디오 텍스처, 멜로디, 음향 무드" 
  },
  { 
    id: "character", 
    label: "캐릭터와 인물", 
    color: "rose", 
    description: "사람, 페르소나, 캐릭터 컨셉" 
  },
];

export const CLUSTER_DOT: Record<string, string> = {
  emerald: "bg-emerald-400",
  amber: "bg-amber-400",
  blue: "bg-blue-400",
  rose: "bg-rose-400",
  violet: "bg-violet-400",
  cyan: "bg-cyan-400",
  orange: "bg-orange-400",
  teal: "bg-teal-400",
};

export const CLUSTER_BADGE: Record<string, string> = {
  emerald: "bg-emerald-100 text-emerald-700 border-emerald-200",
  amber: "bg-amber-100 text-amber-700 border-amber-200",
  blue: "bg-blue-100 text-blue-700 border-blue-200",
  rose: "bg-rose-100 text-rose-700 border-rose-200",
  violet: "bg-violet-100 text-violet-700 border-violet-200",
  cyan: "bg-cyan-100 text-cyan-700 border-cyan-200",
  orange: "bg-orange-100 text-orange-700 border-orange-200",
  teal: "bg-teal-100 text-teal-700 border-teal-200",
};

export const AVAILABLE_COLORS = [
  "emerald", "amber", "blue", "rose", "violet", "cyan", "orange", "teal"
];