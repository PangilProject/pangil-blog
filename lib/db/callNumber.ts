import type { RecordType } from "@/lib/record/callNumber";

/**
 * 청구기호 부여 (05 §5).
 *
 * 부여 시점은 **최초 발행 트랜잭션 내부**다. `UPDATE … SET lastNumber = lastNumber + 1
 * RETURNING`이 row lock을 잡으므로 동시 발행에도 번호가 겹치지 않는다.
 *
 * 불변식:
 * - 한 번 부여된 번호는 바뀌지 않는다. PRIVATE 전환·재공개·수정에도 그대로다
 * - 삭제 시 결번을 허용한다. 청구기호는 카운트가 아니라 이력이다
 * - 부여 순서는 발행 순서다. 크롤링된 QT를 며칠 밀려 발행하면 달력과 어긋나지만 그게 정본이다
 *   (마이그레이션만 예외로 원본 작성일순 소급 — 05 §6.4)
 *
 * 트랜잭션 클라이언트를 주입받아 테스트 가능하게 둔다.
 */

/** 발행 트랜잭션이 넘겨주는 최소 인터페이스 */
export type CallNumberCounterClient = {
  callNumberCounter: {
    upsert(args: {
      where: { type: RecordType };
      create: { type: RecordType; lastNumber: number };
      update: { lastNumber: { increment: number } };
      select: { lastNumber: true };
    }): Promise<{ lastNumber: number }>;
  };
};

/** 타입별 다음 번호를 원자적으로 발급한다 */
export async function assignCallNumber(
  tx: CallNumberCounterClient,
  type: RecordType,
): Promise<number> {
  const counter = await tx.callNumberCounter.upsert({
    where: { type },
    // 첫 발행이면 1번부터 시작한다
    create: { type, lastNumber: 1 },
    update: { lastNumber: { increment: 1 } },
    select: { lastNumber: true },
  });

  return counter.lastNumber;
}

/**
 * 이미 번호가 있으면 그대로 쓰고, 없을 때만 발급한다.
 * 재발행(PRIVATE → PUBLISHED)에서 번호가 새로 붙으면 이력이 어긋난다.
 */
export async function ensureCallNumber(
  tx: CallNumberCounterClient,
  type: RecordType,
  existing: number | null | undefined,
): Promise<number> {
  if (existing !== null && existing !== undefined) return existing;
  return assignCallNumber(tx, type);
}
