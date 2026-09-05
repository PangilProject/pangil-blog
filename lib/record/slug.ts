import { padCallNumber, type RecordType } from "@/lib/record/callNumber";

/**
 * slug 파생 규칙 (05 §6.4 · 결정 로그 #4).
 *
 * **모든 타입이 번호로 간다.** 제목은 주소에 들어가지 않는다.
 *
 * - 묵상 3타입: `{qt|sr|pr}-{callNumber}`
 * - TECH: 청구기호를 화면에 적는 그대로 — `0072`
 *
 * TECH는 원래 제목 kebab이었다(2026-09-05 개편). 실물에서 그게 무엇을 만들었는지 세어 보고
 * 접었다 — 발행된 514편 중 **61편이 숫자만 남았고**(`2947`은 백준 문제 번호, `260405`는
 * 일지 날짜였다) 43편은 중복 회피 접미사를 달았으며 24편은 한글뿐이라 `post-N`으로 떨어졌다.
 * 나머지도 `cto`·`2-velog-tistory`처럼 한글 제목에서 ASCII만 살아남은 찌꺼기다. 제목 slug의
 * 이점은 "주소가 제목을 말한다"인데, 한글로 쓰는 글에서는 그 이점이 애초에 없었다.
 *
 * 게다가 그 찌꺼기가 **숫자 주소를 이미 오염시켰다.** `/dev/2947`은 2947번째 글처럼 보이지만
 * 아니었다. 번호로 통일하면 그 모호함이 사라진다.
 *
 * 자리를 채우는 것(`0072`)은 화면 표기와 같아지기 위해서다 — 카드·상세·OG 카드가 이미
 * `0072 · FE`로 적고 있다(03 §6.3). 덤으로 옛 slug가 죄다 앞자리 0이 없어서 **소급 적용 때
 * 충돌이 하나도 없었다**(맨 숫자로 갔다면 12건이 부딪혔다).
 *
 * 중복 시 `-2`, `-3` … — 번호는 타입별로 유일하므로 이제 걸릴 일이 없지만, 옛 slug가 남은
 * 자리를 비켜 가는 그물로 둔다.
 *
 * slug는 발행 시 확정되고 DRAFT는 null이다(05 §1.4). 구 URL 보존 의무는 없다 — 아직 최종
 * 도메인 전이라(07 §4) 어차피 주소가 통째로 바뀐다.
 */

const FAITH_SLUG_PREFIX = {
  QT: "qt",
  SERMON: "sr",
  PRAISE: "pr",
} as const satisfies Record<Exclude<RecordType, "TECH">, string>;

/**
 * 제목 → ASCII kebab. 한글·기호만 있으면 빈 문자열이 된다.
 *
 * 글 주소는 더 이상 이걸 쓰지 않는다(위 참조). 카테고리 주소가 쓴다 —
 * 거기서는 사람이 영문으로 직접 적는 값이라 kebab이 제 일을 한다(lib/record/category).
 */
export function toKebabCase(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export type DeriveSlugInput = {
  type: RecordType;
  /** 발행 트랜잭션에서 부여된 번호 */
  callNumber: number;
};

/** 중복 확인 전의 기본 slug */
export function deriveSlug({ type, callNumber }: DeriveSlugInput): string {
  if (type !== "TECH") {
    return `${FAITH_SLUG_PREFIX[type]}-${callNumber}`;
  }

  return padCallNumber(callNumber);
}

/**
 * 중복된 slug에 순번을 붙인다. attempt는 1부터 시작하고 1이면 접미사가 없다.
 * (05 §6.4 "중복 시 -2")
 */
export function withDedupeSuffix(slug: string, attempt: number): string {
  return attempt <= 1 ? slug : `${slug}-${attempt}`;
}

/**
 * slug가 이미 쓰였는지 확인하는 함수를 받아 빈 자리를 찾는다.
 * DB 조회를 주입받으므로 이 모듈은 순수하게 유지된다.
 */
export async function findAvailableSlug(
  base: string,
  isTaken: (candidate: string) => Promise<boolean>,
  maxAttempts = 50,
): Promise<string> {
  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    const candidate = withDedupeSuffix(base, attempt);
    if (!(await isTaken(candidate))) return candidate;
  }

  throw new Error(`slug 후보를 ${maxAttempts}번 시도했지만 빈 자리가 없습니다: ${base}`);
}
