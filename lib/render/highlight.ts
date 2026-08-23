import "server-only";

import { createHighlighterCore } from "shiki/core";
import { createJavaScriptRegexEngine } from "shiki/engine/javascript";

import { type CodeLanguage, normalizeCodeLanguage } from "@/lib/editor/codeLanguages";

/**
 * 코드 하이라이팅 (04 §3.2).
 *
 * **서버에서만 돈다.** 렌더 시점에 HTML을 만들어 두므로 클라이언트 JS는 0KB다 — 공개 지면의
 * 아일랜드 예산(04 §3.6)에 코드 하이라이팅은 없다. 복사 버튼만 아일랜드다.
 *
 * 언어는 쓰는 것만 싣는다(ts/js/tsx/json/bash/sql로 시작, 04 §3.2). 전체 문법을 싣으면
 * 서버 번들이 수 MB 늘고, 안 쓰는 언어를 위해 그 비용을 낼 이유가 없다.
 *
 * 정규식 엔진은 JS 엔진을 쓴다(oniguruma wasm 대신) — wasm 로딩이 서버리스 콜드 스타트에
 * 얹히는 것을 피한다.
 */

/** 먹지 테마 (03 §3.2 · 04 §3.2) — 배경은 --ink, 글자는 종이색 계열 */
const INK_THEME = {
  name: "record-ink",
  type: "dark" as const,
  colors: {
    "editor.background": "#2B2823",
    "editor.foreground": "#F3EFE4",
  },
  settings: [
    { scope: ["comment", "punctuation.definition.comment"], settings: { foreground: "#8B8474" } },
    { scope: ["string", "constant.other.symbol"], settings: { foreground: "#C7B58A" } },
    { scope: ["constant.numeric", "constant.language"], settings: { foreground: "#D8A25B" } },
    { scope: ["keyword", "storage", "storage.type"], settings: { foreground: "#D98872" } },
    { scope: ["entity.name.function", "support.function"], settings: { foreground: "#A8BFA0" } },
    {
      scope: ["entity.name.type", "support.type", "support.class"],
      settings: { foreground: "#9DB4C0" },
    },
    { scope: ["variable", "meta.definition.variable"], settings: { foreground: "#F3EFE4" } },
    { scope: ["entity.name.tag"], settings: { foreground: "#D98872" } },
    { scope: ["entity.other.attribute-name"], settings: { foreground: "#C7B58A" } },
  ],
};

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
