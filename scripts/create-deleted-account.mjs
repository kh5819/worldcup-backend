// 회원탈퇴용 시스템 계정 '삭제된 계정' 만들기 (한 번만, 다시 실행해도 안전)
// - 로그인 불가: 무작위 비밀번호(아무도 모름) + 정지(100년) + 확인 안 된 가짜 도메인(.invalid)
// - 프로필 닉네임 '삭제된 계정'(닉네임 중복 금지라 다른 회원이 못 씀), 사진 없음, role user
// node scripts/create-deleted-account.mjs
import "dotenv/config";
import crypto from "crypto";
import { createClient } from "@supabase/supabase-js";
const sb = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
const { data: ex } = await sb.from("system_accounts").select("user_id").eq("key", "deleted_account").maybeSingle();
if (ex?.user_id) { console.log("이미 있음:", ex.user_id); process.exit(0); }
const email = "deleted-account@system.playduo.invalid";
let uid = null;
const { data, error } = await sb.auth.admin.createUser({ email, password: crypto.randomBytes(48).toString("base64url"), email_confirm: true, user_metadata: { nickname: "삭제된 계정", system: "deleted_account" }, ban_duration: "876000h" });
if (error) {
  // 이미 만들어졌는데 표에만 없는 경우
  const { data: list } = await sb.auth.admin.listUsers({ page: 1, perPage: 1000 });
  uid = list?.users?.find((u) => u.email === email)?.id || null;
  if (!uid) { console.error("만들기 실패:", error.message); process.exit(1); }
} else uid = data.user.id;
await sb.auth.admin.updateUserById(uid, { ban_duration: "876000h" });
const { error: pe } = await sb.from("profiles").upsert({ id: uid, nickname: "삭제된 계정", avatar_url: null }, { onConflict: "id" });
if (pe) { console.error("프로필 실패:", pe.message); process.exit(1); }
const { error: se } = await sb.from("system_accounts").insert({ key: "deleted_account", user_id: uid });
if (se) { console.error("system_accounts 실패:", se.message); process.exit(1); }
console.log("만듦:", uid);
