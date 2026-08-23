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

  images: {
    /**
     * 업로드 이미지는 Supabase Storage에서 온다(04 §3.3). 호스트를 env에서 읽는 이유는
     * dev·prod 프로젝트가 다른 주소를 쓰기 때문이다 — 하드코딩하면 한쪽에서 이미지가 막힌다.
     *
     * 마이그레이션·붙여넣기로 들어온 외부 이미지는 최적화 대상이 아니다(렌더러가 그대로 그린다).
     */
    remotePatterns: process.env.NEXT_PUBLIC_SUPABASE_URL
      ? [
          {
            protocol: "https" as const,
            hostname: new URL(process.env.NEXT_PUBLIC_SUPABASE_URL).hostname,
            pathname: "/storage/v1/object/public/**",
          },
        ]
      : [],
  },
};

export default nextConfig;
