// 움직이는 WebP/PNG(APNG) 찾기 — 읽기 전용. 파일 앞부분만 받아 애니메이션 표시를 확인한다.
import fs from "fs";
import { createClient } from "@supabase/supabase-js";
const env = Object.fromEntries(fs.readFileSync("D:/worldcup-project/worldcup-backend/.env", "utf8").split(/\r?\n/).filter((l) => l.includes("=") && !l.startsWith("#")).map((l) => { const i = l.indexOf("="); return [l.slice(0, i).trim(), l.slice(i + 1).trim().replace(/^["']|["']$/g, "")]; }));
const URL_ = env.SUPABASE_URL, KEY = env.SUPABASE_SERVICE_ROLE_KEY || env.SUPABASE_SERVICE_KEY;
const db = createClient(URL_, KEY, { auth: { persistSession: false } });
const rows = [];
// 저장소 폴더를 따라 내려가며 파일 목록을 모은다 (읽기 전용)
async function walk(bucket, prefix) {
  for (let off = 0; ; off += 1000) {
    const { data, error } = await db.storage.from(bucket).list(prefix, { limit: 1000, offset: off });
    if (error) { console.error("목록 오류", bucket, prefix, error.message); return; }
    const subs = [];
    for (const it of data) {
      const path = prefix ? `${prefix}/${it.name}` : it.name;
      if (it.id === null) subs.push(path);
      else if (/\.(webp|png)$/i.test(it.name)) rows.push({ bucket_id: bucket, name: path, metadata: it.metadata || {} });
    }
    for (let i = 0; i < subs.length; i += 8) await Promise.all(subs.slice(i, i + 8).filter((x) => !x.includes("/migrated") && !x.endsWith("migrated")).map((x) => walk(bucket, x)));
    if (data.length < 1000) break;
  }
}
await walk("ugc-media", ""); await walk("thumbnails", "");
const big = rows.filter((r) => Number(r.metadata?.size || 0) > 300 * 1024 && !r.name.includes("/migrated/"));
console.log("검사 대상", big.length, "/ 전체", rows.length);
const anim = [];
let i = 0;
async function check(r) {
  const u = `${URL_}/storage/v1/object/public/${r.bucket_id}/${r.name.split("/").map(encodeURIComponent).join("/")}`;
  try {
    const res = await fetch(u, { headers: { Range: "bytes=0-4095" } });
    const b = Buffer.from(await res.arrayBuffer());
    let isAnim = false, kind = "";
    if (b.slice(0, 4).toString() === "RIFF" && b.slice(8, 12).toString() === "WEBP") { kind = "webp"; isAnim = b.slice(12, 16).toString() === "VP8X" && (b[20] & 0x02) !== 0; }
    else if (b[0] === 0x89 && b.slice(1, 4).toString() === "PNG") { kind = "png"; isAnim = b.indexOf("acTL") > 0 && (b.indexOf("IDAT") < 0 || b.indexOf("acTL") < b.indexOf("IDAT")); }
    else if (b.slice(0, 3).toString() === "GIF") { kind = "gif(확장자만 다름)"; isAnim = true; }
    if (isAnim) anim.push({ bucket: r.bucket_id, name: r.name, kind, size: Number(r.metadata.size), url: u });
  } catch (e) { console.error("읽기 실패", r.name, e.message); }
}
const q = big.slice();
await Promise.all(Array.from({ length: 12 }, async () => { while (q.length) { await check(q.shift()); if (++i % 500 === 0) console.log("  진행", i); } }));
fs.writeFileSync("C:/Users/user/AppData/Local/Temp/claude/D--worldcup-project/1cee161c-d303-4b0b-9e99-db1680805fd1/scratchpad/anim-list.json", JSON.stringify(anim, null, 1));
const by = {}; for (const a of anim) by[a.kind] = (by[a.kind] || 0) + 1;
console.log("움직이는 파일:", anim.length, JSON.stringify(by));
