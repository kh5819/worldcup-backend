// scripts/compress-existing-media.js
//
// 기존에 이미 업로드된 월드컵 후보/티어 카드/퀴즈 문제/썸네일 이미지를
// 압축본으로 교체하는 1회성 마이그레이션 스크립트.
//
// 안전 원칙:
//   - 원본 파일은 절대 삭제하지 않음. 새 압축 파일을 "<bucket>/.../migrated/..." 경로에
//     따로 올리고, DB의 URL 컬럼만 새 파일로 갈아끼운다.
//   - 실루엣 변환(silhouette.js)이 PNG 알파에 의존하므로, 실제 투명 픽셀이 있는 이미지는
//     절대 JPEG로 바꾸지 않는다 (image-compress.20261016_1.js 클라이언트 로직과 동일 규칙).
//   - 외부 URL(유튜브/치지직/SOOP/네이버/Imgur 등)은 건드리지 않음 — supabase storage URL만 대상.
//   - 이미 마이그레이션된 항목("/migrated/" 포함 URL)은 재실행 시 자동 스킵 → 안전하게 재실행 가능.
//   - 압축 결과가 원본보다 크거나 같으면 교체하지 않음.
//
// 사용법:
//   node scripts/compress-existing-media.js --dry-run --limit=5        (미리보기, 변경 없음)
//   node scripts/compress-existing-media.js --limit=20                 (실제로 20건만 처리)
//   node scripts/compress-existing-media.js                            (전체 처리)
//   node scripts/compress-existing-media.js --only=worldcup            (worldcup_candidates만)
//   --only= worldcup | thumbnails | quiz | tier | extra
//   extra = 멀티 티어 결과(tier_multi_results)·티어 인스턴스·프로필 사진·빙고·심리테스트·한줄평 우승 썸네일·명예의 전당·커뮤니티 글
//           (행의 모든 컬럼에서 '값 전체가 우리 storage 이미지 URL'인 문자열만 찾아 교체. JSON 안쪽도 탐색. 같은 URL은 1번만 압축)

import "dotenv/config";
import { createClient } from "@supabase/supabase-js";
import sharp from "sharp";
import { createHash } from "node:crypto";

const SUPABASE_URL = process.env.SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error("SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY 환경변수가 필요합니다 (.env 확인).");
  process.exit(1);
}
const supabase = createClient(SUPABASE_URL, SERVICE_KEY);

const args = process.argv.slice(2);
const DRY_RUN = args.includes("--dry-run");
const limitArg = args.find((a) => a.startsWith("--limit="));
const LIMIT = limitArg ? parseInt(limitArg.split("=")[1], 10) : Infinity;
const onlyArg = args.find((a) => a.startsWith("--only="));
const ONLY = onlyArg ? onlyArg.split("=")[1] : null;
const contentIdArg = args.find((a) => a.startsWith("--content-id="));
const CONTENT_ID = contentIdArg ? contentIdArg.split("=")[1] : null;
const topArg = args.find((a) => a.startsWith("--top="));
const TOP_N = topArg ? parseInt(topArg.split("=")[1], 10) : null;
const topModeArg = args.find((a) => a.startsWith("--top-mode="));
const TOP_MODE = topModeArg ? topModeArg.split("=")[1] : "worldcup"; // contents.mode 값

// --top=N 지정 시: play_count(인기순) 상위 N개 콘텐츠 id만 대상으로 함
let CONTENT_IDS = null; // null이면 전체, 배열이면 그 콘텐츠들만
async function resolveTopContentIds() {
  if (CONTENT_ID) { CONTENT_IDS = [CONTENT_ID]; return; }
  if (!TOP_N) return;
  const { data, error } = await supabase
    .from("contents")
    .select("id, title, play_count")
    .eq("mode", TOP_MODE)
    .order("play_count", { ascending: false })
    .limit(TOP_N);
  if (error) throw error;
  CONTENT_IDS = data.map((r) => r.id);
  console.log(`[--top=${TOP_N}] 인기순 상위 ${CONTENT_IDS.length}개 콘텐츠 선정 (mode=${TOP_MODE})`);
  console.log(`  1위: "${data[0]?.title}" (play_count=${data[0]?.play_count})`);
  console.log(`  ${CONTENT_IDS.length}위: "${data[data.length - 1]?.title}" (play_count=${data[data.length - 1]?.play_count})`);
}

