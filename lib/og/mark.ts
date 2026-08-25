import { ACCENT, CARD, FAINT, INK } from "@/lib/og/palette";
import { BRAND_MARK } from "@/lib/site/brand";
import type { SiteKey } from "@/lib/site/resolveSite";

/**
 * 기록 마크 — 파비콘·앱 아이콘의 원본 (03 §5.1의 카드를 48px로 줄인 것).
 *
 * 16px에서도 읽혀야 하므로 도형은 넷뿐이다: 종이, 상단 괘, 굵은 줄, 짧은 줄. 글자는 넣지
 * 않는다 — 한글 한 자는 16px에서 얼룩이 된다.
 *
 * 다크 모드 변형을 두지 않는다. 탭 바가 어두워도 종이는 종이여야 하고(03 §2), 두 벌이 되면
 * 브라우저마다 어느 쪽을 고르는지 확인할 방법이 없다.
 */
const SIZE = 48;

export function buildMarkSvg(site: SiteKey): string {
  const accent = ACCENT[site];

  return [
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${SIZE} ${SIZE}" width="${SIZE}" height="${SIZE}" role="img" aria-label="${BRAND_MARK}">`,
    // title은 파비콘에 보이지 않지만 SVG는 그림이다 — 이름 없이 두지 않는다(린트도 막는다)
    `<title>${BRAND_MARK}</title>`,
    `<defs><clipPath id="card"><rect width="${SIZE}" height="${SIZE}" rx="9"/></clipPath></defs>`,
    `<g clip-path="url(#card)">`,
    `<rect width="${SIZE}" height="${SIZE}" fill="${CARD}"/>`,
    // 상단 괘 — 지면에서 카드 윗변을 긋는 그 선이다
    `<rect width="${SIZE}" height="11" fill="${accent}"/>`,
    `<rect x="11" y="21" width="26" height="5" rx="2.5" fill="${INK}"/>`,
    `<rect x="11" y="31" width="16" height="5" rx="2.5" fill="${FAINT}"/>`,
    `</g>`,
    `</svg>`,
  ].join("");
}
