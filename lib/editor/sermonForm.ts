import { z } from "zod";

import type { DraftContent, PostContent } from "@/lib/content/schema";
import { EMPTY_TIPTAP_DOC } from "@/lib/content/schema";
import {
  EMPTY_RICH_TEXT,
  isEmptyDoc,
  type RichTextValue,
  toTiptapDoc,
} from "@/lib/editor/richText";

/**
 * A-05 설교 에디터의 폼 계약 (02 §5.3).
 *
 * 필드는 최소다: 제목 · 말씀 범위 · 말씀 본문 · 본문(라이브 속기) · 요약(예배 후 선택).
 * 진입 커서는 제목이고(결정 로그 #10), 본문에 화면을 최대한 양보한다.
 *
 * 조립·검증을 UI에서 떼어내 여기에 둔다 — 예배 중에 돌아가는 코드라 테스트로 고정한다.
 */

export type SermonFormValues = {
  /** 글 제목 — 목록·RSS·OG에 나가는 이름. posts.title로 간다 */
  title: string;
  /** 그날 설교의 제목. content에 실린다(02 §5.3) */
  sermonTitle: string;
  scriptureRef: string;
  scriptureBody: string;
  body: RichTextValue;
  summary: RichTextValue;
  /**
   * 태그는 content가 아니라 태그 테이블에 산다(05 §1.4). 지면은 글 타입에서 나오므로
   * faith 글의 태그는 faith 지면에 쌓인다 — 여기서 지면을 들고 다니지 않는다.
   */
  tags: string[];
};

export const EMPTY_SERMON_FORM: SermonFormValues = {
  title: "",
  sermonTitle: "",
  scriptureRef: "",
  scriptureBody: "",
  body: EMPTY_RICH_TEXT,
  summary: EMPTY_RICH_TEXT,
  tags: [],
};

/** 자동 저장용 — 무엇이든 저장한다(04 §2.2). 빈 요약은 넣지 않는다 */
export function toDraftContent(values: SermonFormValues): DraftContent {
  return {
    kind: "SERMON",
    // 아직 안 적은 설교 제목은 필드를 넣지 않는다 — 빈 문자열이 "적었는데 비었다"로 읽힌다
    ...(values.sermonTitle.trim() === "" ? {} : { sermonTitle: values.sermonTitle.trim() }),
    scriptureRef: values.scriptureRef,
    scriptureBody: values.scriptureBody,
    body: toTiptapDoc(values.body),
    ...(isEmptyDoc(values.summary) ? {} : { summary: toTiptapDoc(values.summary) }),
  };
}

/**
 * 발행 시 필수 (02 결정 로그 #13 — scriptureBody는 실제로 항상 포함되므로 필수로 격상됐다).
 * 서버의 publishPost가 최종 게이트이고(05 §3.4), 이건 같은 규칙을 화면에서 먼저 알려주는
 * 용도다. 규칙을 두 곳에 적는 대신 메시지만 여기서 붙인다.
 */
export const SermonPublishFormSchema = z.object({
  title: z.string().trim().min(1, "글 제목을 적어주세요"),
  // 저장 계약에서는 optional이다(옛 글에는 없다). 새로 쓰는 글에서만 화면이 막는다
  sermonTitle: z.string().trim().min(1, "설교 제목을 적어주세요"),
  scriptureRef: z.string().trim().min(1, "당일 말씀 범위를 적어주세요"),
  scriptureBody: z.string().trim().min(1, "말씀 본문을 적어주세요"),
  body: z.custom<RichTextValue>(
    (value) => !isEmptyDoc(value as RichTextValue),
    "설교 본문이 비어 있어요",
  ),
  summary: z.custom<RichTextValue>(() => true),
});

/** 발행용 content. 폼이 검증을 통과한 뒤에만 부른다 */
export function toPublishContent(values: SermonFormValues): PostContent {
  return {
    kind: "SERMON",
    ...(values.sermonTitle.trim() === "" ? {} : { sermonTitle: values.sermonTitle.trim() }),
    scriptureRef: values.scriptureRef.trim(),
    scriptureBody: values.scriptureBody.trim(),
    body: toTiptapDoc(values.body),
    ...(isEmptyDoc(values.summary) ? {} : { summary: toTiptapDoc(values.summary) }),
  };
}

/** 저장된 content를 폼 값으로 되돌린다 (이어쓰기 진입) */
export function fromDraftContent(
  content: DraftContent | null,
  title: string,
  tags: string[] = [],
): SermonFormValues {
  if (content?.kind !== "SERMON") return { ...EMPTY_SERMON_FORM, title, tags };

  return {
    title,
    sermonTitle: content.sermonTitle ?? "",
    scriptureRef: content.scriptureRef ?? "",
    scriptureBody: content.scriptureBody ?? "",
    body: (content.body ?? EMPTY_TIPTAP_DOC) as RichTextValue,
    summary: (content.summary ?? EMPTY_TIPTAP_DOC) as RichTextValue,
    tags,
  };
}

/**
 * 아직 아무것도 적지 않은 폼인가 (A-05 · 서식 전환 조건).
 *
 * 서식(글의 종류)은 저장 계약을 가르므로 내용이 있는 뒤에는 바꿀 수 없다(02 §2.4).
 * 다만 **비어 있으면 바꾸는 것이 아니라 처음 고르는 것**이다 — 그 판정이 이 함수다.
 *
 * 태그도 본다. 태그만 붙여둔 초안을 빈 것으로 보고 지우면 그것도 유실이다.
 */
export function isEmptyForm(values: SermonFormValues): boolean {
  return (
    values.title.trim() === "" &&
    values.sermonTitle.trim() === "" &&
    values.scriptureRef.trim() === "" &&
    values.scriptureBody.trim() === "" &&
    isEmptyDoc(values.body) &&
    isEmptyDoc(values.summary) &&
    values.tags.length === 0
  );
}