const MAX_DIM = 1280;
const JPEG_QUALITY = 85;
const SKIP_UNDER_BYTES = 300 * 1024;
const BUCKET_MEDIA = "ugc-media";
const BUCKET_THUMBNAILS = "thumbnails";

const stats = {
  scanned: 0, skippedExternal: 0, skippedSmall: 0, skippedAlreadyDone: 0,
  skippedGif: 0, skippedNoGain: 0, compressed: 0, errors: 0,
  bytesBefore: 0, bytesAfter: 0,
};

function isOwnStorageUrl(url) {
  return typeof url === "string" && url.includes("supabase.co/storage/");
}
function isAlreadyMigrated(url) {
  return typeof url === "string" && url.includes("/migrated/");
}

async function fetchAllRows(table, applyFilters, columns = "*") {
  const PAGE = 1000;
  let all = [];
  for (let from = 0; ; from += PAGE) {
    let q = supabase.from(table).select(columns);
    q = applyFilters(q);
    const { data, error } = await q.range(from, from + PAGE - 1);
    if (error) throw error;
    if (!data || data.length === 0) break;
    all = all.concat(data);
    if (data.length < PAGE) break;
  }
  return all;
}

async function runPool(items, worker, concurrency = 6) {
  let cursor = 0;
  const run = async () => {
    while (cursor < items.length) {
      const item = items[cursor++];
      await worker(item);
    }
  };
  await Promise.all(Array.from({ length: Math.min(concurrency, items.length) }, run));
}

/**
 * URL의 이미지를 다운로드해 압축. 압축할 필요 없거나 효과 없으면 null.
 */
const FETCH_TIMEOUT_MS = 20000; // 응답 없이 멈추는 요청이 워커 풀 전체를 막아버리는 것 방지

async function fetchWithRetry(url, retries = 2) {
  let lastErr;
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const resp = await fetch(url, { signal: AbortSignal.timeout(FETCH_TIMEOUT_MS) });
      if (resp.ok) return resp;
      lastErr = new Error(`다운로드 실패 (${resp.status})`);
    } catch (e) {
      lastErr = e?.name === "TimeoutError" ? new Error(`다운로드 타임아웃 (${FETCH_TIMEOUT_MS}ms)`) : e;
    }
    if (attempt < retries) await new Promise((r) => setTimeout(r, 800 * (attempt + 1)));
  }
  throw lastErr;
}

/** HEAD로 파일 크기만 확인 (본문 다운로드 없음). 알 수 없으면 null → 기존처럼 다운로드해서 판단 */
async function headSize(url) {
  try {
    const resp = await fetch(url, { method: "HEAD", signal: AbortSignal.timeout(FETCH_TIMEOUT_MS) });
    if (!resp.ok) return null;
    const len = Number(resp.headers.get("content-length"));
    return Number.isFinite(len) && len > 0 ? len : null;
  } catch {
    return null;
  }
}

// 진행률: "압축된 개수"만 보면 스킵 구간에서 멈춘 것처럼 보임 → 처리(스캔) 건수 기준으로 주기 출력
let processedCount = 0;
let progressTotal = 0;
function tickProgress() {
  processedCount++;
  if (processedCount % 500 === 0 || processedCount === progressTotal) {
    console.log(`  … 진행 ${processedCount}/${progressTotal} (압축 ${stats.compressed}, 작아서 스킵 ${stats.skippedSmall}, 효과없음 ${stats.skippedNoGain}, 오류 ${stats.errors})`);
  }
}

