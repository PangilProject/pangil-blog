import type { RecordType } from "@/lib/record/callNumber";

/**
 * slug 파생 규칙 (05 §6.4 · 결정 로그 #4).
 *
 * - 묵상 3타입: `{qt|sr|pr}-{callNumber}` — 제목이 한글이고 매일 반복되므로 번호가 정본이다
 * - TECH: 제목 kebab. 한글 제목이면 kebab 결과가 비므로 `post-{callNumber}`로 폴백한다
 * - 중복 시 `-2`, `-3` … (마이그레이션 소급 부여와 신규 발행이 같은 규칙을 쓴다)
 *
 * slug는 발행 시 확정되고 DRAFT는 null이다(05 §1.4). 티스토리 구 URL 보존 의무는 없다
 * (00 §6.3 — 301 불가라 SEO는 어차피 리셋된다).
 */

const FAITH_SLUG_PREFIX = {
  QT: "qt",
  SERMON: "sr",
  PRAISE: "pr",
} as const satisfies Record<Exclude<RecordType, "TECH">, string>;

/** 제목 → ASCII kebab. 한글·기호만 있으면 빈 문자열이 된다 */
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
  /** TECH만 사용 */
  title?: string | null;
};

/** 중복 확인 전의 기본 slug */
export function deriveSlug({ type, callNumber, title }: DeriveSlugInput): string {
  if (type !== "TECH") {
    return `${FAITH_SLUG_PREFIX[type]}-${callNumber}`;
  }

  const kebab = toKebabCase(title ?? "");
  return kebab || `post-${callNumber}`;
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
