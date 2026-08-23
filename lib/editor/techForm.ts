import { z } from "zod";

import type { DraftContent, PostContent } from "@/lib/content/schema";
import { EMPTY_TIPTAP_DOC } from "@/lib/content/schema";
import {
  EMPTY_RICH_TEXT,
  isEmptyDoc,
  type RichTextValue,
  toTiptapDoc,
} from "@/lib/editor/richText";
import { tiptapToPlainText } from "@/lib/render/plainText";

/**
 * A-07 기술 에디터의 폼 계약 (02 §5.5).
 *
 * content에 들어가는 것은 body뿐이다(05 §2 TechContent). 카테고리·요약·썸네일·태그는
 * posts 컬럼과 태그 테이블에 사는 메타이고, 그래서 이 폼은 두 목적지로 갈라진다 —
 * 갈라지는 지점을 조립 함수 한 곳에 모아 둔다.
 */

export type TechFormValues = {
  title: string;
  categoryId: string;
  body: RichTextValue;
  /** 비워두면 본문 앞부분에서 뽑는다(02 §5.5). 손으로 적으면 그 값이 이긴다 */
  excerpt: string;
  thumbnailUrl: string;
  tags: string[];
};

export const EMPTY_TECH_FORM: TechFormValues = {
  title: "",
  categoryId: "",
  body: EMPTY_RICH_TEXT,
  excerpt: "",
  thumbnailUrl: "",
  tags: [],
};

/** 목록 카드·OG description 길이 (03 §5.1 카드 2줄) */
export const EXCERPT_MAX_LENGTH = 160;

/**
 * 본문 앞부분 자동 추출 (02 §5.5 필드 4).
 *
 * 문장 경계에서 끊는다 — 단어 중간에서 잘린 요약이 OG 카드에 그대로 나간다.
 */
export function deriveExcerpt(body: RichTextValue | undefined, max = EXCERPT_MAX_LENGTH): string {
  const plain = tiptapToPlainText(body ? toTiptapDoc(body) : null);
  if (plain.length <= max) return plain;

  const window = plain.slice(0, max + 1);
  const sentenceEnd = Math.max(
    window.lastIndexOf(". "),
    window.lastIndexOf("다. "),
    window.lastIndexOf("! "),
    window.lastIndexOf("? "),
  );

  if (sentenceEnd > max * 0.5) return window.slice(0, sentenceEnd + 1).trim();

  const wordEnd = window.lastIndexOf(" ");
  return `${(wordEnd > 0 ? window.slice(0, wordEnd) : plain.slice(0, max)).trim()}…`;
}

/** 저장할 요약 — 손으로 적은 값이 있으면 그것, 없으면 파생값 */
export function resolveExcerpt(values: TechFormValues): string {
  const written = values.excerpt.trim();
  return written === "" ? deriveExcerpt(values.body) : written;
}

/** 자동 저장용 content — body만 들어간다 */
export function toDraftContent(values: TechFormValues): DraftContent {
  return { kind: "TECH", body: toTiptapDoc(values.body) };
}

/** posts 컬럼으로 가는 메타 (upsertDraft의 나머지 인자) */
export function toDraftMeta(values: TechFormValues) {
  return {
    categoryId: values.categoryId === "" ? null : values.categoryId,
    excerpt: resolveExcerpt(values) || null,
    thumbnailUrl: values.thumbnailUrl.trim() === "" ? null : values.thumbnailUrl.trim(),
    tags: values.tags,
  };
}

/**
 * 발행 게이트의 화면 쪽 절반 (02 §5.5 필수 표시).
 * 태그는 "권장"이라 막지 않는다 — 막으면 태그 없는 글을 못 쓰게 된다.
 */
export const TechPublishFormSchema = z.object({
  title: z.string().trim().min(1, "제목을 적어주세요"),
  categoryId: z.string().trim().min(1, "카테고리를 골라주세요"),
  body: z.custom<RichTextValue>(
    (value) => !isEmptyDoc(value as RichTextValue),
    "본문이 비어 있어요",
  ),
});

export function toPublishContent(values: TechFormValues): PostContent {
  return { kind: "TECH", body: toTiptapDoc(values.body) };
}

export type TechInitialValues = {
  title: string;
  categoryId: string | null;
  excerpt: string | null;
  thumbnailUrl: string | null;
  tags: string[];
};

/** 저장된 글을 폼 값으로 되돌린다 (이어쓰기 진입) */
export function fromDraftContent(
  content: DraftContent | null,
  meta: TechInitialValues,
): TechFormValues {
  const body =
    content?.kind === "TECH"
      ? ((content.body ?? EMPTY_TIPTAP_DOC) as RichTextValue)
      : EMPTY_RICH_TEXT;

  return {
    title: meta.title,
    categoryId: meta.categoryId ?? "",
    body,
    excerpt: meta.excerpt ?? "",
    thumbnailUrl: meta.thumbnailUrl ?? "",
    tags: meta.tags,
  };
}
