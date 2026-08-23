import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /**
   * Cache Components (ADR-003).
   *
   * 발행 직후 공개 상세로 이동한다는 확정(02 §3.2) 때문에 켠다 — 방금 쓴 글이 낡게 보이면
   * 그게 곧 신뢰 문제다. `updateTag`(즉시 만료)는 Cache Components를 전제로 한다.
   *
   * 대가: 캐시 경계를 명시해야 한다. 캐시할 것은 `use cache`로 감싸고, 요청마다 달라지는
   * 것(인증·쿠키)은 그대로 동적으로 남긴다.
   */
  cacheComponents: true,

  /**
   * OG 카드 생성이 쓰는 두 패키지는 번들에 넣을 수 없다.
   * - `@resvg/resvg-js`: 네이티브 애드온(.node). 번들러가 묶으면 "could not resolve
   *   @resvg/resvg-js-darwin-arm64"로 라우트가 죽는다
   * - `satori`: 런타임에 harfbuzz wasm을 node_modules에서 읽는다. 번들에 넣으면
   *   "ENOENT: harfbuzzjs/hb.wasm"으로 죽는다
   *
   * 둘 다 실제로 그렇게 깨졌다. 배포 환경에서는 npm이 각 플랫폼 바이너리를 설치한다.
   */
  serverExternalPackages: ["@resvg/resvg-js", "satori"],
};

export default nextConfig;
