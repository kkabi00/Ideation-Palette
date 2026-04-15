import { createClient } from "@supabase/supabase-js";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string;

if (!supabaseUrl || !supabaseAnonKey) {
  console.warn("[Supabase] 환경변수가 설정되지 않았습니다. DB 연동이 비활성화됩니다.");
}

export const supabase = createClient(supabaseUrl ?? "", supabaseAnonKey ?? "");

export const isSupabaseConfigured =
  Boolean(supabaseUrl) &&
  supabaseUrl !== "your-supabase-url" &&
  Boolean(supabaseAnonKey) &&
  supabaseAnonKey !== "your-supabase-anon-key";