async function compressUrl(url) {
  const resp = await fetchWithRetry(url);
  const buf = Buffer.from(await resp.arrayBuffer());
  stats.scanned++;

  if (buf.length <= SKIP_UNDER_BYTES) { stats.skippedSmall++; return null; }

  const img = sharp(buf);
  const meta = await img.metadata();
  if (meta.format === "gif") { stats.skippedGif++; return null; } // 애니메이션 보존

  let hasAlpha = false;
  if (meta.hasAlpha) {
    try {
      const st = await img.stats();
      const alphaCh = st.channels[3];
      hasAlpha = !!alphaCh && alphaCh.min < 250;
    } catch {
      hasAlpha = true; // 판정 실패 시 안전하게 "있다"고 가정 (실루엣 깨짐보다 용량 손해가 안전)
    }
  }

  const needsResize = meta.width > MAX_DIM || meta.height > MAX_DIM;
  // 크기는 작은데 용량만 큰 불투명 이미지(불투명 PNG, 고화질 JPEG 등)도 JPEG 재인코딩 대상.
  // 투명 이미지는 리사이즈가 필요할 때만 손댐(실루엣 알파 보존) — 아래 hasAlpha 분기가 PNG 유지.
  if (!needsResize && hasAlpha) { stats.skippedNoGain++; return null; }

  let pipeline = sharp(buf);
  if (needsResize) {
    pipeline = pipeline.resize({ width: MAX_DIM, height: MAX_DIM, fit: "inside", withoutEnlargement: true });
  }

  let outBuf, ext, contentType;
  if (hasAlpha) {
    outBuf = await pipeline.png().toBuffer();
    ext = "png"; contentType = "image/png";
  } else {
    // 알파 채널만 있고 사실상 불투명(min≥250)인 경우: JPEG 기본 검은 배경 대신 흰 배경으로 평탄화
    if (meta.hasAlpha) pipeline = pipeline.flatten({ background: "#ffffff" });
    outBuf = await pipeline.jpeg({ quality: JPEG_QUALITY }).toBuffer();
    ext = "jpg"; contentType = "image/jpeg";
  }

  if (outBuf.length >= buf.length) { stats.skippedNoGain++; return null; }
  // 리사이즈 없이 재인코딩만 한 경우: 20% 이상 줄 때만 교체 (화질만 잃고 이득 적은 교체 방지)
  if (!needsResize && outBuf.length > buf.length * 0.8) { stats.skippedNoGain++; return null; }

  return { buffer: outBuf, ext, contentType, originalBytes: buf.length, newBytes: outBuf.length };
}

const ITEM_TIMEOUT_MS = 45000; // 어떤 단계(다운로드/업로드/DB)든 멈추면 그 1건만 실패 처리하고 워커는 계속 진행

function withTimeout(promise, ms, label) {
  let timer;
  const timeout = new Promise((_, reject) => {
    timer = setTimeout(() => reject(new Error(`${label} 타임아웃 (${ms}ms)`)), ms);
  });
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer));
}

