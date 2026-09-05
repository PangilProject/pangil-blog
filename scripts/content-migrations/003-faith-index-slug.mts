import { prisma } from "@/lib/db/prisma";
import type { RecordType } from "@/lib/record/callNumber";
import { deriveSlug } from "@/lib/record/slug";

/**
 * 003 · 묵상 글 주소의 자리수를 맞춘다 (05 §1.6 · §6.4).
 *
 *   npm run content:faith-slug              # 리포트만 (기본)
 *   npm run content:faith-slug -- --apply   # 실제 쓰기
 *
 * 배경: 묵상 slug는 `qt-204`인데 화면에는 `QT-0204`로 적히고 있었다(03 §6.3). 같은 번호가
 * 두 모양으로 적히면 그중 하나는 언젠가 틀린 것으로 읽힌다. 기술 글을 청구기호로 옮기면서
 * (002) 그쪽은 `0072`가 됐으므로, 남은 어긋남을 여기서 없앤다.
 *
 * **목표 주소를 여기서 계산하지 않는다.** `deriveSlug`를 그대로 부른다 — 002는 자리 채우기를
 * 한 벌 더 적었는데, 규칙이 두 곳에 있으면 다음에 규칙을 고칠 때 소급 스크립트가 낡는다.
 * 덕분에 이 스크립트는 "규칙과 어긋난 것을 규칙에 맞춘다"가 되어 타입을 가리지 않는다.
 *
 * 002와 같은 이유로 두 단계다. slug는 unique이므로 한 번에 옮기면 가는 자리에 아직 남이
 * 앉아 있는 순간이 생긴다.
 *
 * 멱등하다. 이미 규칙과 같은 글은 세기만 하고 건너뛴다.
 */

const APPLY = process.argv.includes("--apply");
const FAITH: RecordType[] = ["QT", "SERMON", "PRAISE"];

/** 붙은 DB를 먼저 말한다 — 002에서 dev에 대고 돌려 헛돈 적이 있다. 비밀번호는 찍지 않는다 */
function connectionLabel(): string {
  const raw = process.env.DATABASE_URL;
  if (!raw) return "(DATABASE_URL 없음)";

  try {
    const url = new URL(raw);
    return `${url.username}@${url.hostname}${url.pathname}`;
  } catch {
    return "(읽을 수 없는 DATABASE_URL)";
  }
}

async function main() {
  const posts = await prisma.post.findMany({
    where: { type: { in: FAITH }, slug: { not: null }, callNumber: { not: null } },
    select: { id: true, type: true, title: true, slug: true, callNumber: true },
    orderBy: [{ type: "asc" }, { callNumber: "asc" }],
  });

  const targets = posts
    .map((post) => ({
      ...post,
      next: deriveSlug({ type: post.type as RecordType, callNumber: post.callNumber as number }),
    }))
    .filter((post) => post.slug !== post.next);

  const owners = new Map(posts.map((post) => [post.slug as string, post.id]));
  const occupied = targets.filter((post) => {
    const owner = owners.get(post.next);
    return owner !== undefined && owner !== post.id;
  });

  console.log(`붙은 곳        ${connectionLabel()}`);
  console.log(`묵상 글        ${posts.length}편`);
  console.log(`이미 제 모양   ${posts.length - targets.length}편`);
  console.log(`옮길 대상      ${targets.length}편`);
  console.log(`자리가 찬 것   ${occupied.length}편 (임시 이름을 거쳐 간다)`);

  for (const post of targets.slice(0, 20)) {
    console.log(`  ${post.slug}  →  ${post.next}   ${post.title.slice(0, 34)}`);
  }
  if (targets.length > 20) console.log(`  … 그리고 ${targets.length - 20}편 더`);

  if (targets.length === 0) {
    console.log("\n옮길 것이 없다.");
    return;
  }

  if (!APPLY) {
    console.log("\n리포트만 했다. 실제로 쓰려면 --apply 를 붙인다.");
    return;
  }

  await prisma.$transaction(
    async (tx) => {
      for (const post of targets) {
        await tx.post.update({ where: { id: post.id }, data: { slug: `moving-${post.id}` } });
      }
      for (const post of targets) {
        await tx.post.update({ where: { id: post.id }, data: { slug: post.next } });
      }
    },
    // 575편이면 왕복이 1,150번이라 기본 5초를 넘긴다 (002에서 실제로 굴렀다)
    { timeout: 180_000, maxWait: 30_000 },
  );

  console.log(`\n${targets.length}편의 주소를 옮겼다.`);
  console.log("공개 지면 반영은 배포(전체 rebuild)로 한다 — 이 스크립트는 무효화를 하지 않는다.");
  console.log("옛 주소는 404가 된다. 리다이렉트를 두지 않는 것이 결정이다(05 §6.4).");
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
