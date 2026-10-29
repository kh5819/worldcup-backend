// 움직이는 원본 ↔ 지금 쓰이는 압축본 짝 찾기 (읽기 전용). 그림을 16x16으로 줄여 비교.
import fs from "fs";
import sharp from "sharp";
import { createClient } from "@supabase/supabase-js";
const env = Object.fromEntries(fs.readFileSync(".env", "utf8").split(/\r?\n/).filter((l) => l.includes("=") && !l.startsWith("#")).map((l) => { const i = l.indexOf("="); return [l.slice(0, i).trim(), l.slice(i + 1).trim().replace(/^["']|["']$/g, "")]; }));
const db = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
const SP = "C:/Users/user/AppData/Local/Temp/claude/D--worldcup-project/1cee161c-d303-4b0b-9e99-db1680805fd1/scratchpad";
const anim = JSON.parse(fs.readFileSync(`${SP}/anim-list.json`, "utf8"));
const sig = async (url) => { const b = Buffer.from(await (await fetch(url)).arrayBuffer()); return sharp(b, { pages: 1 }).resize(16, 16, { fit: "fill" }).removeAlpha().raw().toBuffer(); };
const diff = (a, b) => { let s = 0; for (let i = 0; i < a.length; i++) s += Math.abs(a[i] - b[i]); return s / a.length; };
// 지금 쓰이는 압축본 후보 모으기: 월드컵 후보·퀴즈·티어 카드 중 migrated URL
const cands = [];
{ const { data } = await db.from("worldcup_candidates").select("id,content_id,media_url").like("media_url", "%/migrated/%").limit(5000); for (const r of data || []) cands.push({ table: "worldcup_candidates", id: r.id, content: r.content_id, col: "media_url", url: r.media_url }); }
{ const { data } = await db.from("quiz_questions").select("id,content_id,media_url,reveal_media_url").or("media_url.like.%/migrated/%,reveal_media_url.like.%/migrated/%").limit(5000); for (const r of data || []) for (const col of ["media_url", "reveal_media_url"]) if (r[col]?.includes("/migrated/")) cands.push({ table: "quiz_questions", id: r.id, content: r.content_id, col, url: r[col] }); }
{ const { data } = await db.from("tier_templates").select("id,cards"); for (const t of data || []) for (const c of t.cards || []) if (String(c.image_url || "").includes("/migrated/")) cands.push({ table: "tier_templates", id: t.id, content: t.id, col: `card:${c.id}`, url: c.image_url }); }
console.log("압축본 후보", cands.length);
const out = [];
for (const a of anim) {
  const folder = a.name.split("/")[2]; // 콘텐츠 id 폴더
  const sa = await sig(a.url).catch(() => null); if (!sa) continue;
  // 같은 콘텐츠 폴더 후보 먼저, 없으면 전체(티어 변환본 등)
  const pool = cands.filter((c) => c.content === folder);
  const all = pool.length ? [...pool, ...cands.filter((c) => c.table === "tier_templates")] : cands;
  const scored = [];
  for (const c of all) { try { const sc = await sig(c.url); const d = diff(sa, sc); if (d < 18) scored.push({ ...c, d: Math.round(d * 10) / 10 }); } catch {} }
  scored.sort((x, y) => x.d - y.d);
  out.push({ original: a.url, matches: scored.slice(0, 6) });
  console.log(a.name.slice(-46), "→", scored.length ? scored.slice(0, 4).map((m) => `${m.table}:${m.col}(${m.d})`).join(" | ") : "짝 없음 (콘텐츠 삭제 등)");
}
fs.writeFileSync(`${SP}/anim-pairs.json`, JSON.stringify(out, null, 1));