async function processOne(label, url, newPathNoExt, bucket, updateFn) {
  if (!url) return;
  if (!isOwnStorageUrl(url)) { stats.skippedExternal++; return; }
  if (isAlreadyMigrated(url)) { stats.skippedAlreadyDone++; return; }
  try {
    await withTimeout((async () => {
      const size = await headSize(url);
      if (size !== null && size <= SKIP_UNDER_BYTES) { stats.scanned++; stats.skippedSmall++; return; }
      const result = await compressUrl(url);
      if (!result) return;
      const newPath = `${newPathNoExt}.${result.ext}`;
      const pct = ((1 - result.newBytes / result.originalBytes) * 100).toFixed(0);
      console.log(`[${label}] ${(result.originalBytes / 1024).toFixed(0)}KB -> ${(result.newBytes / 1024).toFixed(0)}KB (${pct}% 절감)`);
      stats.bytesBefore += result.originalBytes;
      stats.bytesAfter += result.newBytes;
      stats.compressed++;
      if (DRY_RUN) return;

      const { error: upErr } = await supabase.storage.from(bucket).upload(newPath, result.buffer, { contentType: result.contentType, upsert: true });
      if (upErr) throw upErr;
      const { data } = supabase.storage.from(bucket).getPublicUrl(newPath);
      await updateFn(data.publicUrl);
    })(), ITEM_TIMEOUT_MS, label);
  } catch (e) {
    stats.errors++;
    // e.message가 없는 오류(StorageError 등)도 원인이 보이게 + 나중에 찾을 수 있게 URL 기록
    console.error(`[${label}] 실패: ${e?.message || e?.error || JSON.stringify(e)} | ${url}`);
  } finally {
    tickProgress();
  }
}

async function migrateWorldcupCandidates() {
  const rows = await fetchAllRows("worldcup_candidates", (q) => {
    let qq = q.eq("media_type", "image").not("media_url", "is", null);
    if (CONTENT_IDS) qq = qq.in("content_id", CONTENT_IDS);
    return qq;
  }, "id, media_url");
  const targets = rows.filter((r) => isOwnStorageUrl(r.media_url) && !isAlreadyMigrated(r.media_url)).slice(0, LIMIT);
  console.log(`[worldcup_candidates] 대상 ${targets.length}건 (전체 스캔 ${rows.length}건)${CONTENT_IDS ? ` [콘텐츠 ${CONTENT_IDS.length}개 범위]` : ""}`);
  await runPool(targets, (row) =>
    processOne("wc-candidate", row.media_url, `candidates/migrated/${row.id}_c`, BUCKET_MEDIA, async (newUrl) => {
      const { error } = await supabase.from("worldcup_candidates").update({ media_url: newUrl }).eq("id", row.id);
      if (error) throw error;
    })
  );
}

async function migrateContentThumbnails() {
  const rows = await fetchAllRows("contents", (q) => {
    let qq = q.not("thumbnail_url", "is", null);
    if (CONTENT_IDS) qq = qq.in("id", CONTENT_IDS);
    return qq;
  }, "id, thumbnail_url");
  const targets = rows.filter((r) => isOwnStorageUrl(r.thumbnail_url) && !isAlreadyMigrated(r.thumbnail_url)).slice(0, LIMIT);
  console.log(`[contents.thumbnail_url] 대상 ${targets.length}건 (전체 스캔 ${rows.length}건)${CONTENT_IDS ? ` [콘텐츠 ${CONTENT_IDS.length}개 범위]` : ""}`);
  await runPool(targets, (row) =>
    processOne("content-thumb", row.thumbnail_url, `migrated/${row.id}_c`, BUCKET_THUMBNAILS, async (newUrl) => {
      const { error } = await supabase.from("contents").update({ thumbnail_url: newUrl }).eq("id", row.id);
      if (error) throw error;
    })
  );
}

