import "server-only";

import type { PrismaClient } from "@/prisma/generated/client";

/**
 * `prisma.$transaction`이 콜백에 넘기는 클라이언트.
 *
 * 트랜잭션 안에서는 트랜잭션을 다시 열 수 없으므로(`$transaction`을 또 부르면 다른 연결을
 * 잡아 같은 원자 단위가 아니게 된다) 리포지토리 함수를 트랜잭션 안에서 쓰려면 이 타입을
 * 받아야 한다. 생성된 클라이언트에서 트랜잭션이 못 쓰는 것들을 뺀 모양이다.
 */
export type TransactionClient = Omit<
  PrismaClient,
  "$connect" | "$disconnect" | "$on" | "$transaction" | "$use" | "$extends"
>;
