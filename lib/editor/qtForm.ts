import { z } from "zod";

import type { DraftContent, PostContent } from "@/lib/content/schema";
import { EMPTY_TIPTAP_DOC, QT_QUESTION_GROUPS } from "@/lib/content/schema";
import {
  EMPTY_RICH_TEXT,
  isEmptyDoc,
  type RichTextValue,
  toTiptapDoc,
} from "@/lib/editor/richText";

/**
 * A-04 QT 에디터의 폼 계약 (02 §5.2).
 *
 * 이 화면의 필드는 대부분 **크롤러가 채운다**(06 §2). 그래서 폼의 일이 두 가지다.
 * 1. 가져온 값(제목·말씀·주석·질문)을 그대로 편집 가능하게 담는다 — 잠금 없음(02 §5)
 * 2. 크롤러가 아무것도 못 줬을 때 빈 4그룹 프리셋으로 열린다 — 수동 폴백(프리모템 #1)
 *
 * 발행 게이트는 제목·말씀 범위·말씀 본문까지다. **답변 6개와 요약이 비어도 발행된다**
 * (02 §5.2 유효성 · 07 M2 DoD "경고만, 차단 없음") — 일부만 쓰는 날도 루틴의 일부이고,
 * 차단하면 그날 기록이 아예 남지 않는다.
 */

export type QtAnnotationFormValue = {
  term: string;
  /** 선택 — "44절" */
  verseRef: string;
  body: string;
};

export type QtQuestionFormValue = {
  /** "1", "5-1" */
  label: string;
  /** 질문 원문. 크롤링 유래지만 편집 가능하다 */
  text: string;
  answer: RichTextValue;
};

export type QtQuestionGroupFormValue = {
  group: string;
  questions: QtQuestionFormValue[];
};

export type QtFormValues = {
  title: string;
  scriptureRef: string;
  scriptureBody: string;
  annotations: QtAnnotationFormValue[];
  questionGroups: QtQuestionGroupFormValue[];
  summary: RichTextValue;
  /**
   * 태그는 content가 아니라 태그 테이블에 산다(05 §1.4). 지면은 글 타입에서 나오므로
   * faith 글의 태그는 faith 지면에 쌓인다 — 여기서 지면을 들고 다니지 않는다.
   */
  tags: string[];
};

/**
 * 수동 폴백 프리셋 (02 §5.2 "그룹 구조는 기본 4그룹 프리셋").
 * 라벨까지 채워둔다 — 크롤러가 죽은 날 작성자가 그룹을 짜맞추는 일은 없어야 한다.
 */
const PRESET_LABELS: readonly (readonly string[])[] = [["1", "2"], ["3"], ["4"], ["5-1", "5-2"]];

export function emptyQtGroups(): QtQuestionGroupFormValue[] {
  return QT_QUESTION_GROUPS.map((group, index) => ({
    group,
    questions: (PRESET_LABELS[index] ?? []).map((label) => ({
      label,
      text: "",
      answer: EMPTY_RICH_TEXT,
    })),
  }));
}

export function emptyQtForm(): QtFormValues {
  return {
    title: "",
    scriptureRef: "",
    scriptureBody: "",
    annotations: [],
    questionGroups: emptyQtGroups(),
    summary: EMPTY_RICH_TEXT,
    tags: [],
  };
}

/** 아직 답을 안 쓴 질문 수 — 발행을 막지 않고 알려주기만 한다 */
export function countEmptyAnswers(values: QtFormValues): number {
  return values.questionGroups.reduce(
    (total, group) =>
      total + group.questions.filter((question) => isEmptyDoc(question.answer)).length,
    0,
  );
}

function toContentGroups(values: QtFormValues) {
  return values.questionGroups.map((group) => ({
    group: group.group,
    questions: group.questions.map((question) => ({
      label: question.label,
      text: question.text,
      answer: toTiptapDoc(question.answer),
    })),
  }));
}

/** 주석은 빈 항목을 저장하지 않는다 — 크롤러가 못 찾은 것과 사용자가 지운 것이 같은 결과다 */
function toContentAnnotations(values: QtFormValues) {
  return values.annotations
    .filter((annotation) => annotation.term.trim() !== "" || annotation.body.trim() !== "")
    .map((annotation) => ({
      term: annotation.term.trim(),
      ...(annotation.verseRef.trim() === "" ? {} : { verseRef: annotation.verseRef.trim() }),
      body: annotation.body.trim(),
    }));
}

/** 자동 저장용 — 무엇이든 저장한다(04 §2.2) */
export function toDraftContent(values: QtFormValues): DraftContent {
  return {
    kind: "QT",
    scriptureRef: values.scriptureRef,
    scriptureBody: values.scriptureBody,
    annotations: toContentAnnotations(values),
    questionGroups: toContentGroups(values),
    summary: toTiptapDoc(values.summary),
  };
}

/**
 * 발행 게이트의 화면 쪽 절반. 최종 게이트는 서버의 publishPost(05 §3.4)이고,
 * 여기서는 같은 규칙을 먼저 알려주기만 한다.
 *
 * 답변·요약이 없어도 통과한다. 이건 누락이 아니라 확정된 규칙이다(02 §5.2).
 */
export const QtPublishFormSchema = z.object({
  title: z.string().trim().min(1, "큐티 제목을 적어주세요"),
  scriptureRef: z.string().trim().min(1, "말씀 범위를 적어주세요"),
  scriptureBody: z.string().trim().min(1, "말씀 본문을 적어주세요"),
});

/** 발행용 content. 폼이 검증을 통과한 뒤에만 부른다 */
export function toPublishContent(values: QtFormValues): PostContent {
  return {
    kind: "QT",
    scriptureRef: values.scriptureRef.trim(),
    scriptureBody: values.scriptureBody.trim(),
    annotations: toContentAnnotations(values),
    questionGroups: toContentGroups(values),
    summary: toTiptapDoc(values.summary),
  };
}

/**
 * 저장된 content를 폼 값으로 되돌린다 (이어쓰기 진입 · 크롤러 초안 열기).
 *
 * 질문 그룹이 비어 있으면 프리셋으로 채운다 — 크롤링이 실패한 초안을 열었을 때 빈 화면이
 * 아니라 적을 자리가 보여야 한다(06 §7 수동 폴백).
 */
export function fromDraftContent(
  content: DraftContent | null,
  title: string,
  tags: string[] = [],
): QtFormValues {
  if (content?.kind !== "QT") return { ...emptyQtForm(), title, tags };

  const groups = (content.questionGroups ?? []).map((group) => ({
    group: group.group ?? "",
    questions: (group.questions ?? []).map((question) => ({
      label: question.label ?? "",
      text: question.text ?? "",
      answer: (question.answer ?? EMPTY_TIPTAP_DOC) as RichTextValue,
    })),
  }));

  return {
    title,
    scriptureRef: content.scriptureRef ?? "",
    scriptureBody: content.scriptureBody ?? "",
    annotations: (content.annotations ?? []).map((annotation) => ({
      term: annotation.term ?? "",
      verseRef: annotation.verseRef ?? "",
      body: annotation.body ?? "",
    })),
    questionGroups: groups.length > 0 ? groups : emptyQtGroups(),
    summary: (content.summary ?? EMPTY_TIPTAP_DOC) as RichTextValue,
    tags,
  };
}
