import { supabase, isSupabaseConfigured } from "./supabase";
import { Paint } from "../components/PaintCard";

const SESSION_KEY = "ideation-session-id";

// ── 타입 ────────────────────────────────────────────────
export interface DBNode {
  node_id: string;
  session_id: string;
  node_type: "explicit" | "implicit" | "bridge";
  cluster: string;
  label: string;
  description: string | null;
  tags: string[];
  source: "user" | "ai";
  edge_count: number;
  importance: number;
  pinned: boolean;
  created_at: string;
}

// ── 세션 ────────────────────────────────────────────────

/** 현재 세션 ID 반환. 없으면 새로 생성. */
export async function getOrCreateSession(): Promise<string | null> {
  if (!isSupabaseConfigured) {
    console.warn("[sessionService] Supabase 미설정 (URL/KEY 확인)");
    return null;
  }

  const cached = localStorage.getItem(SESSION_KEY);
  if (cached) {
    // DB에 실제로 존재하는지 확인
    const { data } = await supabase
      .from("sessions")
      .select("session_id")
      .eq("session_id", cached)
      .maybeSingle();
    if (data) return cached;
  }

  // 새 세션 생성
  const { data, error } = await supabase
    .from("sessions")
    .insert({ current_stage: "generate", status: "active" })
    .select("session_id")
    .single();

  if (error || !data) {
    console.error("[sessionService] 세션 생성 실패:", error?.message);
    return null;
  }

  localStorage.setItem(SESSION_KEY, data.session_id);
  return data.session_id;
}

export function clearSession() {
  localStorage.removeItem(SESSION_KEY);
}

// ── 메시지 ────────────────────────────────────────────────

export async function saveMessage(
  sessionId: string,
  role: "user" | "assistant",
  content: string
): Promise<void> {
  if (!isSupabaseConfigured) return;

  const { error } = await supabase
    .from("messages")
    .insert({ session_id: sessionId, role, content });

  if (error) console.error("[sessionService] 메시지 저장 실패:", error.message);
}

// ── 노드 (페인트) ────────────────────────────────────────

export async function saveNode(
  sessionId: string,
  paint: Paint
): Promise<string | null> {
  if (!isSupabaseConfigured) {
    console.warn("[sessionService] Supabase 미설정 — 노드 저장 스킵:", paint.title);
    return null;
  }

  const nodeType = paint.paintKind ?? "explicit";
  console.log("[sessionService] 노드 저장 시도:", { sessionId, nodeType, label: paint.title });

  const { data, error } = await supabase
    .from("nodes")
    .insert({
      session_id: sessionId,
      node_type: nodeType,
      cluster: paint.cluster ?? "visual-tone",
      label: paint.title,
      description: paint.content,
      tags: paint.tags ?? [],
      source: paint.source,
      pinned: paint.pinned ?? false,
    })
    .select("node_id")
    .single();

  if (error) {
    console.error("[sessionService] 노드 저장 실패:", error.code, error.message, error.details);
    throw new Error(`노드 저장 실패: ${error.message}`);
  }

  console.log("[sessionService] 노드 저장 성공:", data.node_id);
  return data.node_id;
}

export async function loadMessages(
  sessionId: string
): Promise<{ role: "user" | "assistant"; content: string }[]> {
  if (!isSupabaseConfigured) return [];

  const { data, error } = await supabase
    .from("messages")
    .select("role, content")
    .eq("session_id", sessionId)
    .order("created_at", { ascending: true });

  if (error) {
    console.error("[sessionService] 메시지 로드 실패:", error.message);
    return [];
  }

  return (data ?? []) as { role: "user" | "assistant"; content: string }[];
}

export async function loadNodes(sessionId: string): Promise<Paint[]> {
  if (!isSupabaseConfigured) return [];

  const { data, error } = await supabase
    .from("nodes")
    .select("*")
    .eq("session_id", sessionId)
    .order("created_at", { ascending: false });

  if (error) {
    console.error("[sessionService] 노드 로드 실패:", error.message);
    return [];
  }

  return (data as DBNode[]).map(dbNodeToPaint);
}

export async function updateNodePinned(
  nodeId: string,
  pinned: boolean
): Promise<void> {
  if (!isSupabaseConfigured) return;

  const { error } = await supabase
    .from("nodes")
    .update({ pinned })
    .eq("node_id", nodeId);

  if (error) console.error("[sessionService] 핀 업데이트 실패:", error.message);
}

// ── 변환 헬퍼 ────────────────────────────────────────────

function dbNodeToPaint(node: DBNode): Paint {
  return {
    id: node.node_id,
    title: node.label,
    type: "text",
    content: node.description ?? "",
    source: node.source,
    tags: node.tags,
    timestamp: node.created_at,
    cluster: node.cluster,
    pinned: node.pinned,
    paintKind: node.node_type,
  };
}