async function migrateQuizMedia() {
  const rows = await fetchAllRows("quiz_questions", (q) => q, "id, media_type, media_url, reveal_media_type, reveal_media_url");
  // URL → 이 URL을 쓰는 (문제 id, 컬럼) 목록. 실루엣 변형 등으로 같은 파일을 여러 문제가 공유함
  const byUrl = new Map();
  const add = (url, id, col) => {
    if (!isOwnStorageUrl(url) || isAlreadyMigrated(url)) return;
    if (!byUrl.has(url)) byUrl.set(url, []);
    byUrl.get(url).push({ id, col });
  };
  for (const r of rows) {
    if (r.media_type === "image") add(r.media_url, r.id, "media_url");
    if (r.reveal_media_type === "image") add(r.reveal_media_url, r.id, "reveal_media_url");
  }
  const targets = [...byUrl.entries()].slice(0, LIMIT);
  const refCount = targets.reduce((n, [, refs]) => n + refs.length, 0);
  console.log(`[quiz_questions] 고유 이미지 ${targets.length}개 (참조 ${refCount}건, 전체 스캔 ${rows.length}문제)`);
  progressTotal = targets.length; processedCount = 0;
  await runPool(targets, ([url, refs]) => {
    // 저장 경로: 첫 참조의 (문제 id, 컬럼) 기준 → (id, 컬럼) 쌍은 URL마다 유일하므로 경로 충돌 없음
    const first = refs[0];
    const newPath = `quiz/migrated/${first.id}${first.col === "reveal_media_url" ? "_reveal" : ""}_c`;
    return processOne("quiz", url, newPath, BUCKET_MEDIA, async (newUrl) => {
      for (const col of ["media_url", "reveal_media_url"]) {
        const ids = refs.filter((x) => x.col === col).map((x) => x.id);
        if (!ids.length) continue;
        // 아직 옛 URL인 행만 교체 (그 사이 제작자가 사진을 바꿨으면 건드리지 않음)
        const { error } = await supabase.from("quiz_questions").update({ [col]: newUrl }).in("id", ids).eq(col, url);
        if (error) throw error;
      }
    });
  });
}

async function migrateTierCards() {
  const rows = await fetchAllRows("tier_templates", (q) => q.not("cards", "is", null), "id, cards");
  const toProcess = [];
  for (const row of rows) {
    const cards = Array.isArray(row.cards) ? row.cards : [];
    cards.forEach((c, idx) => {
      const url = c?.image_url;
      // media_type이 있는 카드(youtube/mp4/url)는 영상/외부 iframe → 이번 이미지 압축 대상 아님
      if (!c?.media_type && url && isOwnStorageUrl(url) && !isAlreadyMigrated(url)) {
        toProcess.push({ templateId: row.id, cardIdx: idx, cardId: c.id, url });
      }
    });
  }
  const targets = toProcess.slice(0, LIMIT);
  console.log(`[tier cards] 대상 ${targets.length}건 (템플릿 ${rows.length}개 스캔)`);

  const byTemplate = new Map();
  for (const t of targets) {
    if (!byTemplate.has(t.templateId)) byTemplate.set(t.templateId, []);
    byTemplate.get(t.templateId).push(t);
  }

  await runPool(
    [...byTemplate.entries()],
    async ([templateId, items]) => {
      let cur;
      try {
        const res = await withTimeout(
          supabase.from("tier_templates").select("cards").eq("id", templateId).single(),
          ITEM_TIMEOUT_MS, `tier-load:${templateId}`
        );
        if (res.error) throw res.error;
        cur = res.data;
      } catch (e) {
        stats.errors++;
        console.error(`[tier] ${templateId} 로드 실패: ${e.message}`);
        return;
      }
      const cards = cur.cards;
      let changed = false;
      for (const item of items) {
        try {
          await withTimeout((async () => {
            const result = await compressUrl(item.url);
            if (!result) return;
            const newPath = `tier/migrated/${templateId}_${item.cardId}_c.${result.ext}`;
            const pct = ((1 - result.newBytes / result.originalBytes) * 100).toFixed(0);
            console.log(`[tier-card] ${(result.originalBytes / 1024).toFixed(0)}KB -> ${(result.newBytes / 1024).toFixed(0)}KB (${pct}% 절감)`);
            stats.bytesBefore += result.originalBytes;
            stats.bytesAfter += result.newBytes;
            stats.compressed++;
            if (DRY_RUN) return;
            const { error: upErr } = await supabase.storage.from(BUCKET_MEDIA).upload(newPath, result.buffer, { contentType: result.contentType, upsert: true });
            if (upErr) throw upErr;
            const { data: pub } = supabase.storage.from(BUCKET_MEDIA).getPublicUrl(newPath);
            cards[item.cardIdx].image_url = pub.publicUrl;
            changed = true;
          })(), ITEM_TIMEOUT_MS, `tier-card:${item.cardId}`);
        } catch (e) {
          stats.errors++;
          console.error(`[tier-card] ${templateId}/${item.cardId} 실패: ${e.message}`);
        }
      }
      if (changed && !DRY_RUN) {
        try {
          const res = await withTimeout(
            supabase.from("tier_templates").update({ cards }).eq("id", templateId),
            ITEM_TIMEOUT_MS, `tier-save:${templateId}`
          );
          if (res.error) throw res.error;
        } catch (e) {
          stats.errors++;
          console.error(`[tier] ${templateId} 저장 실패: ${e.message}`);
        }
      }
    },
    4
  );
}

