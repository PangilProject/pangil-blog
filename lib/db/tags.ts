import "server-only";

import { prisma } from "@/lib/db/prisma";
import type { TransactionClient } from "@/lib/db/transaction";
import type { RecordType } from "@/lib/record/callNumber";
import { normalizeTagNames } from "@/lib/record/tagNames";
import { Site } from "@/prisma/generated/enums";

/**
 * 태그 쓰기 (05 §1.4 · 04 §1.2).
 *
 * 태그는 site 스코프다 — dev와 faith에 같은 이름의 태그가 따로 존재할 수 있다(스키마의
 * @@unique([site, name])). 지면은 글 타입에서 나오므로(무효화 태그의 siteOf와 같은 규칙,
 * 04 §1.2) 호출자가 enum을 들고 다니지 않게 여기서 옮긴다.
 *
 * 저장은 "이 글의 태그 목록을 이것으로 맞춘다"는 하나의 뜻이다. 붙이기·떼기를 따로 두면
 * 자동 저장이 도중에 끊겼을 때 절반만 반영된 상태가 남는다.
 */
/** 무효화 태그의 siteOf와 같은 규칙이다 — 갈라지면 태그가 엉뚱한 지면에 쌓인다 */
function siteEnumOf(type: RecordType): Site {
  return type === "TECH" ? Site.DEV : Site.FAITH;
}

/**
 * 이미 열린 트랜잭션 안에서 태그를 맞춘다.
 *
 * 크롤러가 초안을 만들 때 필요하다 — 글을 만드는 트랜잭션 안에서 태그까지 놓아야 "글은
 * 있는데 태그는 없는" 초안이 남지 않는다. 트랜잭션 안에서 `prisma.$transaction`을 또
 * 부르면 다른 연결을 잡으므로 같은 원자 단위가 되지 않는다.
 */
export async function setPostTagsWith(
  tx: TransactionClient,
  postId: string,
  type: RecordType,
  names: string[],
): Promise<string[]> {
  const site = siteEnumOf(type);
  const wanted = normalizeTagNames(names);

  // 태그 수와 상관없이 쿼리 두 번이다. 전에는 이름마다 upsert를 `Promise.all`로 띄웠는데,
  // 트랜잭션은 연결 하나라 결국 줄을 서서 태그 10개면 5초 제한을 넘겼고(P2028), 결과 하나가
  // `undefined`로 돌아와 아래 `notIn`이 깨지기도 했다
  if (wanted.length > 0) {
    await tx.tag.createMany({
      data: wanted.map((name) => ({ site, name })),
      skipDuplicates: true,
    });
  }

  const found = await tx.tag.findMany({
    where: { site, name: { in: wanted } },
    select: { id: true, name: true },
  });
  const byName = new Map(found.map((tag) => [tag.name, tag]));
  const tags = wanted.flatMap((name) => byName.get(name) ?? []);

  // 못 찾은 이름이 있으면 조용히 빠뜨리지 않는다 — 태그가 말없이 사라진다
  if (tags.length !== wanted.length) {
    throw new Error(
      `tags not found after insert: ${wanted.filter((n) => !byName.has(n)).join(", ")}`,
    );
  }

  const keepIds = tags.map((tag) => tag.id);

  await tx.postTag.deleteMany({
    where: { postId, ...(keepIds.length > 0 ? { tagId: { notIn: keepIds } } : {}) },
  });

  if (keepIds.length > 0) {
    await tx.postTag.createMany({
      data: keepIds.map((tagId) => ({ postId, tagId })),
      skipDuplicates: true,
    });
  }

  return tags.map((tag) => tag.name);
}

export async function setPostTags(
  postId: string,
  type: RecordType,
  names: string[],
): Promise<string[]> {
  return prisma.$transaction((tx) => setPostTagsWith(tx, postId, type, names));
}
