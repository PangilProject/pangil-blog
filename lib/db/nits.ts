import "server-only";

import { prisma } from "@/lib/db/prisma";

/**
 * 거슬림 목록 리포지토리 (03 §3 · 프리모템 #3).
 *
 * 이 테이블의 가치는 내용이 아니라 **적는 행위가 값싸다는 사실**에 있다. 그래서 우선순위·기한·
 * 담당이 없고, 함수도 셋뿐이다 — 관리할 것이 늘면 적기를 미루게 되고, 그러면 개선 욕구가
 * 목록이 아니라 코드로 간다(프리모템 #10).
 */

export type Nit = { id: string; body: string; createdAt: Date; doneAt: Date | null };

/** 대시보드 상한. 목록이 길어지면 그건 읽히지 않는 벽이 된다 */
const OPEN_LIMIT = 6;

export async function listOpenNits(limit = OPEN_LIMIT): Promise<Nit[]> {
  return prisma.nit.findMany({
    where: { doneAt: null },
    // 오래 걸린 것이 위에 온다 — 새 것이 위면 옛 거슬림이 영원히 아래로 밀린다
    orderBy: { createdAt: "asc" },
    take: limit,
  });
}

/** 남은 개수 — 상한 때문에 잘린 것이 있는지 화면이 알아야 한다 */
export async function countOpenNits(): Promise<number> {
  return prisma.nit.count({ where: { doneAt: null } });
}

export async function addNit(body: string): Promise<void> {
  await prisma.nit.create({ data: { body } });
}

/**
 * 처리 표시. 지우지 않고 `doneAt`을 채운다 — 무엇이 거슬렸고 무엇을 실제로 고쳤는지가
 * 이 목록의 두 번째 쓸모다.
 */
export async function resolveNit(id: string): Promise<void> {
  await prisma.nit.updateMany({ where: { id, doneAt: null }, data: { doneAt: new Date() } });
}
