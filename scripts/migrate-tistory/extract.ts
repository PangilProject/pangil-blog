import { basename } from "node:path";

import { JSDOM } from "jsdom";

/**
 * 티스토리 백업 HTML 추출 (05 §6.1 1단계 · §6.7 "실물로 셀렉터 핀 고정").
 *
 * 백업은 XML이 아니라 **글별 렌더링 HTML**이다(05 §6.0). 다행히 스킨이 메타를 그대로
 * 남겨서, 문서가 걱정했던 것들이 다 있다:
 *
 *   제목    `h2.title-article`
 *   카테고리 `p.category`   — 타입 판별을 본문 추측이 아니라 이 값으로 한다(§6.2 정정)
 *   작성일  `p.date`        — 759편 전부 존재. §6.5 날짜 리스크가 사라졌다
 *   태그    `div.tags`      — `#태그 #두 단어 태그` 평문
 *   본문    `div.contents_style`
 *
 * 셀렉터를 못 찾으면 던진다. 조용히 빈 값으로 넘기면 759편 중 몇 편이 비어서 들어가고,
 * 그걸 나중에 발견한다 — 크롤러에서 배운 것과 같은 규칙이다(06 §4).
 */

export class ExtractError extends Error {
  readonly name = "ExtractError";
}

export type ExtractedPost = {
  /** 티스토리 원본 글 ID. 재실행 멱등 키다(05 §6.4-7) */
  legacyId: number;
  /** 리포트에서 사람이 파일을 찾을 수 있게 남긴다 */
  file: string;
  title: string;
  /** KST 벽시계로 적혀 있어 UTC로 옮겨 담는다 */
  publishedAt: Date;
  /** 원문 그대로. 분류는 classify가 한다 */
  categoryPath: string;
  tags: string[];
  bodyHtml: string;
};

/** `105/105-[혼자공부하는SQL]-12강.html` → 105 */
export function legacyIdOf(filePath: string): number {
  const name = basename(filePath);
  const match = name.match(/^(\d+)(?:-|\.html$)/);
  if (!match) throw new ExtractError(`파일명에서 원본 글 ID를 읽지 못했습니다: ${name}`);
  return Number(match[1]);
}

/**
 * `2024-12-01 16:47:46`(KST 벽시계) → Date.
 *
 * 티스토리가 적은 시각은 KST다. 문자열을 그대로 `new Date()`에 주면 실행 환경의
 * 타임존으로 읽혀서, Actions(UTC)와 로컬(KST)이 9시간 다른 값을 만든다.
 */
export function kstTextToDate(text: string): Date {
  const match = text.trim().match(/^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2}):(\d{2})$/);
  if (!match) throw new ExtractError(`작성일 형식을 읽지 못했습니다: "${text}"`);

  const [, year, month, day, hour, minute, second] = match;
  return new Date(`${year}-${month}-${day}T${hour}:${minute}:${second}+09:00`);
}

/** `#CCM #찬양 #날마다 솟는 샘물` — 태그 안에 공백이 있어 `#`로 쪼갠다 */
export function parseTags(text: string): string[] {
  return text
    .split("#")
    .map((tag) => tag.replace(/\s+/g, " ").trim())
    .filter((tag) => tag !== "");
}

function textOf(root: Document, selector: string, what: string): string {
  const element = root.querySelector(selector);
  if (!element) throw new ExtractError(`${what}(${selector})을 찾지 못했습니다`);
  return (element.textContent ?? "").replace(/\s+/g, " ").trim();
}

export function extractPost(html: string, filePath: string): ExtractedPost {
  const { document } = new JSDOM(html).window;

  const body = document.querySelector(".contents_style");
  if (!body) throw new ExtractError("본문(.contents_style)을 찾지 못했습니다");

  // 카테고리는 비어 있을 수 있다(서식·임시 글 23편) — 그 판정은 classify가 한다
  const category = document.querySelector("p.category");

  return {
    legacyId: legacyIdOf(filePath),
    file: filePath,
    title: textOf(document, "h2.title-article", "제목"),
    publishedAt: kstTextToDate(textOf(document, "p.date", "작성일")),
    categoryPath: (category?.textContent ?? "").replace(/\s+/g, " ").trim(),
    tags: parseTags(document.querySelector("div.tags")?.textContent ?? ""),
    bodyHtml: body.innerHTML,
  };
}
