import { JSDOM } from "jsdom";

import { QT_QUESTION_GROUPS } from "@/lib/content/schema";
import type { ParsedQt, ParsedQtAnnotation, ParsedQtGroup } from "@/lib/crawler/qtContent";

/**
 * 365qt "오늘의 큐티" 파서 (06 §2 · 미결 #1·#2 해소).
 *
 * 실제 마크업(2026-08 확인, scripts/crawler/fixtures)은 서버 렌더 ASP.NET이고 셀렉터가
 * 안정적이다. 그래서 헤드리스 브라우저 없이 HTML만 읽는다.
 *
 * 읽는 곳:
 *   제목      `.qt-top h2.title-b`           (슬라이더에도 같은 클래스가 있어 .qt-top으로 좁힌다)
 *   말씀 범위 `.qt-top ul.font-a li` 중 "본문"
 *   말씀 본문 `#home .font-b.has-feedback`   (한글 탭. 영문·병기 탭은 #profile·#profile2)
 *   주석      `.qt-cts .qt-box`              (`<b>용어(1절)</b> 설명<br/>` 반복)
 *   질문      `#qtFrm`의 `p.font_mark`(그룹) + `p.font-b`(질문)
 *
 * **모르는 것은 조용히 넘기지 않는다.** 못 찾은 셀렉터는 ParseError이고, 그러면 그날은
 * FAILED로 시끄럽게 끝난다(06 §4). 비어 보이는 것을 정상으로 취급하는 순간 크롤러는
 * "매일 잘 돌지만 아무것도 안 만드는" 상태로 몇 주를 버틸 수 있다.
 */

export class ParseError extends Error {
  readonly name = "ParseError";
}

/** 365qt는 "느낀점", 우리 스키마는 "느낀 점". 공백을 지운 이름으로 맞춘다 */
const GROUP_BY_COMPACT_NAME = new Map(
  QT_QUESTION_GROUPS.map((group) => [group.replace(/\s+/g, ""), group]),
);

/**
 * `<br>`을 줄바꿈으로 살려서 읽는다 — 질문 5번은 두 문장이 줄바꿈으로 나뉘어 온다.
 * 텍스트 노드를 그대로 받는 경우도 있다(주석 상자는 `<b>`와 텍스트가 형제로 늘어선다).
 */
function blockText(node: Node): string {
  if (node.nodeType === node.TEXT_NODE) return node.nodeValue ?? "";
  if (node.nodeName === "BR") return "\n";

  let text = "";
  for (const child of node.childNodes) text += blockText(child);

  return text;
}

function lines(text: string): string[] {
  return text
    .split("\n")
    .map((line) => line.replace(/\s+/g, " ").trim())
    .filter((line) => line !== "");
}

function required<T>(value: T | null | undefined, what: string): T {
  if (value === null || value === undefined) {
    throw new ParseError(`${what}을(를) 찾지 못했습니다 — 365qt 마크업이 바뀐 것 같습니다`);
  }
  return value;
}

function parseTitle(document: Document): string {
  const heading = required(
    document.querySelector(".qt-top h2.title-b"),
    "제목(.qt-top h2.title-b)",
  );
  return lines(blockText(heading)).join(" ");
}

function parseScriptureRef(document: Document): string {
  const items = [...document.querySelectorAll(".qt-top ul.font-a li")];

  // "본문 <span>열왕기상 5:1~6</span>" — 두 번째 li는 찬송이다
  for (const item of items) {
    if (!blockText(item).trim().startsWith("본문")) continue;
    const span = required(item.querySelector("span"), "말씀 범위(본문 span)");
    return lines(blockText(span)).join(" ");
  }

  throw new ParseError("말씀 범위(.qt-top ul.font-a의 '본문' 항목)를 찾지 못했습니다");
}

/**
 * 한글 탭의 절을 "1 본문" 한 줄씩으로 모은다.
 * 절 번호를 앞에 붙여두면 지면이 절 번호를 세워 조판할 수 있다(03 §5.2 ScriptureBlock).
 */
function parseScriptureBody(document: Document): string {
  const panel = required(
    document.querySelector("#home .font-b.has-feedback"),
    "말씀 본문(#home .font-b.has-feedback)",
  );

  const verses: string[] = [];
  let number = "";

  for (const child of panel.children) {
    const text = lines(blockText(child)).join(" ");
    if (child.classList.contains("wd30")) {
      number = text;
      continue;
    }
    if (text === "") continue;

    verses.push(number ? `${number} ${text}` : text);
    number = "";
  }

  if (verses.length === 0) {
    throw new ParseError("말씀 본문에 절이 하나도 없습니다");
  }

  return verses.join("\n");
}

