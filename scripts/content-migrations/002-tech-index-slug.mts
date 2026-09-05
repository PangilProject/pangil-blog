import { prisma } from "@/lib/db/prisma";
import { padCallNumber } from "@/lib/record/callNumber";

/**
 * 002 · 기술 글 주소를 청구기호로 (05 §1.6 content 마이그레이션 규약 · §6.4).
 *
 *   npm run content:tech-slug              # 리포트만 (기본)
 *   npm run content:tech-slug -- --apply   # 실제 쓰기
 *
 * 배경: 기술 글 slug가 제목 kebab이었다. 한글로 쓰는 글에서 그건 ASCII 찌꺼기만 남긴다 —
 * dev 514편에서 `cto`·`2-velog-tistory` 같은 것이 나왔고, **61편은 숫자만 남아** `/dev/2947`
 * (백준 문제 번호)·`/dev/260405`(일지 날짜)가 주소가 돼 있었다. 43편은 중복 회피 접미사를
 * 달았고 24편은 `post-N`으로 떨어졌다.
 *
 * 이제 화면에 적히는 청구기호를 그대로 쓴다(`0072`). 묵상 3타입은 이미 그렇게 하고 있었다.
 *
 * **옛 주소는 살리지 않는다.** 아직 최종 도메인 전이라(07 §4) 도메인이 붙는 순간 어차피
 * 주소가 통째로 바뀐다 — 지금이 가장 싸다.
 *
 * 두 단계로 바꾼다. slug는 unique이므로 한 번에 옮기면 **가는 자리에 아직 남이 앉아 있는**
 * 순간이 생긴다. 이 데이터에서는 패딩 덕에 충돌이 0이었지만, 그건 이 데이터의 사정이고
 * 스크립트의 계약이 아니다 — 먼저 전부 임시 이름으로 비우고, 그다음 제자리에 앉힌다.
 *
 * 멱등하다. 이미 제 번호를 쓰는 글은 세기만 하고 건너뛴다.
 *
 * 기본값이 리포트인 것은 의도다. 이 스크립트는 **공개 주소를 바꾼다** — 되돌릴 수 없고,
 * 이 레포의 규약은 크롤러·이관과 마찬가지로 "먼저 dry-run"이다(06 §7).
 */

const APPLY = process.argv.includes("--apply");

/**
 * 어느 DB에 붙었는지 먼저 말한다.
 *
 * 이 스크립트는 `--env-file-if-exists=.env`로 도는데 그 파일은 **dev 전용**이다(08 §3).
 * 프로덕션에 돌리려면 셸에서 `DATABASE_URL`을 덮어써야 하는데, 잊으면 dev에 붙고 dev는
 * 이미 옮겨져 있어 "옮길 것이 없다"로 조용히 끝난다 — 실제로 그렇게 한 번 헛돌았다.
 * 성공처럼 보이는 실패가 가장 나쁘다.
 *
 * 비밀번호는 찍지 않는다. 대신 **사용자 이름은 찍는다** — Supabase 풀러 주소는 dev·prod가
 * 같은 리전이면 호스트까지 똑같고, 둘을 가르는 것은 사용자 이름에 붙은 프로젝트 ref뿐이다.
 * 그 ref는 `NEXT_PUBLIC_SUPABASE_URL`에도 들어 있는 공개 값이다.
 */
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
    where: { type: "TECH", slug: { not: null }, callNumber: { not: null } },
    select: { id: true, title: true, slug: true, callNumber: true, status: true },
    orderBy: { callNumber: "asc" },
  });

  const targets = posts
    .map((post) => ({ ...post, next: padCallNumber(post.callNumber as number) }))
    .filter((post) => post.slug !== post.next);

  const already = posts.length - targets.length;

  // 가는 자리에 남이 앉아 있는지. 두 단계로 옮기므로 막지는 않고, 몇 건인지 눈에 보이게 한다
  const owners = new Map(posts.map((post) => [post.slug as string, post.id]));
  const occupied = targets.filter((post) => {
    const owner = owners.get(post.next);
    return owner !== undefined && owner !== post.id;
  });

  console.log(`붙은 곳        ${connectionLabel()}`);
  console.log(`기술 글        ${posts.length}편`);
  console.log(`이미 제 번호   ${already}편`);
  console.log(`옮길 대상      ${targets.length}편`);
  console.log(`자리가 찬 것   ${occupied.length}편 (임시 이름을 거쳐 간다)`);

  for (const post of targets) {
    console.log(`  ${post.slug}  →  ${post.next}   ${post.title.slice(0, 40)}`);
  }

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
      // ① 전부 비운다. 임시 이름은 id라 그 자체로 유일하다
      for (const post of targets) {
        await tx.post.update({ where: { id: post.id }, data: { slug: `moving-${post.id}` } });
      }

      // ② 제자리에 앉힌다
      for (const post of targets) {
        await tx.post.update({ where: { id: post.id }, data: { slug: post.next } });
      }
    },
    // 514편이면 왕복이 1,028번이라 기본 5초를 넘긴다 — 실제로 그렇게 한 번 굴렀고, 다행히
    // 통째로 되돌아갔다. 한 번 돌고 마는 스크립트라 벌크 SQL로 접지 않는다: 자리를 채우는
    // 규칙(`padCallNumber`)을 SQL에 한 벌 더 적으면 그 둘이 언젠가 어긋난다
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
