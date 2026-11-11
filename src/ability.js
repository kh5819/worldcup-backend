// =========================
// 플듀 종합 능력 프로필 (ability:*) — 진단소 결과를 내 것만 모아서 보여 줌
// 2026-11-11 심리전·게임 종합 진단소 삭제 때 mind.js에서 떼어 냄 (DB: ability_profiles, 각 진단소 *_results 읽기만)
// =========================
import { memberProfile, userKey } from "./iq.js";

export function registerAbility(io, supabaseAdmin) {
  const sb = supabaseAdmin;
  io.on("connection", (socket) => {
    const me = socket.user; if (!me) return;
    const key = userKey(me);
    let win = Date.now(), cnt = 0;
    const limited = () => { const n = Date.now(); if (n - win > 10000) { win = n; cnt = 0; } return ++cnt > Number(process.env.ABILITY_RL || 30); };
    const on = (ev, fn) => socket.on(ev, async (p, cb) => {
      const reply = typeof cb === "function" ? cb : () => {};
      if (limited()) return reply({ ok: false, error: "RATE_LIMITED" });
      try { await fn(p || {}, reply); } catch (e) { console.error(`[${ev}]`, e); reply({ ok: false, error: "INTERNAL" }); }
    });
    // ---------- 플듀 종합 능력 프로필: 세 진단소 결과를 내 것만 모아서 ----------
    on("ability:overview", async (_p, reply) => {
      const out = { ok: true, isGuest: !!me.isGuest, clinic: null, iq: null, sense: null, know: null, feel: null, lingo: null, rep: null, titles: [] };
      if (!sb) return reply(out);
      const mp = await memberProfile(sb, me); out.member = mp;
      try { const { data } = await sb.from("clinic_results").select("id, mode, total, phys, diag, created_at").eq("owner_key", key).order("created_at", { ascending: false }).limit(50);
        if (data?.length) { const best = [...data].sort((a, b) => b.total - a.total)[0]; out.clinic = { count: data.length, latest: { id: data[0].id, mode: data[0].mode, total: data[0].total, phys: data[0].phys, title: data[0].diag?.title || null, at: data[0].created_at }, best: { id: best.id, total: best.total, phys: best.phys, mode: best.mode, title: best.diag?.title || null, at: best.created_at } }; } } catch (e) { console.warn("[ability] clinic", e?.message); }
      try { const { data } = await sb.from("iq_results").select("id, mode, total, iq, areas, diag, created_at").eq("owner_key", key).order("created_at", { ascending: false }).limit(50);
        if (data?.length) { const best = [...data].sort((a, b) => b.iq - a.iq)[0]; out.iq = { count: data.length, latest: { id: data[0].id, mode: data[0].mode, iq: data[0].iq, total: data[0].total, title: data[0].diag?.title || null, at: data[0].created_at }, best: { id: best.id, iq: best.iq, total: best.total, mode: best.mode, title: best.diag?.title || null, at: best.created_at } }; for (const r of data) for (const t of r.diag?.titles || []) if (t?.name && !out.titles.some((x) => x.name === t.name)) out.titles.push({ name: t.name, from: "iq" }); } } catch (e) { console.warn("[ability] iq", e?.message); }
      // 게임 센스: 공식 최고는 의심 기록 제외. 빠른·정밀 점수 척도는 같지만 정밀이 더 정확하다는 표시를 붙임
      try { const { data } = await sb.from("sense_results").select("id, mode, total, tier, style, areas, flagged, created_at").eq("owner_key", key).order("created_at", { ascending: false }).limit(50);
        if (data?.length) { const ok = data.filter((r) => !r.flagged), best = [...(ok.length ? ok : data)].sort((a, b) => b.total - a.total)[0]; const pub = (r) => ({ id: r.id, mode: r.mode, total: r.total, tier: r.tier, style: r.style, areas: r.areas, flagged: !!r.flagged, at: r.created_at }); out.sense = { count: data.length, latest: pub(data[0]), best: pub(best) };
          const TN = { iron: "아이언", bronze: "브론즈", silver: "실버", gold: "골드", platinum: "플래티넘", emerald: "에메랄드", diamond: "다이아몬드", master: "마스터", grandmaster: "그랜드마스터", challenger: "챌린저" }; if (ok.length && TN[best.tier]) out.titles.push({ name: `게임 센스 ${TN[best.tier]}`, from: "sense" }); } } catch (e) { console.warn("[ability] sense", e?.message); }
      // 상식 레벨: 연습(weak)·순위 제외 기록은 최고 기록에서 빼고, 같은 기준(빠른·정밀)끼리 섞지 않도록 모드 표시
      try { const { data: raw } = await sb.from("know_results").select("id, mode, area, total, lv, type_id, diag->type, diag->titles, flagged, created_at").eq("owner_key", key).order("created_at", { ascending: false }).limit(60);
        const data = (raw || []).filter((r) => r.mode !== "weak");
        if (data?.length) { const ok = data.filter((r) => !r.flagged), best = [...(ok.length ? ok : data)].sort((a, b) => b.total - a.total)[0]; const pub = (r) => ({ id: r.id, mode: r.mode, area: r.area, total: r.total, lv: r.lv, type: r.type?.name || null, typeId: r.type_id, at: r.created_at }); out.know = { count: data.length, latest: pub(data[0]), best: pub(best) };
          for (const r of data) for (const t of r.titles || []) if (t?.name && !out.titles.some((x) => x.name === t.name)) out.titles.push({ name: t.name, from: "know" }); } } catch (e) { console.warn("[ability] know", e?.message); }
      // 감각 진단소: 전체 검사만 종합 최고로 (개별 검사는 검사 하나라 비교 기준이 다름) · 의심 기록 제외 · 난이도 함께 표시
      try { const { data } = await sb.from("feel_results").select("id, mode, diff, total, tier, style, done, flagged, created_at").eq("owner_key", key).order("created_at", { ascending: false }).limit(60);
        const full = (data || []).filter((r) => r.mode === "full");
        if (full.length) { const ok = full.filter((r) => !r.flagged), DR = { expert: 3, hard: 2, normal: 1 }, best = [...(ok.length ? ok : full)].sort((a, b) => (DR[b.diff] || 0) - (DR[a.diff] || 0) || b.total - a.total)[0]; const pub = (r) => ({ id: r.id, mode: r.mode, diff: r.diff, total: r.total, tier: r.tier, style: r.style, done: r.done, flagged: !!r.flagged, at: r.created_at }); out.feel = { count: data.length, latest: pub(full[0]), best: pub(best) };
          const DN = { normal: "보통", hard: "어려움", expert: "전문가" }; if (ok.length && ["SSS", "SS", "S"].includes(best.tier)) out.titles.push({ name: `감각 ${best.tier} (${DN[best.diff] || "보통"})`, from: "feel" }); } } catch (e) { console.warn("[ability] feel", e?.message); }
      // 언어 진단소: 언어마다 문제가 달라 점수를 서로 비교하지 않음 → 언어별 최고(종합 진단만, 연습·친구 도전·대결 기록 제외) + 그중 하나를 대표로
      try { const { data } = await sb.from("lingo_results").select("id, lang, mode, diff, total, grade, type_id, diag->titles, flagged, created_at").eq("owner_key", key).order("created_at", { ascending: false }).limit(80);
        const rows = data || [], ok = rows.filter((r) => !r.flagged && r.mode === "full");
        if (rows.length) {
          const DR = { expert: 3, hard: 2, normal: 1 }, pick = (a) => [...a].sort((x, y) => (DR[y.diff] || 0) - (DR[x.diff] || 0) || y.total - x.total)[0];
          const pub = (r) => ({ id: r.id, lang: r.lang, mode: r.mode, diff: r.diff, total: r.total, grade: r.grade, typeId: r.type_id, flagged: !!r.flagged, at: r.created_at });
          const langs = {}; for (const L of ["ko", "ja", "en"]) { const b = pick(ok.filter((r) => r.lang === L)); if (b) langs[L] = pub(b); }
          const best = pick(ok) || pick(rows.filter((r) => !r.flagged)) || rows[0];
          out.lingo = { count: rows.length, best: pub(best), langs, official: ok.length > 0 };
          const LN = { ko: "한국어", ja: "일본어", en: "영어" }, DN = { normal: "보통", hard: "어려움", expert: "전문가" };
          for (const b of Object.values(langs)) if (["SSS", "SS", "S"].includes(b.grade)) out.titles.push({ name: `${LN[b.lang]} ${b.grade} (${DN[b.diff] || "보통"})`, from: "lingo" });
          for (const r of ok) for (const t of r.titles || []) if (t?.name && !out.titles.some((x) => x.name === t.name)) out.titles.push({ name: t.name, from: "lingo" });
        } } catch (e) { console.warn("[ability] lingo", e?.message); }
      try { const { data } = await sb.from("ability_profiles").select("rep_kind, rep_id, rep_title").eq("owner_key", key).maybeSingle(); out.rep = data || null; } catch {}
      out.titles = out.titles.slice(0, 40);
      reply(out);
    });
    // 대표 진단서·대표 칭호: 내 기록만 지정 가능
    on("ability:setRep", async (p, reply) => {
      if (!sb) return reply({ ok: false, error: "NO_DB" });
      const kind = ["clinic", "iq", "sense", "know", "feel", "lingo"].includes(p.kind) ? p.kind : null, id = kind ? String(p.id || "").slice(0, 16) : null;
      if (kind) { const { data } = await sb.from(`${kind}_results`).select("id").eq("id", id).eq("owner_key", key).maybeSingle(); if (!data) return reply({ ok: false, error: "NOT_MINE" }); }
      const row = { owner_key: key, user_id: me.isGuest ? null : me.id, rep_kind: kind, rep_id: id, rep_title: p.title ? String(p.title).replace(/[<>]/g, "").slice(0, 30) : null, updated_at: new Date().toISOString() };
      const { error } = await sb.from("ability_profiles").upsert(row, { onConflict: "owner_key" });
      reply(error ? { ok: false, error: "UPDATE_FAIL" } : { ok: true });
    });
  });
}
