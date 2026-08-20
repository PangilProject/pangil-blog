import { Gowun_Batang, JetBrains_Mono, Nanum_Gothic_Coding } from "next/font/google";

/**
 * 서체 로딩 (08 §4) — 외부 런타임 의존 0.
 *
 * next/font/google은 빌드 시 self-host + unicode-range 자동 서브셋 + 폴백 메트릭까지 처리한다.
 * Pretendard는 임의의 한글이 오는 블로그 본문이라 "쓴 글자만 서브셋"이 불가능하므로
 * 동적 서브셋(unicode-range 분할 woff2)을 app/fonts/pretendard.css에서 직접 선언한다.
 *
 * preload는 쓰지 않는다. 한글 웹폰트는 unicode-range로 수십 개 청크로 쪼개져 있어서,
 * preload는 "어느 범위가 필요한지" 모르는 채 전부 받아버린다(Gowun Batang preload 시
 * 47개·2.1MB 측정). 서브셋의 이득을 preload가 그대로 상쇄하므로, display: swap +
 * unicode-range 온디맨드 로딩에 맡긴다. 08 §4의 "임계 폰트만 preload"에 대한 정정이다.
 */

/** 글 제목·말씀 인용·요약·기도문 — "성별된" 자리 (03 §2.2) */
export const gowunBatang = Gowun_Batang({
  weight: ["400", "700"],
  subsets: ["latin"],
  variable: "--font-gowun-batang",
  display: "swap",
  preload: false,
});

/** 청구기호·날짜·라벨·메타 — 기록 체계의 목소리 (03 §2.2) */
export const nanumGothicCoding = Nanum_Gothic_Coding({
  weight: ["400", "700"],
  subsets: ["latin"],
  variable: "--font-nanum-gothic-coding",
  display: "swap",
  preload: false,
});

/** 코드 블록·절 번호 (03 §2.2) */
export const jetBrainsMono = JetBrains_Mono({
  weight: ["400", "600"],
  subsets: ["latin"],
  variable: "--font-jetbrains-mono",
  display: "swap",
  preload: false,
});

/** 루트 <html>에 얹을 폰트 변수 클래스 */
export const fontVariables = [
  gowunBatang.variable,
  nanumGothicCoding.variable,
  jetBrainsMono.variable,
].join(" ");