async function migrateTierThumbnails() {
  const rows = await fetchAllRows("tier_templates", (q) => q.not("thumbnail_url", "is", null), "id, thumbnail_url");
  const targets = rows.filter((r) => isOwnStorageUrl(r.thumbnail_url) && !isAlreadyMigrated(r.thumbnail_url)).slice(0, LIMIT);
  console.log(`[tier_templates.thumbnail_url] 대상 ${targets.length}건 (전체 스캔 ${rows.length}건)`);
  await runPool(targets, (row) =>
    processOne("tier-thumb", row.thumbnail_url, `migrated/${row.id}_c`, BUCKET_THUMBNAILS, async (newUrl) => {
      const { error } = await supabase.from("tier_templates").update({ thumbnail_url: newUrl }).eq("id", row.id);
      if (error) throw error;
    })
  );
}


// ───────────────────────── 추가 대상(extra) ─────────────────────────
// 위 4종 외에 이미지 URL이 들어 있는 테이블들. 행의 모든 컬럼(JSON 안쪽 포함)에서
// "문자열 값 전체가 우리 storage의 jpg/png/webp URL"인 것만 대상으로 한다(문장 속 URL·영상·gif·외부 URL은 건드리지 않음).
const EXTRA_TABLES = ["tier_multi_results", "tier_instances", "profiles", "bingos", "personality_tests", "content_comments", "ranking_hall_of_fame", "community_posts"];
const EXTRA_IMG_EXT = /\.(jpe?g|png|webp)$/i;
function isExtraImageUrl(v) {
  if (typeof v !== "string" || !isOwnStorageUrl(v) || isAlreadyMigrated(v)) return false;
  const path = v.split("?")[0].split("#")[0];
  return EXTRA_IMG_EXT.test(path);
}
function bucketOfUrl(url) {
  const m = /\/object\/public\/([^/]+)\//.exec(url);
  return m ? m[1] : null;
}
function collectUrls(node, out) {
  if (typeof node === "string") { if (isExtraImageUrl(node)) out.add(node); return; }
  if (Array.isArray(node)) { for (const x of node) collectUrls(x, out); return; }
  if (node && typeof node === "object") for (const k of Object.keys(node)) collectUrls(node[k], out);
}
function replaceUrl(node, oldUrl, newUrl) {
  if (typeof node === "string") return node === oldUrl ? newUrl : node;
  if (Array.isArray(node)) return node.map((x) => replaceUrl(x, oldUrl, newUrl));
  if (node && typeof node === "object") { const o = {}; for (const k of Object.keys(node)) o[k] = replaceUrl(node[k], oldUrl, newUrl); return o; }
  return node;
}

