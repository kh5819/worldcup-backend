// 인생 방송국 서버 저장 시험 (가짜 DB — 운영 DB 안 씀) — node scripts/test-lifebc-save.mjs
import http from "http";
import express from "express";
import { Server } from "socket.io";
import ioc from "socket.io-client";
import { gzipSync } from "zlib";
import { registerLifeSave, inspectSave } from "../src/lifebc-save.js";

let fail = 0, pass = 0; const ok = (c, m) => { if (c) pass++; else { fail++; console.log("FAIL", m); } };

// 아주 작은 가짜 supabase: lifebc_saves 한 테이블만
function fakeDb({ missing = false } = {}) {
  const rows = new Map(); const K = (r) => r.owner_key + "|" + r.slot;
  const err = missing ? { code: "PGRST205", message: "Could not find the table 'public.lifebc_saves' in the schema cache" } : null;
  return { rows, from(t) {
    const q = { f: [], cols: null, ord: null };
    const run = () => [...rows.values()].filter((r) => q.f.every(([k, v]) => r[k] === v));
    const pick = (r) => (q.cols ? Object.fromEntries(q.cols.split(",").map((c) => c.trim()).map((c) => [c, r[c]])) : r);
    const api = {
      select(c) { q.cols = c; return api; }, eq(k, v) { q.f.push([k, v]); return api; }, order(k) { q.ord = k; return api; },
      maybeSingle() { if (err) return Promise.resolve({ data: null, error: err }); const r = run()[0]; return Promise.resolve({ data: r ? pick(r) : null, error: null }); },
      then(res, rej) { if (err) return Promise.resolve({ data: null, error: err }).then(res, rej); let d = run(); if (q.del) { for (const r of d) rows.delete(K(r)); d = null; } else { if (q.ord) d.sort((a, b) => a[q.ord] - b[q.ord]); d = d.map(pick); } return Promise.resolve({ data: d, error: null }).then(res, rej); },
      upsert(row) { if (err) return Promise.resolve({ error: err }); rows.set(K(row), { ...row }); return Promise.resolve({ error: null }); },
      delete() { q.del = true; return api; },
    };
    return api;
  } };
}

async function boot(sb) {
  const app = express(), server = http.createServer(app), io = new Server(server, { allowEIO3: true });
  io.use((s, next) => { const id = String(s.handshake.query.uid); s.user = { id, isGuest: id.startsWith("guest_") }; next(); });
  registerLifeSave(io, sb); await new Promise((r) => server.listen(0, r));
  const URL = `http://localhost:${server.address().port}`;
  const conn = (id) => new Promise((res) => { const s = ioc(URL, { query: { uid: id }, transports: ["websocket"], forceNew: true, reconnection: false }); s.on("connect", () => res(s)); });
  return { server, conn };
}
const emit = (s, ev, p) => new Promise((res) => s.emit(ev, p, res));
const save = (o = {}) => JSON.stringify({ ver: 3, stationName: { ko: "플듀 방송국", en: "PlayDuo TV" }, mode: "story", day: 12, money: 3456, cast: [{ id: "a" }], rels: {}, ...o });

// 형식 검사
ok(inspectSave(save()).meta.station_name === "플듀 방송국" && inspectSave(save()).meta.day === 12, "메타는 서버가 직접 뽑음");
ok(inspectSave("{bad").error === "BAD_JSON", "깨진 JSON 거절");
ok(inspectSave(JSON.stringify({ hello: 1 })).error === "BAD_SHAPE", "게임 상태가 아니면 거절");
ok(inspectSave(save({ pad: "x".repeat(460000) })).error === "TOO_BIG", "450KB 넘으면 거절");
ok(inspectSave(save({ mode: "hack", day: -5 })).meta.mode === "story" && inspectSave(save({ day: -5 })).meta.day === 1, "이상한 값은 정리");

