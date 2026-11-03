// Natural Earth 1:110m 나라 경계(퍼블릭 도메인) → 상식 진단소 지도용 작은 파일
// 사용: node scripts/build-know-world.mjs <ne_110m_admin_0_countries.geojson> <출력 json>
// 출력: { v, src, c: { KR: [[x10,y10,...], ...링], ... } }  좌표 = 경도·위도 ×10 정수, 링마다 평평한 배열
import fs from "fs";
const [inp, out] = process.argv.slice(2);
const g = JSON.parse(fs.readFileSync(inp, "utf8"));
const res = {};
let pts = 0;
for (const f of g.features) {
  const p = f.properties;
  let code = p.ISO_A2_EH && p.ISO_A2_EH !== "-99" ? p.ISO_A2_EH : p.ISO_A2;
  if (!code || code === "-99") code = (p.ADM0_A3 || "").slice(0, 3);   // 코소보 등은 3글자
  if (p.ADM0_A3 === "ATA") code = "AQ";
  const polys = f.geometry.type === "Polygon" ? [f.geometry.coordinates] : f.geometry.coordinates;
  const rings = [];
  for (const poly of polys) {
    const ring = poly[0];                     // 바깥 테두리만 (110m엔 구멍이 거의 없음)
    const flat = [];
    let px = null, py = null;
    for (const [lon, lat] of ring) {
      const x = Math.round(lon * 10), y = Math.round(lat * 10);
      if (x === px && y === py) continue;
      flat.push(x, y); px = x; py = y;
    }
    if (flat.length >= 6) { rings.push(flat); pts += flat.length / 2; }
  }
  (res[code] ||= []).push(...rings);
}
fs.writeFileSync(out, JSON.stringify({ v: 1, src: "Natural Earth 1:110m Admin 0 Countries (public domain) — naturalearthdata.com", c: res }));
console.log(`나라 ${Object.keys(res).length}개, 점 ${pts}개, ${(fs.statSync(out).size / 1024).toFixed(1)}KB`);