async function migrateExtra() {
  // url -> Map("table|id|col" -> {table,id,col})
  const byUrl = new Map();
  const perTable = {};
  for (const table of EXTRA_TABLES) {
    let rows;
    try { rows = await fetchAllRows(table, (q) => q, "*"); }
    catch (e) { console.error(`[extra] ${table} 조회 실패: ${e?.message || JSON.stringify(e)}`); stats.errors++; continue; }
    let refs = 0;
    for (const row of rows) {
      for (const col of Object.keys(row)) {
        if (col === "id") continue;
        const urls = new Set(); collectUrls(row[col], urls);
        for (const u of urls) {
          if (!byUrl.has(u)) byUrl.set(u, new Map());
          byUrl.get(u).set(`${table}|${row.id}|${col}`, { table, id: row.id, col }); refs++;
        }
      }
    }
    perTable[table] = { rows: rows.length, refs };
  }
  const targets = [...byUrl.entries()].slice(0, LIMIT);
  const refTotal = targets.reduce((n, [, m]) => n + m.size, 0);
  console.log(`[extra] 고유 이미지 ${targets.length}개 (참조 ${refTotal}건)`, JSON.stringify(perTable));
  progressTotal = targets.length; processedCount = 0;
  await runPool(targets, ([url, refMap]) => {
    const bucket = bucketOfUrl(url);
    if (!bucket) { tickProgress(); return; }
    const h = createHash("sha1").update(url).digest("hex").slice(0, 20);
    const newPath = bucket === BUCKET_MEDIA ? `extra/migrated/${h}_c` : `migrated/x_${h}_c`;
    return processOne("extra", url, newPath, bucket, async (newUrl) => {
      // 같은 (테이블,id,컬럼)은 1번만, 교체 직전에 최신 값을 다시 읽어 '그 URL과 정확히 같은 문자열'만 바꿈
      for (const { table, id, col } of refMap.values()) {
        const { data, error } = await supabase.from(table).select(col).eq("id", id).single();
        if (error) throw error;
        const cur = data[col];
        const next = replaceUrl(cur, url, newUrl);
        if (JSON.stringify(next) === JSON.stringify(cur)) continue; // 그 사이 바뀐 경우 등 — 건드리지 않음
        const { error: upErr } = await supabase.from(table).update({ [col]: next }).eq("id", id);
        if (upErr) throw upErr;
      }
    });
  }, 6);
}

async function main() {
  await resolveTopContentIds();
  console.log(`=== 기존 이미지 압축 마이그레이션 ${DRY_RUN ? "(DRY RUN — 실제 변경 없음)" : "(실제 적용)"} ${LIMIT !== Infinity ? `(limit=${LIMIT})` : ""}${CONTENT_IDS ? ` [콘텐츠 ${CONTENT_IDS.length}개 범위]` : ""} ===`);
  // --content-id / --top=N 지정 시: 그 콘텐츠(들)의 후보+썸네일만 처리 (quiz/tier 테이블 전체 스캔 안 함)
  if (CONTENT_IDS) {
    if (!ONLY || ONLY === "worldcup") await migrateWorldcupCandidates();
    if (!ONLY || ONLY === "thumbnails") await migrateContentThumbnails();
  } else {
    if (!ONLY || ONLY === "worldcup") await migrateWorldcupCandidates();
    if (!ONLY || ONLY === "thumbnails") await migrateContentThumbnails();
    if (!ONLY || ONLY === "quiz") await migrateQuizMedia();
    if (!ONLY || ONLY === "tier") { await migrateTierCards(); await migrateTierThumbnails(); }
    if (!ONLY || ONLY === "extra") await migrateExtra();
  }

  console.log("\n=== 결과 ===");
  console.log(stats);
  if (stats.bytesBefore > 0) {
    const pct = ((1 - stats.bytesAfter / stats.bytesBefore) * 100).toFixed(1);
    console.log(`총 ${(stats.bytesBefore / 1024 / 1024).toFixed(1)}MB -> ${(stats.bytesAfter / 1024 / 1024).toFixed(1)}MB (${pct}% 절감)`);
  }
}

main().catch((e) => {
  console.error("치명적 오류:", e);
  process.exit(1);
});
