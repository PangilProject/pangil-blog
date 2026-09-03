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
  title: string;
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
  title: z.string().trim().min(1, "설교 제목을 적어주세요"),
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
    scriptureRef: content.scriptureRef ?? "",
    scriptureBody: content.scriptureBody ?? "",
    body: (content.body ?? EMPTY_TIPTAP_DOC) as RichTextValue,
    summary: (content.summary ?? EMPTY_TIPTAP_DOC) as RichTextValue,
    tags,
  };
}
