import { fileURLToPath } from "node:url";

import { defineConfig } from "vitest/config";

const alias = {
  "@": fileURLToPath(new URL(".", import.meta.url)),
  // 서버 전용 지시어는 Next 빌드만 해석한다 (test/serverOnlyStub.ts 주석 참고)
  "server-only": fileURLToPath(new URL("./test/serverOnlyStub.ts", import.meta.url)),
};

/**
 * 테스트는 두 갈래다.
 * - node: 순수 로직(.test.ts) — 호스트 분기, 청구기호 표기, 크롤러 파서 등
 * - dom:  컴포넌트 렌더(.test.tsx) — variants·states가 실제로 다르게 나오는지
 *
 * AGENTS.md 검증 방법의 "단위 테스트 필수 대상"은 대부분 node 쪽이다. dom은 M1
 * 디자인 시스템의 variants를 고정하고, M2 에디터에서 본격적으로 쓰인다.
 */
export default defineConfig({
  test: {
    projects: [
      {
        resolve: { alias },
        test: {
          name: "node",
          environment: "node",
          include: ["{lib,scripts,app,components}/**/*.{test,spec}.ts"],
        },
      },
      {
        resolve: { alias },
        test: {
          name: "dom",
          environment: "jsdom",
          include: ["{lib,app,components}/**/*.{test,spec}.tsx"],
          setupFiles: ["./vitest.setup.ts"],
        },
      },
    ],
  },
});
