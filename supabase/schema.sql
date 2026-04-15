-- ============================================================
-- Idea Palette — Supabase Schema
-- PostgreSQL + pgvector (1536d, text-embedding-3-small)
-- ============================================================

-- 0. pgvector 확장 활성화
create extension if not exists vector;


-- ============================================================
-- 1. sessions
-- ============================================================
create table sessions (
  session_id  uuid primary key default gen_random_uuid(),
  user_id     uuid references auth.users(id) on delete cascade,
  title       text,
  current_stage text not null default 'start'
    check (current_stage in ('start', 'generate', 'palette', 'export')),
  status      text not null default 'active'
    check (status in ('active', 'completed', 'archived')),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- updated_at 자동 갱신 트리거
create or replace function update_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger sessions_updated_at
  before update on sessions
  for each row execute function update_updated_at();


-- ============================================================
-- 2. nodes  (페인트 = preinventive structure)
-- ============================================================
create table nodes (
  node_id     uuid primary key default gen_random_uuid(),
  session_id  uuid not null references sessions(session_id) on delete cascade,
  node_type   text not null
    check (node_type in ('explicit', 'implicit', 'bridge')),
  cluster     text not null default 'visual-tone'
    check (cluster in ('visual-tone', 'storyline', 'sound-music', 'character')),
  label       text not null,           -- 짧은 키워드 (2-4 단어)
  description text,                    -- 상세 설명
  tags        text[] not null default '{}',
  source      text not null default 'ai'
    check (source in ('user', 'ai')),
  embedding   vector(1536),            -- text-embedding-3-small
  edge_count  integer not null default 0,
  importance  real not null default 0.5  -- 0~1, 수동 또는 AI 부여
    check (importance between 0 and 1),
  pinned      boolean not null default false,
  created_at  timestamptz not null default now()
);

-- cosine 유사도 검색을 위한 HNSW 인덱스 (pgvector 0.5+)
create index nodes_embedding_hnsw
  on nodes using hnsw (embedding vector_cosine_ops)
  with (m = 16, ef_construction = 64);

-- session_id 조회 인덱스
create index nodes_session_id_idx on nodes (session_id);


-- ============================================================
-- 3. edges
-- ============================================================
create table edges (
  edge_id        uuid primary key default gen_random_uuid(),
  source_node_id uuid not null references nodes(node_id) on delete cascade,
  target_node_id uuid not null references nodes(node_id) on delete cascade,
  relation_type  text not null default 'related'
    check (relation_type in ('related', 'derived', 'bridge', 'contrast', 'combines')),
  weight         real not null default 1.0
    check (weight between 0 and 1),
  created_at     timestamptz not null default now(),
  constraint no_self_loop check (source_node_id <> target_node_id)
);

create index edges_source_idx on edges (source_node_id);
create index edges_target_idx on edges (target_node_id);

-- edge 생성/삭제 시 edge_count 동기화 트리거
create or replace function sync_edge_count()
returns trigger language plpgsql as $$
begin
  if tg_op = 'INSERT' then
    update nodes set edge_count = edge_count + 1 where node_id in (new.source_node_id, new.target_node_id);
  elsif tg_op = 'DELETE' then
    update nodes set edge_count = greatest(edge_count - 1, 0) where node_id in (old.source_node_id, old.target_node_id);
  end if;
  return null;
end;
$$;

create trigger edges_sync_count
  after insert or delete on edges
  for each row execute function sync_edge_count();


-- ============================================================
-- 4. messages
-- ============================================================
create table messages (
  message_id  uuid primary key default gen_random_uuid(),
  session_id  uuid not null references sessions(session_id) on delete cascade,
  role        text not null check (role in ('user', 'assistant', 'system')),
  content     text not null,
  created_at  timestamptz not null default now()
);

create index messages_session_id_idx on messages (session_id, created_at);


-- ============================================================
-- 5. 노드 선택 RPC 함수
--    (claude.md의 핵심 로직: 유사도 0.5 + 최신성 0.3 + 중요도 0.2)
-- ============================================================
create or replace function match_nodes(
  p_session_id  uuid,
  p_embedding   vector(1536),
  p_min_sim     real    default 0.65,
  p_limit       integer default 20
)
returns table (
  node_id       uuid,
  node_type     text,
  cluster       text,
  label         text,
  description   text,
  tags          text[],
  source        text,
  edge_count    integer,
  importance    real,
  pinned        boolean,
  created_at    timestamptz,
  similarity    real,
  recency       real,
  score         real
)
language sql stable as $$
  with ranked as (
    select
      n.*,
      (1 - (n.embedding <=> p_embedding))::real                   as similarity,
      -- recency: 세션 내에서 가장 최근 노드를 1, 가장 오래된 노드를 0으로 정규화
      case
        when count(*) over (partition by n.session_id) = 1 then 1.0
        else (
          extract(epoch from n.created_at) - min(extract(epoch from n.created_at)) over (partition by n.session_id)
        ) / nullif(
          max(extract(epoch from n.created_at)) over (partition by n.session_id)
          - min(extract(epoch from n.created_at)) over (partition by n.session_id),
          0
        )
      end::real                                                    as recency
    from nodes n
    where n.session_id = p_session_id
      and n.embedding is not null
      and (1 - (n.embedding <=> p_embedding)) > p_min_sim
  )
  select
    r.node_id,
    r.node_type,
    r.cluster,
    r.label,
    r.description,
    r.tags,
    r.source,
    r.edge_count,
    r.importance,
    r.pinned,
    r.created_at,
    r.similarity,
    coalesce(r.recency, 0.5)                                       as recency,
    (r.similarity * 0.5 + coalesce(r.recency, 0.5) * 0.3 + r.importance * 0.2)::real as score
  from ranked r
  order by score desc
  limit p_limit;
$$;


-- ============================================================
-- 6. Row Level Security (RLS)
-- ============================================================
alter table sessions enable row level security;
alter table nodes    enable row level security;
alter table edges    enable row level security;
alter table messages enable row level security;

-- sessions: 본인 세션만 접근
create policy "sessions: owner access"
  on sessions for all
  using (user_id = auth.uid());

-- nodes: 본인 세션의 노드만 접근
create policy "nodes: owner access"
  on nodes for all
  using (
    session_id in (
      select session_id from sessions where user_id = auth.uid()
    )
  );

-- edges: 본인 세션의 노드 간 엣지만 접근
create policy "edges: owner access"
  on edges for all
  using (
    source_node_id in (
      select n.node_id from nodes n
      join sessions s on s.session_id = n.session_id
      where s.user_id = auth.uid()
    )
  );

-- messages: 본인 세션의 메시지만 접근
create policy "messages: owner access"
  on messages for all
  using (
    session_id in (
      select session_id from sessions where user_id = auth.uid()
    )
  );
