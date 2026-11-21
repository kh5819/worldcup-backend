-- 2026-11-21 일부공개(unlisted) 퀴즈를 공유 링크로 열면 "퀴즈 문제가 등록되지 않았습니다" 버그 수정
-- 원인: quiz_questions 읽기 규칙만 visibility = 'public' 만 허용 (contents·worldcup_candidates·bingos·personality_tests는 unlisted도 허용)
-- → 만든 사람(owner)은 보이지만 링크로 들어온 사람은 문제를 못 읽음. worldcup_candidates와 같은 규칙으로 맞춤 (읽기만, 비공개는 그대로 본인만)
-- 되돌리기:
--   drop policy if exists quiz_questions_select_public_or_owner on public.quiz_questions;
--   create policy quiz_questions_select_public_or_owner on public.quiz_questions for select using (exists (select 1 from public.contents c where c.id = quiz_questions.content_id and (c.visibility = 'public' or c.owner_id = (select auth.uid()))));
begin;
drop policy if exists quiz_questions_select_public_or_owner on public.quiz_questions;
create policy quiz_questions_select_public_or_owner on public.quiz_questions for select
  using (exists (select 1 from public.contents c where c.id = quiz_questions.content_id and (c.visibility = any (array['public'::text, 'unlisted'::text]) or c.owner_id = (select auth.uid()))));
commit;
