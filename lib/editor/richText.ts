import type { TiptapDoc } from "@/lib/content/schema";
import { tiptapToPlainText } from "@/lib/render/plainText";

/**
 * 폼 계층의 리치 텍스트 값 (04 §2.1) — 에디터 4종 공용.
 *
 * 저장 계약의 TiptapDoc은 content가 재귀 JSON 타입이라, react-hook-form의 경로 추론이
 * 그 위에서 폭발한다(TS2589 "excessively deep"). 폼에서는 노드 배열을 불투명하게 두고,
 * 저장 계약과의 변환은 각 폼의 조립 함수에서만 한다 — 경계를 늘리지 않는다.
 *
 * QT는 한 화면에 이 값이 7개(답변 6 + 요약) 있으므로 설교 폼에서 떼어냈다.
 */
export type RichTextValue = { type: "doc"; content: unknown[] };

export const EMPTY_RICH_TEXT: RichTextValue = { type: "doc", content: [] };

/** 폼 값 → 저장 계약. 같은 JSON을 다르게 좁힌 타입이라 여기서만 맞춘다 */
export function toTiptapDoc(value: RichTextValue): TiptapDoc {
  return value as unknown as TiptapDoc;
}

/**
 * Tiptap 문서가 사실상 비어 있는가 — 빈 문단 하나도 빈 것으로 본다.
 * 판단은 평문 추출(04 §3.1 타깃)에 맡긴다. 노드 구조를 여기서 다시 훑으면 규칙이 두 곳에
 * 생기고, 실제로 노드 타입 이름을 내용으로 세는 버그가 났다.
 */
export function isEmptyDoc(doc: RichTextValue | undefined | null): boolean {
  return tiptapToPlainText(doc ? toTiptapDoc(doc) : null) === "";
}
