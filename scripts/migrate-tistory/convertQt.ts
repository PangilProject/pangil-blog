import { QT_QUESTION_GROUPS } from "@/lib/content/schema";
import {
  explodeHardBreaks,
  isEmptyBlock,
  lineOf,
  stripAnswerMarker,
  toDoc,
} from "@/scripts/migrate-tistory/blockText";
import { htmlToTiptapContent } from "@/scripts/migrate-tistory/convertHtml";

/**
 * 티스토리 QT 글 → QtContent (05 §6.2 "최상 난이도, 그러나 최정형").
 *
 * 실물의 규칙(픽스처 qt-101):
 *   `<b>마가복음 4장 26~34절</b>`   말씀 범위
 *   `26. 또 이르시되…`              절 — 번호로 시작하는 줄
 *   `- 해석하시더라 : 설명`          주석 — `-`로 시작하는 줄
 *   `<hr>`                          말씀과 질문의 경계
 *   `<b>내용관찰</b>`               그룹 제목 (4종)
 *   `<b>1. 질문…?</b>` / `: 답변`    질문과 답변
 *   `<b>Summary</b>` / `: 요약`      요약
 *
 * 문서가 "최대 난점 = 질문/답변 경계"라고 봤지만, 실제로는 답변이 `:`로 시작해서 명확하다.
 * 그래도 그 표시에만 의존하지 않는다 — **질문은 번호로**, 나머지는 답변으로 본다.
 */

/** 365qt와 같은 표기 차이("느낀점" ↔ "느낀 점")를 흡수한다 */
const GROUP_BY_COMPACT = new Map(
  QT_QUESTION_GROUPS.map((group) => [group.replace(/\s+/g, ""), group]),
);

const SUMMARY_HEADINGS = new Set(["summary", "요약", "오늘의요약", "정리"]);

/** `1.` `5-1.` `5-1)` — 질문의 시작 */
const QUESTION_LABEL = /^(\d+(?:\s*-\s*\d+)?)\s*[.)]\s*(.*)$/;

/** `26.` 으로 시작하는 절 */
const VERSE_LINE = /^\d+(?:\s*[-~]\s*\d+)?\s*[.)]/;

export type QtConversion = {
  content: {
    kind: "QT";
    scriptureRef: string;
    scriptureBody: string;
    annotations: { term: string; verseRef?: string; body: string }[];
    questionGroups: {
      group: string;
      questions: { label: string; text: string; answer: unknown }[];
    }[];
    summary: unknown;
  };
  notes: string[];
};

/** `- 해석하시더라 : 복음서에서는…` / `- 백향목(6절) : 고급 목재` */
function parseAnnotation(line: string): { term: string; verseRef?: string; body: string } | null {
  const body = line.replace(/^[-·•]\s*/, "");
  const [head, ...rest] = body.split(/\s*[:：]\s*/);
  if (rest.length === 0) return null;

  const withVerse = head.match(/^(.*?)\s*\(([^()]*)\)\s*$/);

  return {
    term: (withVerse ? withVerse[1] : head).trim(),
    ...(withVerse ? { verseRef: withVerse[2].trim() } : {}),
    body: rest.join(" : ").trim(),
  };
}

function headingKind(line: string): "group" | "summary" | null {
  const compact = line.replace(/\s+/g, "").replace(/[[\]()]/g, "");
  if (GROUP_BY_COMPACT.has(compact)) return "group";
  if (SUMMARY_HEADINGS.has(compact.toLowerCase())) return "summary";
  return null;
}

export function convertQt(bodyHtml: string): QtConversion {
  const { content: raw, notes: htmlNotes } = htmlToTiptapContent(bodyHtml);
  // `<br>`로만 줄을 나눈 글이 섞여 있다 — 구조를 읽기 전에 줄 단위로 편다
  const content = explodeHardBreaks(raw);
  const notes = htmlNotes.map((note) => `${note.kind}: ${note.detail}`);

  const scriptureLines: string[] = [];
  const annotations: QtConversion["content"]["annotations"] = [];
  const groups: QtConversion["content"]["questionGroups"] = [];
  const summary: unknown[] = [];

  let scriptureRef = "";
  /** 지금 줄을 어디에 담고 있는가 */
  let target: "scripture" | "questions" | "summary" = "scripture";
  let group: QtConversion["content"]["questionGroups"][number] | null = null;
  let answer: unknown[] | null = null;

  for (const block of content) {
    if (isEmptyBlock(block)) continue;

    const line = lineOf(block);
    const heading = headingKind(line);

    if (heading === "summary") {
      target = "summary";
      answer = null;
      continue;
    }

    if (heading === "group") {
      target = "questions";
      group = { group: GROUP_BY_COMPACT.get(line.replace(/\s+/g, "")) ?? line, questions: [] };
      groups.push(group);
      answer = null;
      continue;
    }

    if (target === "summary") {
      summary.push(stripAnswerMarker(block));
      continue;
    }

    if (target === "questions") {
      const question = line.match(QUESTION_LABEL);

      if (question) {
        answer = [];
        if (!group) group = pushLooseGroup(groups);
        group.questions.push({
          label: question[1].replace(/\s+/g, ""),
          text: question[2].trim(),
          answer: { type: "doc", content: answer },
        });
        continue;
      }

      // 질문 뒤에 오는 것은 답변이다. 여러 문단이어도 이어 담는다
      if (answer) answer.push(stripAnswerMarker(block));
      else notes.push(`질문 밖의 글: ${line.slice(0, 30)}`);
      continue;
    }

    // 말씀 영역
    if ((block as { type?: string }).type === "horizontalRule") continue;

    if (scriptureRef === "" && !VERSE_LINE.test(line)) {
      scriptureRef = line;
      continue;
    }

    const annotation = line.startsWith("-") ? parseAnnotation(line) : null;
    if (annotation) {
      annotations.push(annotation);
      continue;
    }

    scriptureLines.push(line);
  }

  return {
    content: {
      kind: "QT",
      scriptureRef,
      scriptureBody: scriptureLines.join("\n"),
      annotations,
      questionGroups: groups.map((entry) => ({
        group: entry.group,
        questions: entry.questions.map((question) => ({
          ...question,
          answer: toDoc((question.answer as { content: unknown[] }).content),
        })),
      })),
      summary: toDoc(summary),
    },
    notes,
  };
}

/** 그룹 제목 없이 질문이 먼저 나오는 글 — 구조를 잃지 않도록 담을 자리를 만든다 */
function pushLooseGroup(groups: QtConversion["content"]["questionGroups"]) {
  const group = { group: "", questions: [] };
  groups.push(group);
  return group;
}
