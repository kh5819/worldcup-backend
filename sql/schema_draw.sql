-- ============================================================
-- 그려봐 (DUO Draw) — 신고 + (Week 2) 공식 단어풀 + (Week 3) 리플레이 저장
-- 2026-05-15
-- ============================================================

-- 신고 (간단 버튼 → admin 큐)
create table if not exists draw_reports (
  id              uuid primary key default gen_random_uuid(),
  room_id         text not null,
  round_no        int,
  drawer_user_id  uuid references auth.users(id) on delete set null,
  reporter_user_id uuid references auth.users(id) on delete set null,
  word            text,
  strokes_json    jsonb,                      -- Week 3에서 채움 (replay)
  status          text not null default 'pending'
                  check (status in ('pending','reviewed','dismissed','sanctioned')),
  reviewer_user_id uuid references auth.users(id) on delete set null,
  reviewed_at     timestamptz,
  reason          text,
  created_at      timestamptz default now()
);

create index if not exists idx_draw_reports_status_created
  on draw_reports (status, created_at desc);

alter table draw_reports enable row level security;

drop policy if exists "draw_reports service" on draw_reports;
create policy "draw_reports service" on draw_reports
  for all using (auth.role() = 'service_role') with check (auth.role() = 'service_role');

-- 공식 단어풀 (Week 2)
create table if not exists draw_words (
  id              uuid primary key default gen_random_uuid(),
  category        text not null,             -- 'anime' | 'game' | 'food' | 'animal' | 'meme' | 'celeb'
  word            text not null,
  difficulty      int not null default 2 check (difficulty between 1 and 3),
  active          boolean not null default true,
  created_at      timestamptz default now()
);

create unique index if not exists ux_draw_words_word_category
  on draw_words (category, word);
create index if not exists idx_draw_words_category_active
  on draw_words (category, active) where active = true;

alter table draw_words enable row level security;
drop policy if exists "draw_words read all" on draw_words;
create policy "draw_words read all" on draw_words
  for select using (true);
drop policy if exists "draw_words write service" on draw_words;
create policy "draw_words write service" on draw_words
  for insert with check (auth.role() = 'service_role');
