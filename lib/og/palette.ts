/**
 * OG 카드·아이콘이 쓰는 색 (03 §2.1).
 *
 * 지면은 CSS 변수를 쓰지만 satori와 아이콘 SVG는 CSS를 모른다 — 값이 필요하다. 그 값을
 * 여기 한 번만 적는다. 카드와 파비콘이 각자 "인주 빨강"을 적어 두면 하나만 바래도 모른다.
 */
export const PAPER = "#F7F4EC";
export const CARD = "#FFFDF7";
export const INK = "#2B2823";
export const INK_SOFT = "#5A5348";
export const FAINT = "#8C8474";
export const EDGE = "#E4DCCB";

/** 액센트 1축(03 §2.1) — faith 인주 빨강, dev 감청. 허브는 faith와 공유한다 */
export const ACCENT = {
  faith: "#A8412F",
  dev: "#2F4A72",
  hub: "#A8412F",
} as const;

/**
 * 주소창·앱 배경에 쓰는 지면 배경색. `app/globals.css`의 `--paper`(라이트/다크)와 **같아야
 * 한다** — meta 태그는 CSS 변수를 읽지 못해서 값을 한 번 더 적을 수밖에 없다. 03 팔레트를
 * 고치면 여기도 고친다.
 */
export const THEME_COLOR = { light: "#faf7f0", dark: "#201d18" } as const;
