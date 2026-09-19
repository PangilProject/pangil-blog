import { parsePublishContent } from "@/lib/db/content";
import { prisma } from "@/lib/db/prisma";
import { extractSearchText } from "@/lib/render/searchText";

/**
 * 004 · 검색 색인에서 붙어 버린 낱말을 떼어낸다 (05 §1.6 · §4A).
 *
 *   npm run content:search-text              # 리포트만 (기본)
 *   npm run content:search-text -- --apply   # 실제 쓰기
 *
 * **로컬 `.env`는 dev를 가리킨다.** 프로덕션에 적용하려면 그때만 값을 넣어 돌린다:
 *
 *   DATABASE_URL="…" npm run content:search-text -- --apply
 *
 * 그 값을 `.env`에 적어 두지 않는다 — 프로덕션 자격증명을 로컬에 남기지 않는 것이 규칙이다.
 * 돌리기 전에 **`붙은 곳` 줄을 먼저 읽는다**: 002에서 dev에 대고 돌려 헛돈 적이 있다(003 주석).
 *
 * 배경: 평문 타깃이 문단 **안**의 줄바꿈(`hardBreak`)을 줄 경계로 보지 않아, "감사"⏎"합니다"가
 * `감사합니다` 한 낱말로 색인됐다. 코드는 고쳤지만(`lib/render/plainText.ts`) `searchText`는
 * **발행 시점에 채워지는 컬럼**이라 이미 저장된 값은 옛 규칙 그대로다.
 *
 * 가공의 사례가 아니다 — 티스토리 컨버터가 `<br>`을 전부 `hardBreak`로 옮겼으므로
 * (`scripts/migrate-tistory/convertHtml.ts:218`) **이관해 온 글 대부분이 그 상태**다.
 *
 * **규칙을 여기서 다시 적지 않는다.** `extractSearchText`를 그대로 부른다 — 003이 같은
 * 교훈을 적어 두었다. 덕분에 이 스크립트는 "지금 규칙으로 다시 뽑는다"가 되어, 다음에
 * 색인 규칙이 또 바뀌어도 이 파일은 낡지 않는다.
 *
 * 멱등하다. 지금 값과 같은 글은 세기만 하고 건너뛴다.
 *
 * 스키마를 건드리지 않으므로 마이그레이션이 아니다. trgm 인덱스도 그대로다.
 */

const APPLY = process.argv.includes("--apply");

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

/** 바뀐 자리를 눈으로 보여준다 — 붙어 있던 낱말이 실제로 갈라졌는지가 이 작업의 전부다 */
function firstDifference(before: string, after: string): string {
  let at = 0;
  while (at < before.length && at < after.length && before[at] === after[at]) at += 1;

  const from = Math.max(0, at - 12);
  return `…${before.slice(from, at + 12)}  →  …${after.slice(from, at + 12)}`;
}

async function main() {
  const posts = await prisma.post.findMany({
    where: { status: "PUBLISHED" },
    select: { id: true, title: true, slug: true, content: true, searchText: true },
    orderBy: { createdAt: "asc" },
  });

  const broken: { id: string; label: string; issues: string[] }[] = [];
  const changed: { id: string; slug: string | null; before: string; after: string }[] = [];

  for (const post of posts) {
    const parsed = parsePublishContent(post.content);

    if (!parsed.ok) {
      // 조용히 건너뛰지 않는다 — 검증에 걸리는 글이 있으면 그것부터 알아야 한다
      broken.push({ id: post.id, label: post.title, issues: parsed.issues });
      continue;
    }

    const after = extractSearchText(post.title, parsed.content);
    if (after !== (post.searchText ?? "")) {
      changed.push({ id: post.id, slug: post.slug, before: post.searchText ?? "", after });
    }
  }

  console.log(`붙은 곳        ${connectionLabel()}`);
  console.log(`발행 글        ${posts.length}편`);
  console.log(`이미 제 모양   ${posts.length - changed.length - broken.length}편`);
  console.log(`다시 뽑을 것   ${changed.length}편`);
  console.log(`검증 실패      ${broken.length}편`);

  for (const post of broken.slice(0, 5)) {
    console.log(`  ⚠ ${post.label.slice(0, 40)} — ${post.issues.slice(0, 2).join(" / ")}`);
  }

  for (const post of changed.slice(0, 15)) {
    console.log(`  ${post.slug ?? post.id}`);
    console.log(`    ${firstDifference(post.before, post.after)}`);
  }
  if (changed.length > 15) console.log(`  … 그리고 ${changed.length - 15}편 더`);

  if (changed.length === 0) {
    console.log("\n다시 뽑을 것이 없다.");
    return;
  }

  if (!APPLY) {
    console.log("\n리포트만 했다. 실제로 쓰려면 --apply 를 붙인다.");
    return;
  }

  await prisma.$transaction(
    async (tx) => {
      for (const post of changed) {
        await tx.post.update({ where: { id: post.id }, data: { searchText: post.after } });
      }
    },
    // 587편이면 기본 5초를 넘긴다 (003에서 실제로 굴렀다)
    { timeout: 180_000, maxWait: 30_000 },
  );

  console.log(`\n${changed.length}편의 색인을 다시 뽑았다.`);
  console.log("검색은 이 컬럼을 직접 훑으므로(trgm GIN) 배포도 무효화도 필요 없다.");
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
