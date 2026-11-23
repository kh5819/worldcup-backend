// =========================
// 플듀 인생게임 REBORN — 사건 분야 (지시서 10분야) 2026-11-23
// child 출생·유년 / school 학교·교육 / people 친구·관계 / love 연애·결혼·가족 / career 직업·창업 / money 경제·투자
// health 건강·생활 / hobby 취미·여행·반려 / world 세계·국가·사회 / old 노년·마무리
// 새 사건은 area 를 직접 적는다. 옛 사건은 아래 표 + 나이·분류로 정한다.
// =========================
export const AREAS = ["child", "school", "people", "love", "career", "money", "health", "hobby", "world", "old"];
export const AREA_MIN = { child: 100, school: 100, people: 120, love: 120, career: 140, money: 100, health: 80, hobby: 80, world: 80, old: 80 };
const FIX = {
  midlife_old_friend: "people", midlife_reunion: "people", v2_reunion: "people", rb_reunion: "people", rb_old_friend_call: "people", sys_mentor: "people", rb2_mentor_junior: "people", rb2_coworker_friend: "people", rb_volunteer: "people",
  adult_old_flame: "love", v2_remarry: "love", rb2_meet: "love", rb2_single_life: "love",
  v2_freshman_ot: "school", v2_course_reg: "school", v2_scholarship: "school", v2_team_project: "school", chain_med_3: "school",
  rb2_overtime: "career", rb2_promotion_offer: "career", rb2_layoff: "career", rb2_side_hustle: "career", rb2_part_time_job: "career", sys_era_ai: "career", sys_goal_push: "career",
  rb2_gardening: "hobby", v2_driver_license: "hobby", rb2_burnout: "health", v2_habit: "health", adult_military: "world",
  rb_diary_found: "old", rb2_retire_party: "old", sys_mem_crossroad: "old",
};
export function areaOf(ev, categoryOf) {
  if (ev.area) return ev.area;
  if (FIX[ev.id]) return FIX[ev.id];
  const id = ev.id, a0 = ev.age ? ev.age[0] : null, st = ev.stage || "*";
  if (/^chain_\w+_2$/.test(id)) return "school";
  if (/^chain_\w+_3$/.test(id)) return "career";
  if (/^chain_\w+_[45]$/.test(id)) return "hobby";
  if (/pet|dog|cat_|hamster|rabbit|parrot|turtle|travel|trip|hobby|camp|concert|game|fish/.test(id)) return "hobby";
  const cat = categoryOf ? categoryOf(ev) : null;
  if (cat === "health") return "health";
  if (cat === "money") return "money";
  if (cat === "love") return "love";
  if (cat === "family") return (a0 != null && a0 < 13) || ["infant", "child"].includes(st) ? "child" : "love";
  if (cat === "career") return "career";
  if (cat === "people") return "people";
  if (["infant", "child"].includes(st) || (a0 != null && a0 < 10)) return "child";
  if (st === "teen" || cat === "growth" || /school|exam|class|study|univ|college|grad/.test(id)) return "school";
  if ((a0 != null && a0 >= 60) || st === "elder" || st === "senior") return "old";
  if (cat === "special" || /news|world|society|vote|election|war|disaster/.test(id)) return "world";
  return "people";
}
