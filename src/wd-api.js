// =========================
// 플듀 끝말잇기 — 국립국어원 우리말샘 오픈 API로 단어 확인·뜻 찾기 (2026-11-22)
// · 우리 단어 목록에 없는 단어 → API에 "명사인지" 물어봄 → 맞으면 정답 인정 (+뜻)
// · 인증 키: 서버 설정 WD_DICT_KEY (코드·저장소에 넣지 않음, 국어사전 통합 누리집 키 = 우리말샘·표준국어대사전 공용). 없으면 이 기능은 꺼짐
// · 주의: num·start를 꼭 같이 보내야 결과가 나옴 (안 보내면 total 0, num은 10 이상)
// · "고속도로"처럼 붙여 써도 되는 말은 사전에 "고속^도로"(품사 칸 비어 있음)로 있음 → 품사 거르기(pos=1) 없이 찾고,
//   품사가 명사이거나, ^로만 이어진 붙임 명사(품사 비어 있음)면 인정. 띄어 쓰는 구절(속담·관용구, 빈칸 있음)은 안 됨
// · 같은 소리 단어가 여럿일 때 뜻 고르기: 일반 뜻(분야 표시 없음) 개수가 가장 많은 단어의 첫 뜻
//   (분야 표시 = 작품 제목·전문어 → 0.4, 옛 관직·종교 용어 같은 드문 뜻 → 0)
// · 한 번 물어본 단어는 기억 (맞음·틀림 모두) · 같은 단어를 동시에 여러 번 묻지 않음 · 하루 호출 상한 · 2.5초 넘으면 포기
// · 방언·옛말·북한어 뜻만 있는 단어는 인정 안 함
// =========================
const URL_SEARCH = "https://opendict.korean.go.kr/api/search";
const HANGUL = /^[가-힣]{2,15}$/;
const RARE = /시대에|조선|고려|신라|백제|고구려|불교|유학|도교|천주교|천도교|예전에|옛날|이르던|낮잡아|속되게|은어|비유적으로|한방에서|\(\d{3,4}~|초명|연호|성씨|벼슬|관아|관청|궁중|작사|작곡|지은 |그린 그림|감독의|주연의/;
// 낮출 분야 (작품 제목·고유명·전문 용어) — 동물·식물·음식·지리 같은 일상 분야는 그대로
const CAT_LOW = /음악|미술|문학|영화|연극|무용|사진|만화|방송|종교|불교|가톨릭|기독교|법률|역사|지명|인명|고유명|군사|민속|한의|천문|광업|수학|물리|화학|철학|언어|교육|경제|정치|행정|심리|의학|약학|공업|기계|전기|전자|건설|해양|농업|수산|임업|체육|교통/;

/** 뜻 정리: 태그·「」·[] 지우고 40글자까지 */
export function cleanDef(d) {
  const s = String(d || "").replace(/<[^>]*>/g, "").replace(/「[^」]*」/g, "").replace(/\[[^\]]*\]/g, "").replace(/\s+/g, " ").replace(/^[\s.·]+/, "").trim();
  const a = [...s]; return a.length > 40 ? a.slice(0, 39).join("").trimEnd() + "…" : s;
}
const norm = (x) => String(x || "").replace(/[-^\s]/g, "").replace(/\d+$/, "").normalize("NFC");
/** 우리말샘 응답(JSON) → { noun, def }
 *  noun: 명사 뜻(방언·옛말·북한어 빼고)이 하나라도 있으면 true
 *  def: 일반 뜻(드문 뜻·전문 분야·작품 제목 아님)을 가진 같은 소리 단어가 딱 하나일 때만 그 첫 뜻, 여럿이면 "" (어떤 뜻이 흔한지 API가 알려 주지 않아서 — 틀린 뜻보다 안 보여 주는 게 나음) */
export function parseOpen(json, w) {
  let noun = false; const groups = new Map();
  for (const it of [].concat(json?.channel?.item || [])) {
    if (norm(it?.word) !== w) continue;
    const joined = /\^/.test(String(it?.word || "")) && !/\s/.test(String(it?.word || ""));
    for (const s of [].concat(it?.sense || [])) {
      if (!(s?.pos === "명사" || (joined && !s?.pos))) continue;
      const type = String(s?.type || "일반어").trim() || "일반어"; if (/방언|옛말|북한/.test(type)) continue;
      noun = true;
      const raw = String(s?.definition || ""), def = cleanDef(raw); if (!def) continue;
      const catText = [].concat(s?.cat || []).map(c => typeof c === "string" ? c : c?.cat || "").join(" ");
      if (RARE.test(raw) || CAT_LOW.test(catText) || type !== "일반어") continue;
      const k = norm(it.word) + "|" + (it.sup_no || "") + "|" + (s.origin || ""), no = Number(s?.sense_no) || 999;
      const g = groups.get(k); if (!g || no < g.no) groups.set(k, { no, def });
    }
  }
  return { noun, def: groups.size === 1 ? [...groups.values()][0].def : "" };
}

export function createDictLookup(key, { fetchImpl = globalThis.fetch, dailyMax = 20000, timeoutMs = 2500, cacheMax = 60000 } = {}) {
  const on = typeof key === "string" && /^[0-9A-Fa-f]{32}$/.test(key) && typeof fetchImpl === "function";
  const cache = new Map(), flying = new Map(); let day = "", used = 0, fails = 0, downUntil = 0;
  const put = (w, v) => { cache.set(w, v); if (cache.size > cacheMax) cache.delete(cache.keys().next().value); };
  const today = () => new Date(Date.now() + 9 * 3600_000).toISOString().slice(0, 10);
  /** 단어 확인 → { noun, def } · 못 물어보면(꺼짐·상한·오류·시간 초과) null */
  async function lookup(w) {
    if (!on || typeof w !== "string" || !HANGUL.test(w)) return null;
    if (cache.has(w)) return cache.get(w);
    if (flying.has(w)) return flying.get(w);
    if (Date.now() < downUntil) return null;
    const d = today(); if (d !== day) { day = d; used = 0; }
    if (used >= dailyMax) return null; used++;
    const p = (async () => {
      const ac = new AbortController(), timer = setTimeout(() => ac.abort(), timeoutMs);
      try {
        const u = `${URL_SEARCH}?key=${key}&q=${encodeURIComponent(w)}&req_type=json&num=100&start=1&advanced=y&method=exact`;
        const res = await fetchImpl(u, { signal: ac.signal, headers: { accept: "application/json" } });
        if (!res.ok) throw new Error("HTTP " + res.status);
        const text = await res.text(); let json = {};
        if (text.trim()) { try { json = JSON.parse(text); } catch { throw new Error("BAD_JSON"); } }
        if (json?.error) throw new Error("API " + (json.error.error_code || "") + " " + (json.error.message || ""));
        const v = parseOpen(json, w); put(w, v); fails = 0; return v;
      } catch (e) {
        if (++fails >= 5) { downUntil = Date.now() + 60_000; fails = 0; console.warn("[wd-api] 사전 API 1분 쉼:", e.message); }
        return null;
      } finally { clearTimeout(timer); flying.delete(w); }
    })();
    flying.set(w, p); return p;
  }
  return { on, lookup, known: (w) => cache.get(w) || null, stats: () => ({ on, day, used, cached: cache.size }) };
}
