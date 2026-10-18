/**
 * robots.txt에서 통째로 막는 봇 (2026-10 Egress 회차, `app/(feeds)/robots.txt`).
 *
 * Vercel 로그 표본(45분 50건)에서 사람은 많아야 1건이었고 나머지는 봇이었다. 그중 검색 노출을
 * 주지 않으면서 글·태그·`?page=` 번호까지 훑어 DB를 읽게 하던 것들이다.
 *
 * - SEO 분석 수집: `SemrushBot` — 표본에서 가장 많았다(14건)
 * - AI 학습·답변 수집: `Reflectionbot`(5건) · `ClaudeBot` · `PerplexityBot` · `GPTBot`
 *   · `CCBot` · `Google-Extended` · `meta-externalagent` · `Bytespider`
 *
 * **검색엔진(Google·Bing·Apple·Naver)은 막지 않는다.** `Google-Extended`는 Gemini 학습용
 * 토큰이라 막아도 구글 검색 노출과는 무관하다. **`facebookexternalhit`도 막지 않는다** — 막으면
 * 인스타그램·스레드에서 링크 미리보기가 깨지고, 애초에 robots.txt를 따르지 않는다.
 *
 * 봇마다 자기 이름의 묶음이 있으면 `*` 묶음은 보지 않는다(robots.txt 규칙). 그래서 각자
 * `Disallow: /` 한 줄로 충분하다.
 */
export const BLOCKED_BOTS = [
  "SemrushBot",
  "Reflectionbot",
  "ClaudeBot",
  "PerplexityBot",
  "GPTBot",
  "CCBot",
  "Google-Extended",
  "meta-externalagent",
  "Bytespider",
] as const;
