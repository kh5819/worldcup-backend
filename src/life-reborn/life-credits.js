// =========================
// 플듀 인생게임 REBORN — 엔딩 크레딧 (2026-11-23)
// 결말이 열리면 자서전을 짧게 요약해 영화 엔딩 크레딧처럼 아래에서 위로 천천히 올린다.
// 모든 줄은 실제 결말 기록(E = buildEnding 결과)에서만 가져온다 (없는 이야기 만들지 않음).
// =========================
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
/** 문단 → 앞 두 문장 */
function gist(p, n = 2) { const parts = String(p || "").split(/(?<=[.!?。！？])\s+|(?<=다\.)\s*/).filter(Boolean); return parts.slice(0, n).join(" ").slice(0, 220); }

/**
 * 크레딧 줄 만들기. extra: { t(key), friends:[{name, by, dy, job}], history:[{y, title, real, fiction}], words:[], album:[img…] }
 */
export function creditLines(E, extra = {}) {
  const t = extra.t || ((k) => k), out = [];
  const H = (s) => out.push({ k: "h", s }), Pp = (s) => out.push({ k: "p", s }), Gp = () => out.push({ k: "gap" });
  out.push({ k: "big", s: E.title }); if (E.sub) Pp(E.sub); Gp();
  H(t("credits.starring")); out.push({ k: "name", s: E.profile?.name || "" }); if (E.deathLine) Pp(E.deathLine); Gp();
  for (const ch of E.chapters || []) { if (!ch.paras?.length) continue; H(ch.title); if (ch.sub) out.push({ k: "sub", s: ch.sub }); Pp(gist(ch.paras[0])); if (ch.paras[1]) Pp(gist(ch.paras[1], 1)); Gp(); }
  if (extra.album?.length) out.push({ k: "album", imgs: extra.album.slice(0, 8) });
  const ppl = E.sec?.people?.list || [];
  if (ppl.length) { H(t("credits.with")); for (const x of ppl.slice(0, 18)) out.push({ k: "row", a: x.rel, b: x.name }); Gp(); }
  if (extra.friends?.length) { H(t("credits.born")); for (const f of extra.friends) out.push({ k: "row", a: `${f.by}–${f.dy ?? ""}`, b: `${f.name}${f.job ? " · " + f.job : ""}` }); Gp(); }
  const pets = E.sec?.family?.pets || [];
  if (pets.length) { H(t("credits.pets")); for (const x of pets) out.push({ k: "row", a: `${x.from}–${x.to ?? ""}`, b: x.name }); Gp(); }
  if (extra.history?.length) { H(t("credits.era")); for (const h of extra.history.slice(0, 14)) out.push({ k: "row", a: String(h.y), b: h.title }); Gp(); }
  if (E.letter?.text) { H("✉️ " + (E.letter.to || "")); out.push({ k: "quote", s: E.letter.text.slice(0, 260) }); Gp(); }
  const last = extra.lastWords; if (last) { out.push({ k: "quote", s: last }); Gp(); }
  out.push({ k: "big", s: t("credits.end") }); Pp(t("credits.thanks")); Pp("PlayDuo · playduo.kr");
  return out;
}
/** 크레딧 재생: box(.lr-credits) 안의 roll 을 아래에서 위로. 끝나면 onEnd */
export function playCredits(box, roll, lines, { onEnd, still } = {}) {
  roll.innerHTML = lines.map((l) => l.k === "gap" ? `<div class="cr-gap"></div>` : l.k === "album" ? `<div class="cr-album">${l.imgs.map((a) => `<img src="${a.img}" alt="">`).join("")}</div>` : l.k === "row" ? `<div class="cr-row"><span>${esc(l.a)}</span><b>${esc(l.b)}</b></div>` : l.k === "quote" ? `<q class="cr-quote">${esc(l.s)}</q>` : `<div class="cr-${l.k}">${esc(l.s)}</div>`).join("");
  box.hidden = false;
  const h = roll.scrollHeight, vh = box.clientHeight || window.innerHeight, dur = Math.max(30, Math.min(150, (h + vh) / 38));
  roll.style.transition = "none"; roll.style.transform = `translateY(${vh}px)`;
  void roll.offsetWidth;
  if (still) { roll.style.transform = "translateY(0)"; box.classList.add("still"); }
  else { roll.style.transition = `transform ${dur}s linear`; roll.style.transform = `translateY(${-h}px)`; }
  const done = () => { clearTimeout(tm); box.hidden = true; roll.style.transition = "none"; onEnd?.(); };
  const tm = still ? 0 : setTimeout(done, dur * 1000 + 400);
  return { stop: done };
}
