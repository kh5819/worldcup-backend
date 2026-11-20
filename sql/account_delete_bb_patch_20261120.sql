-- 회원탈퇴 함수에 붕어빵 진단소 표(bb_*) 추가 (2026-11-20) — 함수만 바꿈, 표·데이터 변경 없음
create or replace function public.account_delete_data(p_uid uuid, p_anon uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_sys uuid; v_role text; v_n bigint; v_counts jsonb := '{}'::jsonb; v_left text := '';
  r record; t text; uk text := 'u:' || p_uid::text; us text := p_uid::text;
  -- 표·칸이 있을 때만 실행 (없는 표는 건너뜀)
begin
  if p_uid is null or p_anon is null or p_uid = p_anon then raise exception 'BAD_ARGS'; end if;
  select user_id into v_sys from system_accounts where key = 'deleted_account';
  if v_sys is null then raise exception 'NO_SYSTEM_ACCOUNT'; end if;
  if p_uid = v_sys then raise exception 'SYSTEM_ACCOUNT'; end if;
  select role into v_role from profiles where id = p_uid;
  if v_role is not null and v_role <> 'user' then raise exception 'ADMIN_ACCOUNT'; end if;

  -- 1) 제작 콘텐츠 → 작성자를 시스템 '삭제된 계정'으로 (내용·주소·조회수·플레이 수·공개 상태 그대로)
  update contents set owner_id = v_sys where owner_id = p_uid; get diagnostics v_n = row_count; v_counts := v_counts || jsonb_build_object('contents', v_n);
  update tier_templates set creator_id = v_sys where creator_id = p_uid; get diagnostics v_n = row_count; v_counts := v_counts || jsonb_build_object('tier_templates', v_n);
  update bingos set creator_id = v_sys where creator_id = p_uid; get diagnostics v_n = row_count; v_counts := v_counts || jsonb_build_object('bingos', v_n);
  update personality_tests set creator_id = v_sys where creator_id = p_uid; get diagnostics v_n = row_count; v_counts := v_counts || jsonb_build_object('personality_tests', v_n);
  update tier_instances set user_id = v_sys where user_id = p_uid; get diagnostics v_n = row_count; v_counts := v_counts || jsonb_build_object('tier_instances', v_n);
  -- 업로드한 콘텐츠 이미지(스토리지)는 그대로 두고 소유자 정보만 지움 (프로필 사진은 백엔드가 파일째 삭제)
  update storage.objects set owner = null, owner_id = null where (owner = p_uid or owner_id = us) and bucket_id <> 'avatars';

  -- 2) 방송 진단소(스트리머 현황판) → 남기되 방송인 정보 지움 / 시청자로 참여한 기록 → 익명
  foreach t in array array['clinic','feel','gamelab','iq','know','lingo','mind','sense','zom','bb'] loop
    if to_regclass('public.' || t || '_broadcasts') is not null then
      execute format('update %I set user_id = null, owner_key = %L, streamer_nick = %L where user_id = $1 or owner_key = $2', t || '_broadcasts', 'deleted', '삭제된 계정') using p_uid, uk;
      if exists (select 1 from information_schema.columns where table_schema='public' and table_name = t || '_broadcasts' and column_name = 'avatar_url') then
        execute format('update %I set avatar_url = null where owner_key = %L and avatar_url is not null and streamer_nick = %L', t || '_broadcasts', 'deleted', '삭제된 계정');
      end if;
    end if;
    if to_regclass('public.' || t || '_bc_entries') is not null then
      execute format('update %I set user_id = null, owner_key = %L || gen_random_uuid()::text, nickname = %L where user_id = $1 or owner_key = $2', t || '_bc_entries', 'deleted:', '삭제된 계정') using p_uid, uk;
      if exists (select 1 from information_schema.columns where table_schema='public' and table_name = t || '_bc_entries' and column_name = 'show_name') then
        execute format('update %I set show_name = false where nickname = %L', t || '_bc_entries', '삭제된 계정');
      end if;
      if exists (select 1 from information_schema.columns where table_schema='public' and table_name = t || '_bc_entries' and column_name = 'result_id') then
        execute format('update %I set result_id = null where nickname = %L and result_id is not null', t || '_bc_entries', '삭제된 계정');
      end if;
    end if;
    if to_regclass('public.' || t || '_bc_predictions') is not null then execute format('delete from %I where owner_key = $1', t || '_bc_predictions') using uk; end if;
    if to_regclass('public.' || t || '_groups') is not null then execute format('update %I set host_key = %L where host_key = $1', t || '_groups', 'deleted') using uk; end if;
  end loop;
  if to_regclass('public.mind_bc_voters') is not null then delete from mind_bc_voters where owner_key = uk; end if;

  -- 3) 댓글·커뮤니티 → 글은 남기고 작성자만 '삭제된 계정'
  update content_comments set user_id = null, author_name = '삭제된 계정' where user_id = p_uid; get diagnostics v_n = row_count; v_counts := v_counts || jsonb_build_object('comments', v_n);
  update notice_comments set user_id = v_sys, author_name = '삭제된 계정' where user_id = p_uid;
  update tier_instance_comments set user_id = null, author_name = '삭제된 계정' where user_id = p_uid;
  update community_posts set user_id = v_sys where user_id = p_uid; get diagnostics v_n = row_count; v_counts := v_counts || jsonb_build_object('community_posts', v_n);
  update community_comments set user_id = v_sys where user_id = p_uid;
  update community_post_votes set voter_key = 'u:' || p_anon::text where voter_key = uk;
  update community_secrets set actor_key = 'u:' || p_anon::text where actor_key = uk;
  delete from community_post_views where viewer_key = uk;
  update community_reports set reporter_key = 'deleted' where reporter_key = uk;

  -- 4) 좋아요·투표·플레이 → 숫자는 유지, 누구인지는 끊음 (탈퇴마다 새 무작위 번호)
  update content_likes set user_id = p_anon where user_id = p_uid; get diagnostics v_n = row_count; v_counts := v_counts || jsonb_build_object('likes', v_n);
  update tier_template_likes set user_id = p_anon where user_id = p_uid;
  update tier_instance_votes set user_id = p_anon where user_id = p_uid;
  update content_plays set user_id = p_anon where user_id = p_uid;
  update ranking_points set source_user_id = p_anon where source_user_id = p_uid;
  update content_events set user_id = null where user_id = p_uid;
  update quiz_attempts set user_id = null where user_id = p_uid;
  update personality_test_attempts set user_id = null where user_id = p_uid;
  update bingo_plays set user_id = null where user_id = p_uid;
  update tier_instance_plays set user_id = null where user_id = p_uid;
  update tier_multi_results set host_user_id = null where host_user_id = p_uid;
  update raising_runs set user_id = null where user_id = p_uid;
  update highlights set submitted_by = null where submitted_by = p_uid;
  update duowars_donations set host_user_id = null where host_user_id = p_uid;
  update draw_reports set drawer_user_id = null where drawer_user_id = p_uid;
  update draw_reports set reporter_user_id = null where reporter_user_id = p_uid;
  update draw_reports set reviewer_user_id = null where reviewer_user_id = p_uid;
  update ip_bans set user_id = null where user_id = p_uid;

  -- 5) 신고 내역 → 운영 기록이라 신고 대상은 남기고, 이 회원이 신고자인 기록은 삭제(신고자 정보 제거)
  delete from reports where reporter_user_id = p_uid;
  delete from tier_reports where reporter_user_id = p_uid;
  delete from bingo_reports where reporter_user_id = p_uid;
  delete from ptest_reports where reporter_user_id = p_uid;
  delete from comment_reports where reporter_user_id = p_uid;

  -- 6) 개인 기록 삭제 (게임 점수·진단 결과·프로필·랭킹·IP·세션·이어하기)
  foreach t in array array['apple_scores','apple_aug_scores','blockblast_scores','blockblast_aug_scores','br_records','brick_scores','dodge_scores','fit_scores','gachatd_scores','memory_scores','merge_scores','ttfe_scores','sva_progress',
                           'play_history','worldcup_sessions','user_ips','bans','tier_play_cooldowns','ranking_points','ranking_hall_of_fame','admin_notifications','streamer_chat_log'] loop
    if to_regclass('public.' || t) is not null then
      if t = 'admin_notifications' then execute 'delete from admin_notifications where recipient_user_id = $1' using p_uid;
      elsif t = 'streamer_chat_log' then execute 'delete from streamer_chat_log where host_user_id = $1' using p_uid;
      else execute format('delete from %I where user_id = $1', t) using p_uid; end if;
    end if;
  end loop;
  foreach t in array array['clinic_results','feel_results','gamelab_results','iq_results','know_results','lingo_results','mind_results','sense_results','zom_results','bb_results','clinic_best','clinic_profiles','iq_profiles','ability_profiles','lifebc_saves','know_reports','lingo_reports'] loop
    if to_regclass('public.' || t) is not null then
      if exists (select 1 from information_schema.columns where table_schema='public' and table_name=t and column_name='user_id') then
        execute format('delete from %I where user_id = $1 or owner_key = $2', t) using p_uid, uk;
      else execute format('delete from %I where owner_key = $1', t) using uk; end if;
    end if;
  end loop;
  delete from completion_cooldowns where user_key = uk;
  delete from mystery_progress where user_key = us;
  delete from mystery_results where user_key = us;
  delete from br_records where player_key = us; delete from brick_scores where player_key = us; delete from ttfe_scores where player_key = us; delete from sva_progress where player_key = us;

  -- 7) 프로필(닉네임·사진 주소) 삭제 — 인증 계정 삭제 전에 개인정보부터 지움
  delete from profiles where id = p_uid; get diagnostics v_n = row_count; v_counts := v_counts || jsonb_build_object('profile', v_n);

  -- 8) 남은 연결 검사: public의 모든 uuid 칸·회원 키 칸에 이 회원 번호가 남아 있으면 전부 취소
  for r in select c.table_name tn, c.column_name cn, c.data_type dt from information_schema.columns c
           join information_schema.tables tb on tb.table_schema = c.table_schema and tb.table_name = c.table_name and tb.table_type = 'BASE TABLE'
           where c.table_schema = 'public' and c.table_name not in ('account_deletions','system_accounts')
             and (c.data_type = 'uuid' or (c.data_type = 'text' and c.column_name in ('owner_key','user_key','player_key','host_key','viewer_key','voter_key','reporter_key','actor_key','leader_key'))) loop
    if r.dt = 'uuid' then execute format('select count(*) from %I where %I = $1', r.tn, r.cn) into v_n using p_uid;
    else execute format('select count(*) from %I where %I = $1 or %I = $2', r.tn, r.cn, r.cn) into v_n using us, uk; end if;
    if v_n > 0 then v_left := v_left || r.tn || '.' || r.cn || '=' || v_n || ' '; end if;
  end loop;
  if v_left <> '' then raise exception 'LEFTOVER %', v_left; end if;
  return v_counts;
end;
$$;
revoke all on function public.account_delete_data(uuid, uuid) from public, anon, authenticated;
grant execute on function public.account_delete_data(uuid, uuid) to service_role;
