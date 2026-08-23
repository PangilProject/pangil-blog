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

/**
 * 폼 값 → 저장 계약 (ADR-002 Json 경계).
 *
 * **JSON 왕복이 꼭 필요하다.** ProseMirror는 노드의 attrs를 `Object.create(null)`로 만든다
 * (프로토타입 없는 객체). React의 Server Action 직렬화는 그걸 평범한 객체로 보내지 못해
 * 서버에서는 함수(임시 참조)로 도착하고, z.json()이 거부해 저장이 통째로 실패한다.
 *
 * attrs를 갖는 노드는 **제목과 코드 블록**이고 문단·목록·인용은 attrs가 없다 — 그래서
 * 제목이나 코드 블록을 하나 넣는 순간 그 글의 모든 저장이 조용히 실패했다. 실제로 그랬다.
 *
 * 왕복 비용은 글 하나 크기(수십 KB)이고 저장은 1초 이상 간격이다. 무엇보다 이 경계의 계약이
 * "content 컬럼에 들어갈 수 있는 값만 남긴다"이므로, JSON으로 표현 못 하는 값은 여기서
 * 떨어지는 것이 맞다.
 */
export function toTiptapDoc(value: RichTextValue): TiptapDoc {
  return JSON.parse(JSON.stringify(value)) as TiptapDoc;
}

/**
 * Tiptap 문서가 사실상 비어 있는가 — 빈 문단 하나도 빈 것으로 본다.
 * 판단은 평문 추출(04 §3.1 타깃)에 맡긴다. 노드 구조를 여기서 다시 훑으면 규칙이 두 곳에
 * 생기고, 실제로 노드 타입 이름을 내용으로 세는 버그가 났다.
 */
export function isEmptyDoc(doc: RichTextValue | undefined | null): boolean {
  return tiptapToPlainText(doc ? toTiptapDoc(doc) : null) === "";
}
