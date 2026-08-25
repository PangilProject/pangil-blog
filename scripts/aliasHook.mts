import { existsSync } from "node:fs";
import { registerHooks } from "node:module";

/**
 * `@/` 별칭 해상 (스크립트 전용).
 *
 * 크롤러는 앱과 **같은 lib 코드**를 써야 한다 — 검증 규칙이 두 벌이 되는 순간 06 §6이
 * 무너진다. 그런데 lib는 코드베이스 관례대로 `@/`로 서로를 부르고, Node는 그 별칭을
 * 모른다(tsconfig paths는 타입 검사용이다).
 *
 * 그래서 번들러나 tsx를 들이지 않고 해상 훅 하나만 등록한다(프리모템 #6 — 의존성 최소화).
 * Node 24는 .ts를 그대로 실행하므로 확장자만 붙여주면 끝난다.
 */
const root = new URL("../", import.meta.url);

const CANDIDATES = ["", ".ts", ".tsx", "/index.ts"];

/**
 * `server-only`는 Next 빌드만 아는 표식이다(패키지가 아니다). 스크립트에서 서버 전용 모듈을
 * 부르는 것은 정상이므로 — 스크립트 자체가 서버다 — 테스트와 같은 빈 스텁으로 돌린다.
 */
const SERVER_ONLY_STUB = new URL("../test/serverOnlyStub.ts", import.meta.url);

registerHooks({
  resolve(specifier, context, next) {
    if (specifier === "server-only") {
      return { url: SERVER_ONLY_STUB.href, shortCircuit: true };
    }

    if (!specifier.startsWith("@/")) return next(specifier, context);

    const base = new URL(specifier.slice(2), root);

    for (const suffix of CANDIDATES) {
      const candidate = new URL(base.href + suffix);
      if (existsSync(candidate)) return { url: candidate.href, shortCircuit: true };
    }

    throw new Error(`@/ 별칭을 해상하지 못했습니다: ${specifier}`);
  },
});