/** `<b>두로 왕 히람(1절)</b> 지중해 연안의…<br/>` 반복 */
function parseAnnotations(document: Document): ParsedQtAnnotation[] {
  const box = document.querySelector(".qt-cts .qt-box");

  // 주석 상자 자체가 없는 날은 정상이다(06 §6 "주석 0 허용")
  if (!box) return [];

  const annotations: ParsedQtAnnotation[] = [];
  let current: ParsedQtAnnotation | null = null;

  const flush = () => {
    if (current && current.term !== "" && current.body !== "") annotations.push(current);
    current = null;
  };

  for (const child of box.childNodes) {
    if (child.nodeName === "B" || child.nodeName === "STRONG") {
      flush();
      const raw = lines(blockText(child)).join(" ");
      // "두로 왕 히람(1절)" → term + verseRef
      const match = raw.match(/^(.*?)\s*\(([^()]*)\)\s*$/);
      current = match
        ? { term: match[1].trim(), verseRef: match[2].trim(), body: "" }
        : { term: raw, body: "" };
      continue;
    }

    if (child.nodeName === "BR") {
      flush();
      continue;
    }

    const text = lines(blockText(child)).join(" ");
    if (text === "" || !current) continue;
    current.body = current.body === "" ? text : `${current.body} ${text}`;
  }

  flush();

  return annotations;
}

/**
 * 질문. `p.font_mark`가 그룹을 열고 `p.font-b`가 질문이다.
 *
 * 기도·은혜나눔도 같은 클래스로 오므로 **아는 그룹 라벨 안에서만** 질문을 줍는다 —
 * 모르는 라벨이 나오면 그 뒤 문단은 질문이 아니다. 그러지 않으면 "오늘 받은 은혜를
 * 함께 나눕니다"가 7번째 질문이 되어 6질문 검증에 걸린다.
 */
function parseQuestionGroups(document: Document): ParsedQtGroup[] {
  const form = required(document.querySelector("#qtFrm"), "질문 영역(#qtFrm)");

  const groups: ParsedQtGroup[] = [];
  let current: ParsedQtGroup | null = null;

  for (const child of form.children) {
    if (child.classList.contains("font_mark")) {
      const compact = blockText(child).replace(/\s+/g, "");
      const group = GROUP_BY_COMPACT_NAME.get(compact);
      current = group ? { group, questions: [] } : null;
      if (current) groups.push(current);
      continue;
    }

    if (!current || !child.classList.contains("font-b")) continue;

    const parts = lines(blockText(child));
    if (parts.length === 0) continue;

    // "5. 앞세웠던 때는 언제입니까?" / 다음 줄 "무엇을 실천하겠습니까?" → 5-1, 5-2
    const numbered = parts[0].match(/^(\d+)\s*[.)]\s*(.*)$/);
    if (!numbered) {
      throw new ParseError(`질문 번호를 읽지 못했습니다: "${parts[0].slice(0, 40)}"`);
    }

    const number = numbered[1];
    const texts = [numbered[2], ...parts.slice(1)].filter((text) => text !== "");

    for (const [index, text] of texts.entries()) {
      current.questions.push({
        label: texts.length > 1 ? `${number}-${index + 1}` : number,
        text,
      });
    }
  }

  return groups;
}

export type TodayQtResult =
  | { kind: "content"; parsed: ParsedQt }
  /** 365qt가 "이 날은 큐티가 없다"고 명시한 경우에만 (06 §2) */
  | { kind: "no-content"; reason: string };

/**
 * `runDate`(KST YYYY-MM-DD)를 함께 받는 이유: 페이지가 **다른 날짜**를 보여줄 수 있다.
 * 그 경우를 파싱 성공으로 처리하면 어제 큐티가 오늘 초안으로 들어온다.
 */
export function parseTodayQt(html: string, runDate: string): TodayQtResult {
  const { document } = new JSDOM(html).window;

  const slider = required(document.querySelector(".qt-slider[data-seldate]"), "날짜 슬라이더");
  const box = document.querySelector(`li.qt-slider-box[data-lidate="${runDate}"]`);

  // 주일·미게시는 마크업에 명시된다: class="… disable" title="주일은 오늘의큐티가 없습니다"
  if (box?.classList.contains("disable")) {
    const reason = box.getAttribute("title")?.trim() || "365qt가 이 날짜를 비활성으로 표시";
    return { kind: "no-content", reason: `no-content(${reason})` };
  }

  const shown = slider.getAttribute("data-seldate");
  if (shown !== runDate) {
    // 조용히 넘기지 않는다. 마커 없이 다른 날짜가 보이는 건 우리가 모르는 상황이다
    throw new ParseError(`페이지가 ${shown ?? "(없음)"}을 보여줍니다 (기대 ${runDate})`);
  }

  return {
    kind: "content",
    parsed: {
      title: parseTitle(document),
      scriptureRef: parseScriptureRef(document),
      scriptureBody: parseScriptureBody(document),
      annotations: parseAnnotations(document),
      questionGroups: parseQuestionGroups(document),
    },
  };
}
