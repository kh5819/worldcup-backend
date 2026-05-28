-- ============================================================
-- 시드: 일본 잡지식 퀴즈 30문제 (運営アカウント発行用)
-- 2026-05-28
-- 사용 전: 'YOUR_OWNER_ID_HERE'를 운영 계정의 user UUID로 변경
--          (Supabase > Authentication > Users 에서 확인)
-- 전제: schema_content_language.sql 먼저 실행
-- ============================================================

DO $$
DECLARE
  v_content_id UUID;
  v_owner_id UUID := 'YOUR_OWNER_ID_HERE'::uuid;  -- ← 운영 계정 UUID로 변경
BEGIN
  -- 콘텐츠 생성
  INSERT INTO contents (mode, title, description, owner_id, category, tags, language, visibility, timer_enabled)
  VALUES (
    'quiz',
    '日本一般常識クイズ 30問',
    '日本に関する一般常識を試す30問のクイズ。地理・歴史・アニメ・文化など幅広く出題。',
    v_owner_id,
    '기타',
    ARRAY['日本','一般常識','クイズ','japan','trivia'],
    'ja',
    'public',
    false
  )
  RETURNING id INTO v_content_id;

  -- 30문제 INSERT
  INSERT INTO quiz_questions (content_id, sort_order, type, prompt, choices, answer) VALUES
  (v_content_id, 1, 'mcq', '日本の首都は?',
    ARRAY['東京','京都','大阪','横浜'], ARRAY['0']),
  (v_content_id, 2, 'mcq', '日本の通貨単位は?',
    ARRAY['円','ウォン','元','ドル'], ARRAY['0']),
  (v_content_id, 3, 'mcq', '富士山の標高は?',
    ARRAY['3776m','3000m','4200m','5000m'], ARRAY['0']),
  (v_content_id, 4, 'mcq', '日本最大の島は?',
    ARRAY['本州','北海道','九州','四国'], ARRAY['0']),
  (v_content_id, 5, 'mcq', '日本の四大島で最も小さいのは?',
    ARRAY['四国','九州','北海道','本州'], ARRAY['0']),
  (v_content_id, 6, 'mcq', '任天堂の本社がある都市は?',
    ARRAY['京都','東京','大阪','横浜'], ARRAY['0']),
  (v_content_id, 7, 'mcq', '任天堂の創業年は? (花札会社としてスタート)',
    ARRAY['1889','1953','1977','1983'], ARRAY['0']),
  (v_content_id, 8, 'mcq', 'スーパーマリオの職業は?',
    ARRAY['配管工','大工','料理人','消防士'], ARRAY['0']),
  (v_content_id, 9, 'mcq', '東京スカイツリーの高さは?',
    ARRAY['634m','333m','450m','800m'], ARRAY['0']),
  (v_content_id, 10, 'mcq', '東京タワーの高さは?',
    ARRAY['333m','450m','634m','248m'], ARRAY['0']),
  (v_content_id, 11, 'mcq', '日本で最初の新幹線が開通した年は?',
    ARRAY['1964','1958','1970','1972'], ARRAY['0']),
  (v_content_id, 12, 'mcq', '東京オリンピックが最初に開催された年は?',
    ARRAY['1964','1940','1972','2020'], ARRAY['0']),
  (v_content_id, 13, 'mcq', '東京ディズニーランド開園年は?',
    ARRAY['1983','1975','1990','2001'], ARRAY['0']),
  (v_content_id, 14, 'mcq', 'ONE PIECEの作者は?',
    ARRAY['尾田栄一郎','岸本斉史','鳥山明','井上雄彦'], ARRAY['0']),
  (v_content_id, 15, 'mcq', 'NARUTOの作者は?',
    ARRAY['岸本斉史','尾田栄一郎','久保帯人','荒川弘'], ARRAY['0']),
  (v_content_id, 16, 'mcq', 'ドラゴンボールの作者は?',
    ARRAY['鳥山明','尾田栄一郎','岸本斉史','井上雄彦'], ARRAY['0']),
  (v_content_id, 17, 'mcq', '鬼滅の刃の作者は?',
    ARRAY['吾峠呼世晴','芥見下々','諫山創','尾田栄一郎'], ARRAY['0']),
  (v_content_id, 18, 'mcq', '進撃の巨人の作者は?',
    ARRAY['諫山創','吾峠呼世晴','芥見下々','尾田栄一郎'], ARRAY['0']),
  (v_content_id, 19, 'mcq', '呪術廻戦の作者は?',
    ARRAY['芥見下々','吾峠呼世晴','諫山創','久保帯人'], ARRAY['0']),
  (v_content_id, 20, 'mcq', 'ドラえもんの作者ペンネームは?',
    ARRAY['藤子・F・不二雄','臼井儀人','高橋留美子','尾田栄一郎'], ARRAY['0']),
  (v_content_id, 21, 'mcq', 'スタジオジブリの代表作「千と千尋の神隠し」公開年は?',
    ARRAY['2001','1995','2005','2008'], ARRAY['0']),
  (v_content_id, 22, 'mcq', '「君の名は。」の監督は?',
    ARRAY['新海誠','宮崎駿','細田守','高畑勲'], ARRAY['0']),
  (v_content_id, 23, 'mcq', 'インスタントラーメンを発明した人は?',
    ARRAY['安藤百福','本田宗一郎','松下幸之助','豊田佐吉'], ARRAY['0']),
  (v_content_id, 24, 'mcq', 'チキンラーメンが発明された年は?',
    ARRAY['1958','1948','1965','1972'], ARRAY['0']),
  (v_content_id, 25, 'mcq', 'ポケモン第1世代の総数は?',
    ARRAY['151','120','200','251'], ARRAY['0']),
  (v_content_id, 26, 'mcq', 'ピカチュウのタイプは?',
    ARRAY['でんき','ノーマル','ほのお','みず'], ARRAY['0']),
  (v_content_id, 27, 'mcq', '日本の3大暴れ川「坂東太郎」は?',
    ARRAY['利根川','信濃川','石狩川','吉野川'], ARRAY['0']),
  (v_content_id, 28, 'mcq', 'マリオの兄弟の名前は?',
    ARRAY['ルイージ','ワリオ','ヨッシー','ピーチ'], ARRAY['0']),
  (v_content_id, 29, 'mcq', 'ピカチュウが進化すると? (かみなりのいし)',
    ARRAY['ライチュウ','ピチュー','マリル','プリン'], ARRAY['0']),
  (v_content_id, 30, 'mcq', '日本で最も人口が多い都市は?',
    ARRAY['東京','大阪','横浜','名古屋'], ARRAY['0']);

  -- item_count 갱신 (트리거가 없는 경우 수동)
  UPDATE contents SET item_count = 30 WHERE id = v_content_id;

  RAISE NOTICE '日本一般常識クイズ 30問 作成完了: %', v_content_id;
END $$;
