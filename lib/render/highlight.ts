import { createHighlighterCore } from "shiki/core";
import { createJavaScriptRegexEngine } from "shiki/engine/javascript";

import { type CodeLanguage, normalizeCodeLanguage } from "@/lib/editor/codeLanguages";
import { INK_THEME } from "@/lib/render/inkTheme";

/**
 * 코드 하이라이팅 (04 §3.2).
 *
 * **공개 지면은 서버에서만 돈다.** 렌더 시점에 HTML을 만들어 두므로 공개 페이지의 클라이언트
 * JS는 0KB다 — 아일랜드 예산(04 §3.6)에 하이라이팅은 없고 복사 버튼만 있다.
 *
 * 에디터(관리 화면)는 같은 하이라이터를 브라우저에서 쓴다. 쓰는 자리에서 색이 보여야 하고
 * (ADR-001), 두 곳이 다른 엔진을 쓰면 색이 갈린다. 그래서 이 모듈은 server-only가 아니다.
 *
 * 언어는 쓰는 것만 싣는다(04 §3.2). 전체 문법을 싣으면 서버 번들이 수 MB 늘고, 안 쓰는
 * 언어를 위해 그 비용을 낼 이유가 없다 — 목록이 늘어난 것은 티스토리 이관에서 실제로 쓰인
 * 언어를 확인했기 때문이다(M5).
 *
 * 정규식 엔진은 JS 엔진을 쓴다(oniguruma wasm 대신) — wasm 로딩이 서버리스 콜드 스타트에
 * 얹히는 것을 피한다.
 */

type LanguageLoader = () => Promise<{ default: unknown }>;

export const LANGUAGE_LOADERS: Record<CodeLanguage, LanguageLoader> = {
  ts: () => import("shiki/langs/typescript.mjs"),
  tsx: () => import("shiki/langs/tsx.mjs"),
  js: () => import("shiki/langs/javascript.mjs"),
  jsx: () => import("shiki/langs/jsx.mjs"),
  json: () => import("shiki/langs/json.mjs"),
  bash: () => import("shiki/langs/bash.mjs"),
  sql: () => import("shiki/langs/sql.mjs"),
  css: () => import("shiki/langs/css.mjs"),
  html: () => import("shiki/langs/html.mjs"),
  prisma: () => import("shiki/langs/prisma.mjs"),
  java: () => import("shiki/langs/java.mjs"),
  swift: () => import("shiki/langs/swift.mjs"),
  c: () => import("shiki/langs/c.mjs"),
  cpp: () => import("shiki/langs/cpp.mjs"),
  python: () => import("shiki/langs/python.mjs"),
  yaml: () => import("shiki/langs/yaml.mjs"),
  md: () => import("shiki/langs/markdown.mjs"),
};

/** 고를 수 있는 언어(codeLanguages)와 문법을 싣는 언어가 같아야 한다 — 테스트로 고정한다 */
export function resolveLanguage(language: string | null): CodeLanguage | null {
  const normalized = normalizeCodeLanguage(language);
  return normalized && normalized in LANGUAGE_LOADERS ? normalized : null;
}

type Highlighter = Awaited<ReturnType<typeof createHighlighterCore>>;

const highlighters = new Map<string, Promise<Highlighter>>();

/** 언어별로 하이라이터를 만들어 프로세스 안에서 재사용한다 */
function getHighlighter(language: CodeLanguage): Promise<Highlighter> {
  const cached = highlighters.get(language);
  if (cached) return cached;

  const created = createHighlighterCore({
    themes: [INK_THEME],
    // 로더는 동적 import 그대로다. Shiki의 LanguageInput 타입이 그 형태를 받는다
    langs: [LANGUAGE_LOADERS[language]() as never],
    engine: createJavaScriptRegexEngine(),
  });

  highlighters.set(language, created);
  return created;
}

/** 토큰 단위 하이라이팅 — 에디터의 decoration이 쓴다 */
export async function highlightTokens(code: string, language: string | null) {
  const resolved = resolveLanguage(language);
  if (!resolved) return null;

  try {
    const highlighter = await getHighlighter(resolved);
    return highlighter.codeToTokens(code, { lang: resolved, theme: INK_THEME.name });
  } catch (error) {
    console.error(`[highlight] ${resolved} 토큰화 실패:`, error);
    return null;
  }
}

/**
 * 코드 한 덩어리를 HTML로. 모르는 언어·실패는 null이고, 그때는 평문 코드 블록으로 그린다 —
 * 하이라이팅이 안 되는 것과 코드가 안 보이는 것은 급이 다르다.
 */
export async function highlightCode(code: string, language: string | null): Promise<string | null> {
  const resolved = resolveLanguage(language);
  if (!resolved) return null;

  try {
    const highlighter = await getHighlighter(resolved);
    return highlighter.codeToHtml(code, { lang: resolved, theme: INK_THEME.name });
  } catch (error) {
    // 문법 로딩 실패가 글을 못 열게 만들지 않는다
    console.error(`[highlight] ${resolved} 실패:`, error);
    return null;
  }
}
