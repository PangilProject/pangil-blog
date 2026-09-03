import type { RecordType } from "@/lib/record/callNumber";

/**
 * 목록이 나누는 축 (02 §5 · F-02 · D-03).
 *
 * 지면마다 축이 다르다 — faith는 **타입**(큐티·설교·찬양)이고 dev는 **카테고리**다.
 * faith의 셋이 카테고리가 아니라 타입인 것은 분류가 아니라 글의 종류이기 때문이다:
 * 타입마다 에디터가 다르고(A-04~06), content 스키마가 갈리고, 청구기호 시퀀스와 slug
 * 접두어가 갈린다. 그래서 faith에 종류를 더하는 일은 데이터 추가가 아니라 코드 작업이다.
 * dev의 카테고리는 행이라 A-08에서 관리한다.
 *
 * 목록·상세·글 관리가 같은 정의를 봐야 한다. 세 곳에 적어두면 그중 하나만 낡는다.
 */

export const TYPE_LABELS: Record<RecordType, string> = {
  QT: "큐티",
  SERMON: "설교",
  PRAISE: "찬양",
  TECH: "기술",
};

/** faith 목록의 타입 축. 순서는 화면에 놓이는 순서다 */
export const FAITH_TYPES: RecordType[] = ["QT", "SERMON", "PRAISE"];