// 정상 흐름
{
  const db = fakeDb(); const { server, conn } = await boot(db);
  const G = await conn("guest_abc123"); ok((await emit(G, "lbs:list", {})).error === "NEED_LOGIN", "게스트는 서버 저장 못 함");
  const U = await conn("user-1111"), V = await conn("user-2222");
  ok((await emit(U, "lbs:list", {})).slots.length === 0, "처음엔 빈 목록");
  const s1 = await emit(U, "lbs:save", { slot: 1, json: save() }); ok(s1.ok && s1.meta.day === 12, "1번 칸 저장");
  ok((await emit(U, "lbs:save", { slot: 1, json: save({ day: 13 }) })).error === "TOO_SOON", "같은 칸 연속 저장은 잠깐 막음");
  ok((await emit(U, "lbs:save", { slot: 0, json: save({ day: 13 }) })).ok, "자동 칸(0) 저장");
  ok((await emit(U, "lbs:save", { slot: 4, json: save() })).error === "BAD_SLOT", "없는 칸 거절");
  ok((await emit(U, "lbs:save", { slot: 2, json: "{}" })).error === "BAD_SHAPE", "엉터리 내용 거절");
  const L = await emit(U, "lbs:list", {}); ok(L.slots.length === 2 && L.slots[0].slot === 0 && !("data" in L.slots[0]), "목록 (칸 순서·내용은 안 보냄)");
  const ld = await emit(U, "lbs:load", { slot: 1 }); ok(ld.ok && JSON.parse(ld.json).day === 12, "불러오기");
  ok((await emit(V, "lbs:load", { slot: 1 })).error === "EMPTY", "다른 회원 저장은 못 봄");
  ok((await emit(U, "lbs:delete", { slot: 1 })).ok && (await emit(U, "lbs:list", {})).slots.length === 1, "삭제");
  ok([...db.rows.values()].every((r) => r.owner_key.startsWith("u:") && r.user_id), "회원 키·아이디로만 저장");
  // 압축 저장: 450KB 넘는 원본도 저장·불러오기 왕복, 메타는 푼 내용에서, 망가진 압축·압축 폭탄 거절
  const big = save({ day: 77, pad: "방송국 기록 ".repeat(35000) }), gz64 = (t) => gzipSync(Buffer.from(t, "utf8")).toString("base64");
  ok(Buffer.byteLength(big) > 450000, "시험 데이터가 450KB 초과");
  ok((await emit(U, "lbs:save", { slot: 3, json: big })).error === "TOO_BIG", "압축 없이 큰 데이터는 거절");
  const sg = await emit(U, "lbs:save", { slot: 3, gz: gz64(big) }); ok(sg.ok && sg.meta.day === 77 && sg.meta.bytes < 450000, "압축하면 큰 저장도 성공");
  const lg = await emit(U, "lbs:load", { slot: 3 }); ok(lg.ok && lg.json === big, "압축 저장 불러오기는 원본 그대로");
  ok((await emit(U, "lbs:save", { slot: 2, gz: "이건압축이아님" })).error === "BAD_GZ", "망가진 압축 거절");
  ok((await emit(U, "lbs:save", { slot: 2, gz: gz64(save({ pad: "x".repeat(4100000) })) })).error === "TOO_BIG", "압축 폭탄(4MB 초과) 거절");
  ok((await emit(U, "lbs:save", { slot: 2, gz: gz64(JSON.stringify({ hello: 1 })) })).error === "BAD_SHAPE", "압축해도 형식 검사");
  for (const s of [G, U, V]) s.disconnect(); server.close();
}
// 테이블이 아직 없을 때 → 조용히 NO_TABLE
{
  const { server, conn } = await boot(fakeDb({ missing: true }));
  const U = await conn("user-3333");
  ok((await emit(U, "lbs:list", {})).error === "NO_TABLE", "테이블 없으면 NO_TABLE (목록)");
  ok((await emit(U, "lbs:save", { slot: 1, json: save() })).error === "NO_TABLE", "테이블 없으면 NO_TABLE (저장)");
  U.disconnect(); server.close();
}
console.log(`통과 ${pass} · 실패 ${fail}`); process.exit(fail ? 1 : 0);
