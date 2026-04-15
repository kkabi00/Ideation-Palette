-- ============================================================
-- 프로토타입용 RLS 설정
-- 인증 없이도 동작하도록 user_id를 nullable로 변경하고
-- session_id 기반 접근 정책으로 교체
-- ⚠️  프로덕션 배포 시 auth 기반 정책으로 되돌릴 것
-- ============================================================

-- user_id nullable 허용 (인증 없는 프로토타입용)
alter table sessions alter column user_id drop not null;

-- 기존 auth 기반 정책 제거
drop policy if exists "sessions: owner access" on sessions;
drop policy if exists "nodes: owner access"    on nodes;
drop policy if exists "edges: owner access"    on edges;
drop policy if exists "messages: owner access" on messages;

-- ── 프로토타입 정책: anon key로 모든 접근 허용 ──────────────
-- sessions
create policy "sessions: anon insert"
  on sessions for insert
  to anon with check (true);

create policy "sessions: anon select"
  on sessions for select
  to anon using (true);

create policy "sessions: anon update"
  on sessions for update
  to anon using (true);

-- nodes
create policy "nodes: anon insert"
  on nodes for insert
  to anon with check (true);

create policy "nodes: anon select"
  on nodes for select
  to anon using (true);

create policy "nodes: anon update"
  on nodes for update
  to anon using (true);

-- edges
create policy "edges: anon insert"
  on edges for insert
  to anon with check (true);

create policy "edges: anon select"
  on edges for select
  to anon using (true);

-- messages
create policy "messages: anon insert"
  on messages for insert
  to anon with check (true);

create policy "messages: anon select"
  on messages for select
  to anon using (true);
