/**
 * 청구기호 표기 (03 §6.3 · 05 §5).
 *
 * 번호 자체는 발행 트랜잭션이 타입별 통산 일련번호로 부여하고 이후 불변이다. 이 파일은
 * 그 숫자를 화면에 어떻게 적을지만 담당하는 프레젠테이션 계층이다.
 *   QT-1043 / SR-0104(설교) / PR-0388(찬양) / TECH는 "0072 · 카테고리"
 *
 * 표기 규칙을 한 곳에 모아두는 이유: 목록 카드·상세 지면·OG 카드가 같은 문자열을 써야
 * "링크 공유가 곧 브랜딩"(04 §3.5)이 성립한다.
 */

export const RECORD_TYPES = ["QT", "SERMON", "PRAISE", "TECH"] as const;

export type RecordType = (typeof RECORD_TYPES)[number];

/** 통산 번호 최소 자리수. 1,000편을 넘긴 이력이라 네 자리로 적는다(03 §3). */
export const CALL_NUMBER_DIGITS = 4;

const TYPE_PREFIX = {
  QT: "QT",
  SERMON: "SR",
  PRAISE: "PR",
} as const satisfies Record<Exclude<RecordType, "TECH">, string>;

/** 숫자 구분자 — 타자기체로 적히는 자리라 가운뎃점을 쓴다(03 §2.2) */
const TECH_SEPARATOR = " · ";

export function padCallNumber(callNumber: number): string {
  return String(callNumber).padStart(CALL_NUMBER_DIGITS, "0");
}

export type FormatCallNumberInput = {
  type: RecordType;
  /** 발행 시 부여된다. DRAFT는 null (05 §1.4) */
  callNumber: number | null | undefined;
  /** TECH만 병기한다 (02 §4 — 카테고리는 TECH 전용) */
  categoryName?: string | null;
};

/**
 * 청구기호 문자열. 아직 번호가 없는 초안이면 null을 돌려주고, 무엇을 보여줄지는
 * 호출하는 화면이 정한다(A-02 초안함은 "초안", 공개 지면은 표기 없음).
 */
export function formatCallNumber({
  type,
  callNumber,
  categoryName,
}: FormatCallNumberInput): string | null {
  if (callNumber === null || callNumber === undefined) return null;

  const number = padCallNumber(callNumber);

  if (type === "TECH") {
    return categoryName ? `${number}${TECH_SEPARATOR}${categoryName}` : number;
  }

  return `${TYPE_PREFIX[type]}-${number}`;
}
