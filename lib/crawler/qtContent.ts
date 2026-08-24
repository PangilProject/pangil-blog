import type { PostContent } from "@/lib/content/schema";
import {
  EMPTY_TIPTAP_DOC,
  QT_GROUP_COUNT,
  QT_QUESTION_COUNT,
  QT_QUESTION_GROUPS,
} from "@/lib/content/schema";

/**
 * 크롤링 결과 → QT content (06 §2 · §6).
 *
 * 이 파일이 **파서와 서버의 공통 계약**이다. Actions의 `assertValid`와 ingest의 재검증이
 * 같은 함수를 부른다 — 규칙을 두 곳에 적으면 한쪽만 고치는 날이 오고, 그날 조용히 깨진
 * 초안이 만들어진다(06 §4 "가장 위험").
 *
 * 채우는 것은 **말씀·주석·질문 원문뿐**이다. 답변과 요약은 빈 문서로 둔다 — 그건 옮겨 적기가
 * 아니라 묵상이고, 자동화 금지 영역이다(01 §1 · 06 §0).
 */

export type ParsedQtAnnotation = {
  term: string;
  /** "1절" — 없는 주석도 있다 */
  verseRef?: string;
  body: string;
};

export type ParsedQtQuestion = {
  /** "1", "5-1" */
  label: string;
  text: string;
};

export type ParsedQtGroup = {
  group: string;
  questions: ParsedQtQuestion[];
};

/** 파서가 내놓는 값. 답변·요약 자리는 애초에 없다 — 타입으로 자동화 금지를 못박는다 */
export type ParsedQt = {
  title: string;
  scriptureRef: string;
  scriptureBody: string;
  annotations: ParsedQtAnnotation[];
  questionGroups: ParsedQtGroup[];
};

export function countQtQuestions(parsed: ParsedQt): number {
  return parsed.questionGroups.reduce((total, group) => total + group.questions.length, 0);
}

/**
 * 06 §6 파싱 검증 규칙. 위반 목록을 돌려주고, 하나라도 있으면 호출자는 FAILED로 떨어진다.
 *
 * 위반 내용을 문장으로 남기는 이유는 Slack 한 줄만 보고 원인을 알아야 하기 때문이다 —
 * "5질문 발견"과 "그룹 라벨 불일치"는 고칠 곳이 다르다.
 */
export function validateParsedQt(parsed: ParsedQt): string[] {
  const issues: string[] = [];

  // 제목은 06 §6 목록에 없지만 우리 쪽 Post.title이 필수다. 비었으면 마크업이 변한 것이다
  if (parsed.title.trim() === "") issues.push("제목이 비어 있음");
  if (parsed.scriptureRef.trim() === "") issues.push("말씀 범위가 비어 있음");
  if (parsed.scriptureBody.trim() === "") issues.push("말씀 본문이 비어 있음");

  if (parsed.questionGroups.length !== QT_GROUP_COUNT) {
    issues.push(`질문 그룹이 ${parsed.questionGroups.length}개 (기대 ${QT_GROUP_COUNT})`);
  }

  // 순서는 보지 않고 집합만 본다(06 §6 "라벨 집합 일치"). 365qt가 순서를 바꾸는 것은
  // 마크업이 깨진 것과 다르고, content에는 발견한 순서를 그대로 남긴다
  const found = new Set(parsed.questionGroups.map((group) => group.group));
  const missing = QT_QUESTION_GROUPS.filter((group) => !found.has(group));
  const unknown = [...found].filter(
    (group) => !(QT_QUESTION_GROUPS as readonly string[]).includes(group),
  );
  if (missing.length > 0) issues.push(`없는 그룹: ${missing.join(", ")}`);
  if (unknown.length > 0) issues.push(`모르는 그룹: ${unknown.join(", ")}`);

  const questionCount = countQtQuestions(parsed);
  if (questionCount !== QT_QUESTION_COUNT) {
    issues.push(`질문이 ${questionCount}개 (기대 ${QT_QUESTION_COUNT})`);
  }

  for (const group of parsed.questionGroups) {
    for (const question of group.questions) {
      if (question.text.trim() === "") {
        issues.push(`빈 질문: ${group.group} ${question.label || "(라벨 없음)"}`);
      }
    }
  }

  // 주석 0개는 정상이다(06 §6) — 검증하지 않는다

  return issues;
}

/** 저장 직전 조립. 답변·요약은 빈 문서다(사용자 몫) */
export function buildQtContent(parsed: ParsedQt): PostContent {
  return {
    kind: "QT",
    scriptureRef: parsed.scriptureRef.trim(),
    scriptureBody: parsed.scriptureBody.trim(),
    annotations: parsed.annotations.map((annotation) => ({
      term: annotation.term.trim(),
      ...(annotation.verseRef?.trim() ? { verseRef: annotation.verseRef.trim() } : {}),
      body: annotation.body.trim(),
    })),
    questionGroups: parsed.questionGroups.map((group) => ({
      group: group.group,
      questions: group.questions.map((question) => ({
        label: question.label,
        text: question.text.trim(),
        answer: EMPTY_TIPTAP_DOC,
      })),
    })),
    summary: EMPTY_TIPTAP_DOC,
  };
}
