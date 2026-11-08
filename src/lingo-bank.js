// 언어 진단소 문제은행 모음 (서버 전용) — 언어별 파일을 합침
import { BANK_KO } from "./lingo-bank-ko.js";
import { BANK_EN } from "./lingo-bank-en.js";
import { BANK_JA } from "./lingo-bank-ja.js";
export const BANK = [...BANK_KO, ...BANK_EN, ...BANK_JA];
