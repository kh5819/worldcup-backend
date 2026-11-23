// 인생게임 v2 — 프론트 진입점(코어+데이터 조립). 솔로·멀티 화면이 함께 쓴다.
import * as LEG from "./lifegame-events.js?v=20261026_5";
import { buildLife, MINI_AGES } from "./lifegame-life-data.js?v=20261026_5";
import { createCore, formatWon, MAX_AGE } from "./lifegame-core.js?v=20261026_5";

import { REBORN_EVENTS } from "./life-events-reborn.js?v=20261122_rb2";
import { thingYear } from "./life-history.js?v=20261123_w1";
import { REBORN_EVENTS2 } from "./life-events-reborn2.js?v=20261122_rb2";
import { HISTORY_EVENTS } from "./life-events-history.js?v=20261123_w1";
import { PEOPLE_EVENTS } from "./life-ev-people.js?v=20261123_w1";
import { HEALTH_EVENTS } from "./life-ev-health.js?v=20261123_w1";
import { MONEY_EVENTS } from "./life-ev-money.js?v=20261123_w1";
import { LOVE_EVENTS } from "./life-ev-love.js?v=20261123_w1";
import { OLD_EVENTS } from "./life-ev-old.js?v=20261123_w1";
import { WORLD_COUNTRY_EVENTS } from "./life-ev-world.js?v=20261123_w1";
import { PEOPLE_EVENTS2 } from "./life-ev-people2.js?v=20261123_w1";
import { YOUNG_EVENTS } from "./life-ev-young.js?v=20261123_w1";
import { HOBBY_EVENTS } from "./life-ev-hobby.js?v=20261123_w1";
export const LIFE = buildLife(LEG);
LIFE.EVENTS.push(...REBORN_EVENTS, ...REBORN_EVENTS2, ...HISTORY_EVENTS, ...PEOPLE_EVENTS, ...HEALTH_EVENTS, ...MONEY_EVENTS, ...LOVE_EVENTS, ...OLD_EVENTS, ...WORLD_COUNTRY_EVENTS, ...PEOPLE_EVENTS2, ...YOUNG_EVENTS, ...HOBBY_EVENTS);
// 큰 갈림길 사건은 해마다 이 확률로 먼저 나옴 (조건이 맞을 때만)
{ const PRIO = { v2_propose: 0.5, v2_baby_plan: 0.35, rb2_baby_talk: 0.5, rb2_meet: 0.32, v2_remarry: 0.08, rb2_kid_night: 0.35, rb2_kid_first_word: 0.35, rb2_kid_school_first: 0.4, rb2_kid_hobby: 0.3, rb2_kid_teen_door: 0.3, rb2_kid_exam: 0.4, rb2_kid_leave: 0.35, rb2_kid_wedding: 0.25, rb2_grandkid: 0.2, rb2_retire_party: 0.4, rb2_graduation: 0.4,
    // REBORN 4차: 짧은 때에만 오는 가족의 순간 (1,000개 사이에 묻히지 않게)
    lv_baby_name: 0.5, lv_first_steps: 0.45, lv_sleepless_baby: 0.35, lv_kid_question: 0.3, lv_teen_kid_door: 0.3, lv_kid_leaves_home: 0.45, lv_newlywed_chores: 0.3, lv_grandchild_born: 0.45, lv_great_grandchild: 0.5, lv_kids_wedding_speech: 0.35, lv_teen_love_kid: 0.25, lv_parent_teacher: 0.25, od_grandkid_care: 0.25, od_grandkid_question_old: 0.2, od_teach_grandkid_skill: 0.2, lv_single_parent: 0.15, lv_blended_family: 0.2, lv_divorce_talk: 0.3, od_hundredth: 0.9, od_retire_day: 0.4, cy_first_word: 0.5, cy_kindergarten_first: 0.4, wd_de_schultuete: 0.7, wd_jp_seijin: 0.6, sc_online_school: 0.5, mn_kid_education_fund: 0.15 };
  for (const e of LIFE.EVENTS) if (PRIO[e.id]) e.prio = PRIO[e.id];
  // 결혼식 준비는 결혼하고 2년 안에만 (결혼 13년 뒤 '결혼식 준비'가 나오던 모순)
  const wd = LIFE.EVENTS.find(e => e.id === "v2_wedding");
  if (wd) { const c0 = wd.cond; wd.cond = (p) => !!p.spouse && p.age - (p.spouse.since ?? p.age) <= 2 && (!c0 || c0(p)); wd.prio = 0.6; } } // REBORN(11-22): 꿈 사슬·생활 사건
// REBORN(11-23) 세계 모드: 한국에서만 있는 일 (수능·군대·전세·명절·돌잡이…) — 다른 나라 인생에선 그 나라 사건(life-events-world)이 그 자리
{ const KR_ONLY = ["adult_uni", "adult_jeonse_scam", "adult_jeonse_trap", "adult_military", "child_hagwon_skip", "v2_doljabi", "v2_100days", "v2_hagwon", "v2_allowance", "v2_csat", "v2_mock_exam", "v2_ditch_class", "v2_pc_room", "v2_newlywed_home", "v2_holiday", "v2_palsun", "v2_portrait", "rb2_in_laws", "cr_tch_entry", "v2_uniform", "v2_university"];
  for (const e of LIFE.EVENTS) if (KR_ONLY.includes(e.id)) e.country = ["KR"]; }
// REBORN(11-23) 시대에 맞지 않는 것: 사건 글에 나오는 물건·문화가 흔해지기 전에는 그 사건이 나오지 않게 (직접 정한 fromYear 가 있으면 그것)
for (const e of LIFE.EVENTS) { if (e.fromYear != null) continue; const tx = [e.title, e.desc, ...(e.choices || []).map(c => c.text + " " + (c.sub || ""))].join(" "); const y = thingYear(tx); if (y) e.fromYear = y; }
export const core = createCore(LIFE);
/** REBORN: 초점·성격 연결 고리를 단 엔진 (같은 데이터) */
export const makeCore = (opts = {}) => createCore(LIFE, opts);
export { formatWon, MINI_AGES, MAX_AGE };
export const ROUTE_LABELS = Object.fromEntries(Object.entries(LEG.ROUTES || {}).map(([k, v]) => [k, `${v.emoji} ${v.label}`]));
